#!/usr/bin/env python3
"""Build keyterms.json from the 9th-11th grade key terms pages on Google Sites.

The generators can't read the Sites pages themselves -- Google sends no CORS
header, so a browser fetch from portfolio.dpeacl.org is blocked. Instead this
script reads the pages and writes keyterms.json at the repo root, which the
generators load like any other file on the site. Teachers keep editing the
Sites pages exactly as before; re-running this picks the changes up.

Usage
-----
    # fetch the pages, review anything odd, show what changed, then write
    python3 tools/scrape_keyterms.py

    # see what would change without writing anything
    python3 tools/scrape_keyterms.py --dry-run

    # parse saved copies instead of fetching (files named 9th.html, 10th.html, 11th.html)
    python3 tools/scrape_keyterms.py --html-dir path/to/pages

    # forget saved decisions that no longer match anything on the pages
    python3 tools/scrape_keyterms.py --prune

    # the nightly GitHub Action: never prompt, and exit 3 (after writing) when
    # something needs a person -- see .github/workflows/keyterms.yml
    python3 tools/scrape_keyterms.py --no-input --fail-on-review

Page layout it expects
----------------------
Each page lists units, each unit lists the four rotations, and each rotation
lists one term per line:

    Unit 1
    Art
    Polar coordinates
    Radial design
    Computer Lab
    ...

A unit header is a line that reads exactly "Unit N". A rotation header is a
line that reads exactly Art, Computer Lab, Physics or Shop (bold or not -- some
terms are bold too, so bold isn't used to tell them apart). Shop is stored as
"Machine Shop" to match the Classroom picker in the generators.

Handled automatically
---------------------
  * A line starting with "Example" is dropped.
  * A line of the form "*Same as 9.1, plus..." pulls in that unit's terms for
    the same rotation (any grade), after this unit's own terms.
  * Duplicate terms within a rotation are dropped, keeping the first.
  * A rotation with nothing in it is left out, so the generator falls back to
    its usual key terms link.

Flagged for review
------------------
  * Lines that read like instructions rather than terms -- wrapped in
    parentheses, longer than a sentence fragment, or starting "plus any" /
    "Please". Suggested fix: show it as a note above the chips.
  * A trailing aside like "(Know what they are!)". Suggested fix: drop the aside.
  * Likely typos, judged against the system dictionary (/usr/share/dict/words)
    and the other terms on the pages. Suggested fix: the corrected spelling.
    Skipped where there's no dictionary: the pages alone flag too many real
    words (projection -> protection).
  * Text under a unit before its first rotation header. Suggested fix: drop it.

Each flag can be fixed as suggested, edited by hand, kept as-is, dropped, or
turned into a note. Choices are saved to tools/keyterms-decisions.json (commit
it) so the same line isn't asked about again. Fixing a typo on the Sites page
itself is still the better fix -- the saved choice then stops matching, and
--prune clears it out.

When there's no terminal to ask on (a scheduled job), flagged lines with no
saved choice are kept as-is and listed, and the run carries on. With
--fail-on-review it then exits 3 -- except for possible typos, since another
system's dictionary may flag words this one doesn't, leaving nothing a local
run could answer.

Nothing is written if any page fails to fetch or no longer looks like the
layout above, so a Google Sites redesign can't quietly empty the word banks.
"""

import argparse
import difflib
import json
import os
import re
import sys
import urllib.request
from collections import Counter
from datetime import date, datetime, timezone
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(ROOT, "keyterms.json")
DECISIONS_PATH = os.path.join(ROOT, "tools", "keyterms-decisions.json")
DICT_PATH = "/usr/share/dict/words"

PAGE_URL = "https://sites.google.com/dpengineering.org/dpea-portfolios/key-terms/{}-grade-key-terms"
GRADES = {"9": "9th", "10": "10th", "11": "11th"}

# Header text on the page -> the value the generators' Classroom picker uses.
ROTATIONS = {
    "art": "Art",
    "computer lab": "Computer Lab",
    "physics": "Physics",
    "shop": "Machine Shop",
    "machine shop": "Machine Shop",
}
ROTATION_ORDER = ["Art", "Computer Lab", "Physics", "Machine Shop"]

UNIT_RE = re.compile(r"^unit\s*(\d+)$", re.I)
EXAMPLE_RE = re.compile(r"^(example|e\.g\.)\b", re.I)
SAME_AS_RE = re.compile(r"^\*?\s*same as\s+(\d+)\s*\.\s*(\d+)\b", re.I)
WILDCARD_RE = re.compile(r"^(\+|plus\b)\s*any\b|^please\b|\bsuch as\b", re.I)
ASIDE_RE = re.compile(r"\s*\(([^()]*)\)\s*$")
ASIDE_WORDS_RE = re.compile(r"!|\b(use|uses|count|counts|know)\b", re.I)
MAX_TERM_WORDS = 8


# ---------------------------------------------------------------- fetching --

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "dpea-keyterms-scraper"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode("utf-8")


def load_pages(html_dir):
    pages = {}
    for grade, name in GRADES.items():
        if html_dir:
            with open(os.path.join(html_dir, name + ".html"), encoding="utf-8") as f:
                pages[grade] = f.read()
        else:
            pages[grade] = fetch(PAGE_URL.format(name))
    return pages


# ----------------------------------------------------------------- parsing --

class BlockParser(HTMLParser):
    """Collect the text of each paragraph-level block after the page title.

    Google Sites splits a line into several spans whenever its formatting
    changes mid-word ("i" + "ncrement"), so text is gathered per block, not per
    span. Blocks before the <h1> are the site navigation and are skipped.
    """

    BLOCKS = ("p", "li", "h1", "h2", "h3", "h4", "h5", "h6")

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self.started = False
        self.tag = None
        self.text = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        if self.tag is None and tag in self.BLOCKS:
            self.tag, self.text, self.links = tag, [], []
        elif self.tag is not None and tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.links.append(href)
        elif self.tag is not None and tag == "br":
            self.text.append(" ")

    def handle_endtag(self, tag):
        if tag != self.tag:
            return
        text = re.sub(r"\s+", " ", "".join(self.text)).strip()
        if tag == "h1":
            self.started = True
        elif self.started and text:
            self.blocks.append((text, self.links[0] if self.links else None))
        self.tag = None

    def handle_data(self, data):
        if self.tag is not None:
            self.text.append(data)


def parse_page(grade, html):
    """Return (items, problems) for one page.

    Each item is a line of text under a unit: {"grade", "unit", "rot", "text",
    "link"}. rot is None for text that comes before the unit's first rotation
    header. problems are layout issues worth stopping for.
    """
    parser = BlockParser()
    parser.feed(html)

    items, problems, headers = [], [], {}
    unit = rot = None
    for text, link in parser.blocks:
        m = UNIT_RE.match(text)
        if m:
            unit, rot = m.group(1), None
            headers.setdefault(unit, [])
            continue
        if unit is None:
            continue
        if text.lower() in ROTATIONS:
            rot = ROTATIONS[text.lower()]
            headers[unit].append(rot)
            continue
        items.append({"grade": grade, "unit": unit, "rot": rot, "text": text, "link": link})

    if not headers:
        problems.append(f"Grade {grade}: no 'Unit N' headers found -- has the page layout changed?")
    for unit, rots in headers.items():
        missing = [r for r in ROTATION_ORDER if r not in rots]
        if missing:
            problems.append(f"{grade}.{unit}: no header for {', '.join(missing)}")
    return items, problems


# ------------------------------------------------------------------- typos --

class TypoChecker:
    """Spot likely misspellings without a spell-check dependency.

    A word is trusted if it's in the system dictionary, appears in two or more
    terms across the pages, or is a plural/-ed/-ing form of a trusted word.
    Anything else gets compared to trusted words of a similar length; a close
    match is offered as the fix. Acronyms and camelCase (INPUT_PULLUP, pinMode,
    McMaster) are skipped, and proper nouns in the dictionary are never offered
    as a fix. Technical words with no near neighbour (Delrin) pass untouched.
    """

    def __init__(self, texts):
        self.freq = Counter()
        for text in texts:
            self.freq.update(set(w.lower() for w in re.findall(r"[A-Za-z]+", text)))
        self.dict = set()
        if os.path.exists(DICT_PATH):
            with open(DICT_PATH, encoding="utf-8", errors="ignore") as f:
                words = [w.strip() for w in f if w.strip().isalpha()]
            self.dict = {w.lower() for w in words}
            # Capitalised entries are names (Lorenzo, Puyallup): fine to trust, wrong to suggest.
            self.common = {w for w in words if w.islower()}
        else:
            self.common = set()
        self.buckets = {}
        for w in self.common | {w for w, n in self.freq.items() if n >= 2}:
            self.buckets.setdefault((w[0], len(w)), []).append(w)

    def trusted(self, w):
        return w in self.dict or self.freq[w] >= 2

    def known(self, w):
        if self.trusted(w):
            return True
        stems = []
        for suffix in ("s", "es", "ed", "ing", "d"):
            if w.endswith(suffix) and len(w) - len(suffix) >= 3:
                stem = w[: -len(suffix)]
                stems.append(stem)
                if len(stem) >= 2 and stem[-1] == stem[-2]:
                    stems.append(stem[:-1])          # tapped -> tap
        if w.endswith("ies"):
            stems.append(w[:-3] + "y")               # galaxies -> galaxy
        return any(self.trusted(s) for s in stems)

    def suggest_word(self, w):
        if len(w) < 5 or self.known(w):
            return None
        pool = []
        for n in range(len(w) - 2, len(w) + 3):
            pool.extend(self.buckets.get((w[0], n), []))
        cands = [c for c in difflib.get_close_matches(w, pool, n=5, cutoff=0.85)
                 # A plural or verb form of the same word isn't a typo.
                 if not (c.rstrip("s") == w.rstrip("s") or c.startswith(w) or w.startswith(c))]
        if not cands:
            return None
        # Misspellings usually keep the start of the word: Auxillary is
        # auxiliary, not axillary, even though axillary scores a touch higher.
        # Capped so a long shared start doesn't beat a closer match overall
        # (Fastners is fasteners, not fastness).
        prefix = lambda c: min(3, len(os.path.commonprefix([c, w])))
        return max(cands, key=lambda c: (prefix(c), difflib.SequenceMatcher(None, w, c).ratio()))

    def suggest(self, text):
        """Return (fixed_text, [(wrong, right), ...]) or None."""
        if not self.dict:
            return None
        changes, out, last = [], [], 0
        for m in re.finditer(r"[A-Za-z]+", text):
            word = m.group(0)
            if word.isupper() or any(c.isupper() for c in word[1:]):
                continue                                 # acronym or camelCase
            cand = self.suggest_word(word.lower())
            if not cand:
                continue
            if word[0].isupper():
                cand = cand[0].upper() + cand[1:]
            out.append(text[last:m.start()] + cand)
            last = m.end()
            changes.append((word, cand))
        if not changes:
            return None
        return "".join(out) + text[last:], changes


# ------------------------------------------------------------------- flags --

def decision_key(item):
    rot = item["rot"] or "(no rotation)"
    return f"{item['grade']}.{item['unit']} {rot}: {item['text']}"


def find_flag(item, typos):
    """Return {"why", "suggest", "to"} for a line that needs a look, else None.

    suggest is the action offered by default: fix, note or drop.
    """
    text = item["text"]
    if item["rot"] is None:
        return {"why": "text before the unit's first rotation header", "suggest": "drop"}
    if re.search(r"same as", text, re.I):
        return {"why": "mentions 'same as' but isn't in the '*Same as 9.1, plus...' form",
                "suggest": "note"}
    # A trailing (clarification) doesn't make a term long: "Tool marks (in the
    # end of a light rod)" is still a two-word term.
    if text.startswith("(") or WILDCARD_RE.search(text) \
            or len(ASIDE_RE.sub("", text).split()) > MAX_TERM_WORDS:
        return {"why": "reads like an instruction, not a term", "suggest": "note"}
    m = ASIDE_RE.search(text)
    if m and ASIDE_WORDS_RE.search(m.group(1)):
        return {"why": f"ends with an aside: ({m.group(1)})", "suggest": "fix",
                "to": text[: m.start()].strip()}
    hit = typos.suggest(text)
    if hit:
        fixed, changes = hit
        why = "possible typo: " + ", ".join(f"{a} -> {b}" for a, b in changes)
        return {"why": why, "suggest": "fix", "to": fixed, "typo": True}
    return None


ACTION_KEYS = {"f": "fix", "e": "edit", "k": "keep", "d": "drop", "n": "note",
               "s": "skip", "a": "accept-all", "q": "quit"}


def ask(item, flag):
    """Prompt for one flagged line. Returns a decision dict, "skip", "accept-all" or "quit"."""
    loc = f"{item['grade']}.{item['unit']} {item['rot'] or '(no rotation)'}"
    print(f"\n[{loc}] {item['text']!r}")
    print(f"  {flag['why']}")
    options = []
    if flag.get("to"):
        options.append(f"[f]ix -> {flag['to']!r}")
    options += ["[e]dit", "[k]eep as-is", "[d]rop", "[n]ote above the chips",
                "[s]kip for now", "[a]ccept all remaining as-is", "[q]uit"]
    default = flag["suggest"]
    default_key = {"fix": "f", "note": "n", "drop": "d"}[default]
    print("  " + "  ".join(options))
    while True:
        answer = input(f"  choice [{default_key}]: ").strip().lower() or default_key
        action = ACTION_KEYS.get(answer[:1])
        if action is None or (action == "fix" and not flag.get("to")):
            print("  ?")
            continue
        if action in ("skip", "accept-all", "quit"):
            return action
        if action == "fix":
            return {"action": "fix", "to": flag["to"]}
        if action == "edit":
            to = input("  replace with: ").strip()
            if not to:
                continue
            return {"action": "fix", "to": to}
        return {"action": action}


# -------------------------------------------------------------- assembling --

def build(items, decisions, interactive, report):
    """Apply rules and decisions; return ({(g, u, rot): entry}, used_keys).

    entry = {"terms": [...], "notes": [{"text", "link"?}], "inherits": (g, u) | None}.
    Returns None if the user quits.
    """
    typos = TypoChecker(i["text"] for i in items if i["rot"])
    entries, used = {}, set()
    accept_all = False

    for item in items:
        key = (item["grade"], item["unit"], item["rot"])
        entry = entries.setdefault(key, {"terms": [], "notes": [], "inherits": None})
        text = item["text"]

        if EXAMPLE_RE.match(text):
            report["ignored"].append(f"{decision_key(item)}")
            continue
        m = SAME_AS_RE.match(text)
        if m and item["rot"]:
            entry["inherits"] = (m.group(1), m.group(2))
            continue

        dkey = decision_key(item)
        decision = decisions.get(dkey)
        if decision:
            used.add(dkey)
        else:
            flag = find_flag(item, typos)
            if flag:
                if not flag.get("typo"):
                    report["needs_review"] = True
                if accept_all or not interactive:
                    report["unreviewed"].append(f"{dkey}  ({flag['why']})")
                    decision = {"action": "keep"}
                else:
                    try:
                        answer = ask(item, flag)
                    except (EOFError, KeyboardInterrupt):
                        answer = "quit"            # Ctrl-D / Ctrl-C keep what's been chosen so far
                    if answer == "quit":
                        return None
                    if answer == "accept-all":
                        accept_all = True
                        answer = "skip"
                    if answer == "skip":
                        report["unreviewed"].append(f"{dkey}  ({flag['why']})")
                        decision = {"action": "keep"}
                    else:
                        decision = dict(answer, decided=date.today().isoformat())
                        decisions[dkey] = decision
                        used.add(dkey)

        action = (decision or {}).get("action", "keep")
        if action == "drop":
            continue
        if action == "fix":
            text = decision["to"]
        if item["rot"] is None:
            # Only reachable if kept: there's no rotation to file it under.
            report["unreviewed"].append(f"{dkey}  (kept, but has no rotation -- left out)")
            report["needs_review"] = True
            continue
        if action == "note":
            note = {"text": text}
            if item["link"]:
                note["link"] = item["link"]
            entry["notes"].append(note)
        else:
            entry["terms"].append(text)

    return entries, used


def resolve(entries, report):
    """Expand "*Same as" lines and drop duplicates; return the keyterms.json grades tree."""

    def own_and_inherited(key, seen):
        entry = entries.get(key)
        if not entry:
            return []
        terms = list(entry["terms"])
        if entry["inherits"]:
            target = (entry["inherits"][0], entry["inherits"][1], key[2])
            if target in seen:
                report["problems"].append(f"{key[0]}.{key[1]} {key[2]}: 'Same as' loops back on itself")
            elif target not in entries:
                report["problems"].append(
                    f"{key[0]}.{key[1]} {key[2]}: 'Same as {target[0]}.{target[1]}' -- no such list")
            else:
                terms += own_and_inherited(target, seen | {key})
        return terms

    grades = {}
    for key in sorted(entries, key=lambda k: (int(k[0]), int(k[1]), ROTATION_ORDER.index(k[2]) if k[2] else -1)):
        grade, unit, rot = key
        if rot is None:
            continue
        terms, seen_terms = [], set()
        for term in own_and_inherited(key, set()):
            if term.lower() in seen_terms:
                report["duplicates"].append(f"{grade}.{unit} {rot}: {term}")
                continue
            seen_terms.add(term.lower())
            terms.append(term)
        notes = entries[key]["notes"]
        if not terms and not notes:
            report["empty"].append(f"{grade}.{unit} {rot}")
            continue
        out = {"terms": terms}
        if notes:
            out["notes"] = notes
        grades.setdefault(grade, {}).setdefault(unit, {})[rot] = out
    return grades


# ------------------------------------------------------------------ output --

def diff(old, new):
    lines = []
    old_g, new_g = old.get("grades", {}), new["grades"]
    for grade in sorted(set(old_g) | set(new_g), key=int):
        units_old, units_new = old_g.get(grade, {}), new_g.get(grade, {})
        for unit in sorted(set(units_old) | set(units_new), key=int):
            rots_old, rots_new = units_old.get(unit, {}), units_new.get(unit, {})
            for rot in ROTATION_ORDER:
                a, b = rots_old.get(rot, {}), rots_new.get(rot, {})
                if a == b:
                    continue
                ta, tb = a.get("terms", []), b.get("terms", [])
                na = [n["text"] for n in a.get("notes", [])]
                nb = [n["text"] for n in b.get("notes", [])]
                lines.append(f"  {grade}.{unit} {rot}:")
                lines += [f"    + {t}" for t in tb if t not in ta]
                lines += [f"    - {t}" for t in ta if t not in tb]
                lines += [f"    + note: {t}" for t in nb if t not in na]
                lines += [f"    - note: {t}" for t in na if t not in nb]
                if set(ta) == set(tb) and set(na) == set(nb):
                    lines.append("    (reordered)")
    return lines


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, sort_keys=False)
        f.write("\n")


def print_section(title, lines):
    if lines:
        print(f"\n{title} ({len(lines)}):")
        for line in lines:
            print("  " + line)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true", help="show what would change; write nothing")
    ap.add_argument("--html-dir", help="read 9th.html/10th.html/11th.html from here instead of fetching")
    ap.add_argument("--prune", action="store_true", help="remove saved decisions that no longer match")
    ap.add_argument("--no-input", action="store_true", help="never prompt (default when not on a terminal)")
    ap.add_argument("--fail-on-review", action="store_true",
                    help="exit 3 after writing if a line needs review (other than a possible typo) "
                         "or the layout looks off")
    args = ap.parse_args()
    interactive = sys.stdin.isatty() and not args.no_input

    try:
        pages = load_pages(args.html_dir)
    except Exception as e:  # noqa: BLE001 -- any fetch failure means stop
        sys.exit(f"Couldn't load the key terms pages: {e}\nNothing was written.")

    items, problems = [], []
    for grade, html in pages.items():
        page_items, page_problems = parse_page(grade, html)
        items += page_items
        problems += page_problems
    if any("no 'Unit N' headers" in p for p in problems):
        print("\n".join(problems))
        sys.exit("Nothing was written.")

    decisions = load_json(DECISIONS_PATH, {})
    decisions_before = json.dumps(decisions, sort_keys=True)
    report = {"problems": problems, "ignored": [], "unreviewed": [], "duplicates": [], "empty": [],
              "needs_review": False}

    built = build(items, decisions, interactive, report)
    if built is None:
        if not args.dry_run and json.dumps(decisions, sort_keys=True) != decisions_before:
            save_json(DECISIONS_PATH, dict(sorted(decisions.items())))
            print(f"\nStopped. Choices so far saved to {os.path.relpath(DECISIONS_PATH, ROOT)}; nothing else written.")
        else:
            print("\nStopped. Nothing written.")
        return
    entries, used = built

    stale = sorted(k for k in decisions if k not in used)
    if args.prune:
        for k in stale:
            del decisions[k]

    new = {
        "_comment": "Generated by tools/scrape_keyterms.py from the DPEA Portfolios key terms pages. "
                    "Edit the Google Sites pages (or tools/keyterms-decisions.json) and re-run; don't edit this file.",
        "source": {g: PAGE_URL.format(n) for g, n in GRADES.items()},
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "grades": resolve(entries, report),
    }
    old = load_json(OUT_PATH, {})

    print_section("Layout problems", report["problems"])
    print_section("Ignored 'Example' lines", report["ignored"])
    print_section("Duplicates removed", report["duplicates"])
    print_section("Empty rotations (generator shows its usual link)", report["empty"])
    print_section("Flagged but kept as-is -- run again on a terminal to review", report["unreviewed"])
    if stale:
        print_section("Saved choices that no longer match anything" + (" (removed)" if args.prune else
                      " -- run with --prune to remove"), stale)

    changes = diff(old, new)
    counts = sum(len(rots) for units in new["grades"].values() for rots in units.values())
    print(f"\n{counts} word banks across grades {', '.join(new['grades'])}.")
    if changes:
        print("Changes from the current keyterms.json:" if old else "New keyterms.json:")
        print("\n".join(changes) if old else f"  {counts} word banks")
    else:
        print("No changes to the word banks.")

    if args.dry_run:
        print("\nDry run -- nothing written.")
        return
    if json.dumps(decisions, sort_keys=True) != decisions_before:
        save_json(DECISIONS_PATH, dict(sorted(decisions.items())))
        print(f"Saved choices to {os.path.relpath(DECISIONS_PATH, ROOT)}.")
    if changes:
        if interactive and input("\nWrite keyterms.json? [Y/n] ").strip().lower().startswith("n"):
            print("Not written.")
            return
        save_json(OUT_PATH, new)
        print("Wrote keyterms.json.")
    # The word banks are written either way -- a flagged line ships as-is, like
    # a manual run's "keep" -- but a scheduled run should still get noticed.
    # Possible typos alone don't count; see the module docstring.
    if args.fail_on_review and (report["needs_review"] or report["problems"]):
        sys.exit(3)


if __name__ == "__main__":
    main()
