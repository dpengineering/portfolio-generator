#!/usr/bin/env python3
"""Assign Canvas peer reviews from pairings.json (produced by pair.html).

Runs on your machine against your Canvas course. Student names and ids stay
between this script and Canvas -- nothing is sent anywhere else.

Why the split: pair.html does the pairing in the browser without needing a
roster, because every post carries its own rotation/period. Turning a name into
a Canvas user id is the one step that needs the authoritative roster, so it
happens here, where the roster actually lives, instead of being guessed at from
a download filename.

Usage
-----
    export CANVAS_URL=https://yourdistrict.instructure.com
    export CANVAS_TOKEN=...                 # Account -> Settings -> New Access Token

    # see what it would do -- this is the default, nothing is written
    python3 tools/assign_peer_reviews.py pairings.json --course 1234 --assignment 5678

    # actually assign them
    python3 tools/assign_peer_reviews.py pairings.json --course 1234 --assignment 5678 --apply

The assignment must have peer reviews turned ON (Edit assignment -> Require Peer
Reviews -> Manually Assign). Leave it on manual: letting Canvas assign
automatically would ignore rotations and periods entirely.

Names come from what students typed into the generator, so they don't always
match Canvas exactly. Anything this can't match confidently is listed for you to
fix by hand rather than guessed at.
"""
import argparse, json, os, re, sys, unicodedata
import urllib.error, urllib.parse, urllib.request

TIMEOUT = 30


# ---- Canvas -----------------------------------------------------------------
def api(base, token, path, params=None, method="GET", data=None):
    url = base.rstrip("/") + path
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        payload = json.loads(r.read() or "null")
        return payload, r.headers.get("Link", "")


def api_list(base, token, path, params=None):
    """GET every page of a paginated Canvas collection."""
    out, params = [], dict(params or {}, per_page=100)
    page = 1
    while True:
        items, link = api(base, token, path, dict(params, page=page))
        if not items:
            break
        out.extend(items)
        if 'rel="next"' not in link:
            break
        page += 1
    return out


# ---- name matching ----------------------------------------------------------
def norm(s):
    """Fold case, accents and punctuation so 'J. O'Brien-Smith' == 'jobriensmith'."""
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def name_keys(student):
    """The forms a Canvas student might be findable under."""
    keys = set()
    for field in ("name", "short_name", "sortable_name"):
        v = student.get(field)
        if not v:
            continue
        keys.add(norm(v))
        if "," in v:                                  # "Lovelace, Ada" -> "Ada Lovelace"
            last, _, first = v.partition(",")
            keys.add(norm(first + last))
    return keys


def build_index(students):
    idx = {}
    for s in students:
        for k in name_keys(s):
            # a name shared by two students is ambiguous, so remember that
            idx.setdefault(k, set()).add(s["id"])
    return idx


def resolve(name, idx):
    hits = idx.get(norm(name))
    if not hits:
        return None, "no Canvas student with that name"
    if len(hits) > 1:
        return None, f"matches {len(hits)} students in Canvas"
    return next(iter(hits)), None


# ---- main -------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Assign Canvas peer reviews from pairings.json")
    ap.add_argument("pairings", help="pairings.json exported from pair.html")
    ap.add_argument("--course", required=True, help="Canvas course id")
    ap.add_argument("--assignment", required=True, help="Canvas assignment id")
    ap.add_argument("--apply", action="store_true", help="actually assign (default is a dry run)")
    args = ap.parse_args()

    base, token = os.environ.get("CANVAS_URL"), os.environ.get("CANVAS_TOKEN")
    if not base or not token:
        sys.exit("Set CANVAS_URL and CANVAS_TOKEN first (see the docstring at the top of this file).")

    data = json.load(open(args.pairings))
    reviews = data.get("reviews") or []
    if not reviews:
        sys.exit(f"{args.pairings} has no reviews in it.")

    print(f"Fetching the roster for course {args.course}…")
    try:
        students = api_list(base, token, f"/api/v1/courses/{args.course}/users",
                            {"enrollment_type[]": "student", "enrollment_state[]": "active"})
    except urllib.error.HTTPError as e:
        sys.exit(f"Canvas said {e.code} {e.reason}. Check CANVAS_URL, the token, and the course id.")
    idx = build_index(students)
    print(f"  {len(students)} active students\n")

    planned, problems = [], []
    for r in reviews:
        reviewer_id, why_r = resolve(r["reviewer"], idx)
        author_id, why_a = resolve(r["author"], idx)
        if why_r:
            problems.append(f"{r['reviewer']} (reviewer) — {why_r}")
        if why_a:
            problems.append(f"{r['author']} (author) — {why_a}")
        if reviewer_id and author_id:
            if reviewer_id == author_id:
                problems.append(f"{r['reviewer']} would review their own post — skipped")
            else:
                planned.append((r, reviewer_id, author_id))

    for r, reviewer_id, author_id in planned:
        print(f"  {r['schedule']:<16} {r['reviewer']} → {r['author']}")

    if problems:
        print(f"\n{len(set(problems))} name(s) to sort out by hand:")
        for p in sorted(set(problems)):
            print(f"  ! {p}")
        print("  (fix the spelling in Canvas or in pairings.json, then run again)")

    print(f"\n{len(planned)} review(s) ready, {len(reviews) - len(planned)} skipped.")
    if not args.apply:
        print("Dry run — nothing was changed. Re-run with --apply to assign them.")
        return

    print("\nAssigning…")
    ok = 0
    for r, reviewer_id, author_id in planned:
        # The id in the URL is the student whose submission is being reviewed;
        # user_id in the body is the student doing the reviewing.
        path = (f"/api/v1/courses/{args.course}/assignments/{args.assignment}"
                f"/submissions/{author_id}/peer_reviews")
        try:
            api(base, token, path, method="POST", data={"user_id": reviewer_id})
            ok += 1
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = " " + e.read().decode()[:200]
            except Exception:
                pass
            print(f"  ! {r['reviewer']} → {r['author']}: {e.code} {e.reason}{detail}")
    print(f"\nAssigned {ok} of {len(planned)}.")


if __name__ == "__main__":
    main()
