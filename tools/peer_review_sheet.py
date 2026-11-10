#!/usr/bin/env python3
"""Turn peer-review-status.json into a spreadsheet for mentors: one tab each.

Each mentor's tab lists their students alphabetically, in two sections:

  Reviews of your students    who reviewed each student's post, and what they said
  Reviews your students wrote what each student said about their partner's post

Every row links to the Canvas submission: the student's post, or the review
the reviewer handed in. Scores are pulled out of the comment the Peer Review
tile composes; the full comment is in the Feedback column.

Usage
-----
    # 1. the status report, reading reviews from both assignments
    python3 tools/assign_peer_reviews.py pairings.json --course N --assignment M \\
        --also B --status

    # 2. the spreadsheet. Mentors come from the posts themselves (seniors pick
    #    one on each 12th-grade post), so point it at the unzipped submissions download:
    python3 tools/peer_review_sheet.py peer-review-status.json --posts ~/Downloads/submissions

    # posts made before the mentor field existed carry none; fill the gaps from
    # a roster with first name, last name and mentor columns (.xlsx or .csv):
    python3 tools/peer_review_sheet.py peer-review-status.json --posts DIR --mentors roster.xlsx

    # --template writes a student,mentor CSV of everyone, filled in from the
    # posts and roster, to check or finish by hand and feed back to --mentors:
    python3 tools/peer_review_sheet.py peer-review-status.json --mentors roster.xlsx --template mentors.csv
    python3 tools/peer_review_sheet.py peer-review-status.json --posts DIR --mentors mentors.csv

The roster wins over a post when both name a mentor, so it's also how to correct
one. Mentors are matched to the MENTORS list in shared.js ("Mr. Woods" ->
"Woods"). Students with no mentor from either land on a "No mentor" tab.

Needs openpyxl (pip3 install openpyxl). Like the status report, the output
holds student names and comments: it's gitignored, keep it off shared drives
mentors shouldn't see.
"""
import argparse, csv, json, os, re, sys, unicodedata
from datetime import datetime

try:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
except ImportError:
    sys.exit("This needs openpyxl:  pip3 install openpyxl")

NO_MENTOR = "No mentor"


def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def name_keys(name, sort=""):
    keys = {norm(name), norm(sort)}
    if "," in sort:
        last, _, first = sort.partition(",")
        keys.add(norm(first + last))
    return {k for k in keys if k}


# ---- who the students are ---------------------------------------------------
def roster(status):
    """{canvas user id: {name, sort, sid}} for everyone the report mentions."""
    sids = {int(k): v for k, v in (status.get("students") or {}).items()}
    out = {}
    for r in status["reviews"]:
        for role in ("author", "reviewer"):
            uid = r[role + "Id"]
            out.setdefault(uid, {"name": r[role], "sort": r.get(role + "Sort") or r[role],
                                 "sid": sids.get(uid, "")})
    for s in status.get("unassignedStudents") or []:
        out.setdefault(s["id"], {"name": s["name"], "sort": s.get("sort") or s["name"],
                                 "sid": s.get("sid") or sids.get(s["id"], "")})
    return out


def read_posts(folder, people):
    """{canvas user id: {mentor, periods}} from the posts' own embedded data.

    A post is matched to a student by its 6-digit ID first, then by the ids
    Canvas put in the download filename -- the same signals pair.html uses.
    """
    by_sid = {p["sid"]: uid for uid, p in people.items() if p["sid"]}
    out, unmatched = {}, []
    for fn in sorted(os.listdir(folder)):
        if not re.search(r"\.html?$", fn, re.I):
            continue
        try:
            text = open(os.path.join(folder, fn), encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        m = re.search(r'<script[^>]*id="portfolio-data"[^>]*>(.*?)</script>', text, re.S)
        if not m:
            continue
        try:
            meta = (json.loads(m.group(1)) or {}).get("meta") or {}
        except ValueError:
            continue
        uid = by_sid.get(str(meta.get("sid") or "").strip())
        if uid is None:
            for n in re.findall(r"_(\d+)", fn.split(".")[0]):
                if int(n) in people:
                    uid = int(n)
                    break
        if uid is None:
            unmatched.append(fn)
            continue
        info = out.setdefault(uid, {})
        if meta.get("mentor"):
            info["mentor"] = meta["mentor"].strip()
        if meta.get("periods"):
            info["periods"] = meta["periods"]
    return out, unmatched


def known_mentors():
    """The MENTORS list from shared.js, so a roster's "Mr. Woods" becomes "Woods"."""
    try:
        js = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared.js")).read()
        return re.findall(r'"([^"]+)"', re.search(r"const MENTORS=\[(.*?)\]", js).group(1))
    except (OSError, AttributeError):
        return []


def canonical_mentor(value, mentors):
    """Match a mentor as written in a roster to the hub's spelling, if possible."""
    v = norm(re.sub(r"(?i)^(mr|mrs|ms|mx|dr)\.?\s+", "", value.strip()))
    for m in mentors:
        if norm(m) == v or norm(m) in v.split() or v.endswith(norm(m)):
            return m
    return value.strip()


def read_table(path, sheet=None):
    """Rows of a .csv or .xlsx as lists of strings (first sheet unless named)."""
    if path.lower().endswith((".xlsx", ".xlsm")):
        from openpyxl import load_workbook
        wb = load_workbook(path, read_only=True, data_only=True)
        if sheet and sheet not in wb.sheetnames:
            sys.exit(f"{path} has no sheet {sheet!r}; it has {', '.join(wb.sheetnames)}")
        ws = wb[sheet] if sheet else wb.worksheets[0]
        cell = lambda v: "" if v is None else (str(int(v)) if isinstance(v, float) and v.is_integer() else str(v).strip())
        return [[cell(v) for v in row] for row in ws.iter_rows(values_only=True)]
    with open(path, newline="", encoding="utf-8-sig") as f:
        return [[c.strip() for c in row] for row in csv.reader(f)]


def read_mentor_table(path, people):
    """{canvas user id: mentor} from a roster: .csv or .xlsx.

    Either a  student,mentor  table (student = Canvas name, 6-digit ID or Canvas
    user id -- what --template writes), or a roster with separate first name,
    last name and mentor columns. Columns are found by their header, wherever
    the header row is.

    Returns (matches, unmatched names, ambiguous names, mentor values that
    aren't on the hub's MENTORS list).
    """
    rows = read_table(path)
    head_at, cols = None, {}
    for i, row in enumerate(rows[:20]):
        low = [c.lower() for c in row]
        find = lambda *words: next((j for j, c in enumerate(low) if any(w in c for w in words)), None)
        m = find("mentor")
        if m is None:
            continue
        cols = {"mentor": m, "first": find("first"), "last": find("last"),
                "student": find("student", "name", "id")}
        if cols["first"] is not None and cols["last"] is not None or cols["student"] is not None:
            head_at = i
            break
    if head_at is None:
        sys.exit(f"{path}: couldn't find a header row with a mentor column and either "
                 "first/last name columns or a student column.")

    exact, loose = {}, {}
    for uid, p in people.items():
        exact[str(uid)] = {uid}
        if p["sid"]:
            exact[p["sid"]] = {uid}
        for k in name_keys(p["name"], p["sort"]):
            exact.setdefault(k, set()).add(uid)
        # first word + last word, so a roster without middle names still matches
        words = p["name"].split()
        if len(words) >= 2:
            loose.setdefault(norm(words[0] + words[-1]), set()).add(uid)

    mentors = known_mentors()
    out, missed, ambiguous, odd = {}, [], [], set()
    get = lambda row, k: row[cols[k]] if cols[k] is not None and cols[k] < len(row) else ""
    for row in rows[head_at + 1:]:
        mentor = get(row, "mentor")
        if cols["first"] is not None and cols["last"] is not None:
            who = f"{get(row, 'first')} {get(row, 'last')}".strip()
            keys = [norm(get(row, "first") + get(row, "last"))]
        else:
            who = get(row, "student")
            keys = [who, norm(who)]
        if not who or not mentor:
            continue
        hits = next((exact[k] for k in keys if k in exact), None) or loose.get(keys[-1])
        if not hits:
            missed.append(who)
        elif len(hits) > 1:
            ambiguous.append(who)
        else:
            m = canonical_mentor(mentor, mentors)
            if mentors and m not in mentors:
                odd.add(m)
            out[next(iter(hits))] = m
    return out, missed, ambiguous, sorted(odd)


# ---- reading a review -------------------------------------------------------
SCORE = re.compile(r"Peer score:\s*([\d.]+)")
SECTION_SCORES = (("Project update", r"PROJECT UPDATE\s*[—-]\s*([\d.]+)"),
                  ("Reflection", r"REFLECTION\s*[—-]\s*([\d.]+)"),
                  ("File mgmt", r"FILE MANAGEMENT\s*[—-]\s*([\d.]+)"))


def best_comment(r):
    """The comment that counted -- the one closest to the composer's format."""
    good = [c for c in r["comments"] if (c.get("text") or "").strip()]
    if not good:
        return None
    # Same rule as --status: the fewest problems wins, latest on a tie.
    from assign_peer_reviews import check_comment
    return min(reversed(good), key=lambda c: len(check_comment(c["text"], r["author"])))


def scores(text):
    num = lambda m: float(m.group(1)) if m else None
    return [num(SCORE.search(text or ""))] + [num(re.search(p, text or "")) for _, p in SECTION_SCORES]


def status_text(r):
    if r["verdict"] == "ok":
        return "Done"
    if r["verdict"] == "flag":
        return "Check: " + "; ".join(r["problems"])
    return "Not done"


# ---- writing ----------------------------------------------------------------
TITLE = dict(font=Font(bold=True, color="FFFFFF", size=12), fill=PatternFill("solid", fgColor="2E5496"))
SECTION = dict(font=Font(bold=True, color="1F3864"), fill=PatternFill("solid", fgColor="D6E0F0"))
HEAD = dict(font=Font(bold=True), fill=PatternFill("solid", fgColor="D9D9D9"))
LINK = Font(color="0563C1", underline="single")
TOP = Alignment(vertical="top", wrap_text=True)

COLS = ("Student", "Period", "Post", "Peer reviewer", "Review", "Status",
        "Peer score", "Project update", "Reflection", "File mgmt", "Feedback")
WIDTHS = (24, 8, 10, 24, 10, 22, 10, 14, 11, 10, 90)


def style(cell, s):
    cell.font, cell.fill = s["font"], s["fill"]


def band(ws, row, text, s):
    ws.cell(row, 1, text)
    for c in range(1, len(COLS) + 1):
        style(ws.cell(row, c), s)
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=len(COLS))


def link(ws, row, col, url, label):
    cell = ws.cell(row, col, label if url else "")
    if url:
        cell.hyperlink, cell.font = url, LINK


def main():
    ap = argparse.ArgumentParser(description="Peer reviews as a spreadsheet, one tab per mentor")
    ap.add_argument("status", help="peer-review-status.json from assign_peer_reviews.py --status")
    ap.add_argument("--posts", metavar="DIR", help="unzipped Canvas submissions download (mentors and periods come from here)")
    ap.add_argument("--mentors", metavar="FILE", help="roster .xlsx/.csv with first name, last name and mentor "
                    "columns (or a student,mentor CSV); fills gaps and overrides posts")
    ap.add_argument("--template", metavar="CSV", help="write a student,mentor CSV of everyone, mentors filled in where known, then stop")
    ap.add_argument("--canvas", help="Canvas base URL, if the status report predates it carrying one")
    ap.add_argument("--out", help="where to write the .xlsx (default: peer-reviews-<assignment>.xlsx)")
    args = ap.parse_args()

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    status = json.load(open(args.status))
    if status.get("kind") != "peer-review-status":
        sys.exit(f"{args.status} isn't a peer-review status report.")
    people = roster(status)

    posts, unmatched = ({}, [])
    if args.posts:
        posts, unmatched = read_posts(args.posts, people)
        print(f"Read {len(posts)} posts from {args.posts}"
              f" ({sum(1 for p in posts.values() if p.get('mentor'))} name a mentor)")
        if unmatched:
            print(f"  ! {len(unmatched)} post(s) matched no student in the report:")
            for fn in unmatched:
                print(f"      {fn}")
    mentor = {uid: p["mentor"] for uid, p in posts.items() if p.get("mentor")}
    if args.mentors:
        extra, missed, ambiguous, odd = read_mentor_table(args.mentors, people)
        changed = sum(1 for uid, m in extra.items() if mentor.get(uid) not in (None, m))
        mentor.update(extra)
        print(f"Read {len(extra)} mentor(s) from {args.mentors}" + (f", {changed} overriding a post" if changed else ""))
        for who in missed:
            print(f"  ! {who!r} in {args.mentors} matches nobody in the report")
        for who in ambiguous:
            print(f"  ! {who!r} in {args.mentors} matches more than one student — skipped")
        if odd:
            print(f"  ! not on the hub's MENTORS list (shared.js): {', '.join(odd)}")

    order = sorted(people, key=lambda u: people[u]["sort"].lower())
    if args.template:
        with open(args.template, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["student", "mentor"])
            for uid in order:
                w.writerow([people[uid]["name"], mentor.get(uid, "")])
        print(f"Wrote {args.template}: {len(order)} students, {sum(1 for u in order if u not in mentor)} without a mentor.")
        print("Fill in the blanks, then run again with --mentors.")
        return 0

    base = (status.get("canvas") or args.canvas or "").rstrip("/")
    course, main_a = status["course"]["id"], status["assignment"]["id"]
    sub_url = lambda a, uid: f"{base}/courses/{course}/assignments/{a}/submissions/{uid}" if base else ""

    def period(uid, r=None):
        ps = (posts.get(uid) or {}).get("periods")
        if ps:
            return ", ".join(map(str, ps))
        m = re.search(r"Period\s+([\d, ]+)", (r or {}).get("schedule") or "")
        return m.group(1).strip() if m else ""

    received, wrote = {}, {}
    for r in status["reviews"]:
        received.setdefault(r["authorId"], []).append(r)
        wrote.setdefault(r["reviewerId"], []).append(r)

    groups = {}
    for uid in order:
        groups.setdefault(mentor.get(uid, NO_MENTOR), []).append(uid)
    names = sorted((m for m in groups if m != NO_MENTOR), key=str.lower)
    if NO_MENTOR in groups:
        names.append(NO_MENTOR)

    title = status["assignment"].get("name") or f"Assignment {main_a}"
    wb = Workbook()
    summary = wb.active
    summary.title = "Summary"
    summary.append([f"Peer reviews — {title}"])
    style(summary["A1"], TITLE)
    summary.append([f"From the status report of {status.get('generated', '')[:16].replace('T', ' ')}"])
    summary.append([])
    summary.append(["Mentor", "Students", "Posts reviewed", "Reviews written", "Not done"])
    for c in range(1, 6):
        style(summary.cell(4, c), HEAD)

    for m in names:
        uids = groups[m]
        ws = wb.create_sheet(re.sub(r"[\[\]:*?/\\]", "", m)[:31])
        band(ws, 1, f"Mentor: {m} — {title}", TITLE)
        row = 3
        for heading, source, who_col in (("Reviews of your students", received, "author"),
                                         ("Reviews your students wrote", wrote, "reviewer")):
            band(ws, row, heading, SECTION)
            row += 1
            cols = COLS if who_col == "author" else \
                ("Student", "Period", "Their review", "Reviewed", "Partner's post") + COLS[5:]
            for c, h in enumerate(cols, 1):
                ws.cell(row, c, h)
                style(ws.cell(row, c), HEAD)
            row += 1
            for uid in uids:
                rs = source.get(uid) or [None]
                for r in rs:
                    ws.cell(row, 1, people[uid]["name"])
                    ws.cell(row, 2, period(uid, r))
                    if r is None:
                        ws.cell(row, 6, "No reviewer assigned" if who_col == "author" else "No review assigned")
                        if who_col == "author":
                            link(ws, row, 3, sub_url(main_a, uid), "Open")
                        row += 1
                        continue
                    c = best_comment(r)
                    review_url = sub_url(c.get("where", main_a), r["reviewerId"] if c.get("where", str(main_a)) != str(main_a)
                                         else r["authorId"]) if c else ""
                    if who_col == "author":
                        link(ws, row, 3, sub_url(main_a, uid), "Open")
                        ws.cell(row, 4, r["reviewer"])
                        link(ws, row, 5, review_url, "Open")
                    else:
                        link(ws, row, 3, review_url, "Open")
                        ws.cell(row, 4, r["author"])
                        link(ws, row, 5, sub_url(main_a, r["authorId"]), "Open")
                    ws.cell(row, 6, status_text(r))
                    for i, v in enumerate(scores(c["text"] if c else ""), 7):
                        ws.cell(row, i, v)
                    ws.cell(row, 11, c["text"] if c else "")
                    row += 1
            row += 1
        for i, w in enumerate(WIDTHS, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
        for line in ws.iter_rows(min_row=3):
            for cell in line:
                if cell.font != LINK:
                    cell.alignment = TOP

        got = sum(1 for u in uids for r in received.get(u, []) if r["verdict"] != "missing")
        gave = sum(1 for u in uids for r in wrote.get(u, []) if r["verdict"] != "missing")
        notdone = sum(1 for u in uids for r in wrote.get(u, []) if r["verdict"] == "missing")
        summary.append([m, len(uids), got, gave, notdone])

    summary.column_dimensions["A"].width = 22
    for col in "BCDE":
        summary.column_dimensions[col].width = 16

    out = args.out or f"peer-reviews-{main_a}.xlsx"
    wb.save(out)
    print(f"\nWrote {out}: {len(names)} tab(s) after Summary")
    for m in names:
        print(f"  {m:<16} {len(groups[m])} students")
    if NO_MENTOR in groups:
        print(f"  ! {len(groups[NO_MENTOR])} student(s) have no mentor. --template writes a CSV to fill in.")
    if not base:
        print("  ! No Canvas URL in the report, so there are no links. Pass --canvas https://….instructure.com")
    return 0


if __name__ == "__main__":
    sys.exit(main())
