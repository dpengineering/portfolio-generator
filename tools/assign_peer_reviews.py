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

    # check the token, course and assignment setup first
    python3 tools/assign_peer_reviews.py pairings.json --course 1234 --assignment 5678 --check

    # actually assign them
    python3 tools/assign_peer_reviews.py pairings.json --course 1234 --assignment 5678 --apply

The assignment must have peer reviews turned ON (Edit assignment -> Require Peer
Reviews -> Manually Assign). Leave it on manual: letting Canvas assign
automatically would ignore rotations and periods entirely.

Students are matched by their 6-digit Canvas student ID, which posts carry once
the student has entered it on the hub. Posts made before that fall back to
matching on the name they typed, which doesn't always match Canvas -- anything
that can't be matched confidently is listed for you to fix rather than guessed
at.

Run --check first to confirm the token works and the assignment is set up right.
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
    """Three lookups: student number, Canvas user id, and name."""
    by_sid, by_uid, by_name = {}, {}, {}
    for s in students:
        # Canvas exposes the student number as sis_user_id when the token may
        # read SIS data, and otherwise often as login_id.
        for field in ("sis_user_id", "login_id", "integration_id"):
            v = str(s.get(field) or "").strip()
            if re.fullmatch(r"\d{6}", v):
                by_sid.setdefault(v, set()).add(s["id"])
        by_uid.setdefault(str(s["id"]), set()).add(s["id"])
        for k in name_keys(s):
            # a name shared by two students is ambiguous, so remember that
            by_name.setdefault(k, set()).add(s["id"])
    return by_sid, by_uid, by_name


def pick(hits, what):
    if not hits:
        return None, f"no Canvas student with that {what}"
    if len(hits) > 1:
        return None, f"{what} matches {len(hits)} students in Canvas"
    return next(iter(hits)), None


def resolve(entry, role, idx):
    """Work through every signal we have, most reliable first.

    The strong ones all come from Canvas itself -- the student number, and the
    ids and name Canvas wrote into the download filename -- so they match the
    roster exactly. The name a student typed into the generator is the last
    resort, because that's the one that drifts.

    Returns (canvas_user_id, problem_or_None, how_it_matched).
    """
    by_sid, by_uid, by_name = idx
    tried = []

    sid = str(entry.get(role + "Sid") or "").strip()
    if sid:
        who, why = pick(by_sid.get(sid), "student ID")
        if who:
            return who, None, "student ID"
        tried.append(f"ID {sid}: {why}")

    # Which number Canvas puts where isn't documented, so try each as both.
    for n in entry.get(role + "Ids") or []:
        n = str(n).strip()
        who, _ = pick(by_uid.get(n), "Canvas id")
        if who:
            return who, None, "Canvas id in filename"
        who, _ = pick(by_sid.get(n), "student number")
        if who:
            return who, None, "student number in filename"

    # Canvas builds this from its own sortable_name, so it matches exactly.
    key = (entry.get(role + "NameKey") or "").strip()
    if key:
        who, why = pick(by_name.get(norm(key)), "name from the filename")
        if who:
            return who, None, "name in filename"
        tried.append(f"filename name '{key}': {why}")

    name = entry.get(role) or ""
    if name:
        who, why = pick(by_name.get(norm(name)), "name")
        if who:
            return who, None, "name typed in the post"
        tried.append(f"typed name '{name}': {why}")

    return None, "; ".join(tried) or "nothing to match on", None


# ---- preflight --------------------------------------------------------------
def preflight(base, token, course, assignment):
    """Confirm the token, course and assignment are usable before touching anything."""
    ok = True
    try:
        me, _ = api(base, token, "/api/v1/users/self")
        print(f"Token works — signed in as {me.get('name','?')}")
    except urllib.error.HTTPError as e:
        sys.exit(f"Token rejected ({e.code} {e.reason}). Check CANVAS_URL and CANVAS_TOKEN.")

    try:
        c, _ = api(base, token, f"/api/v1/courses/{course}")
        print(f"Course {course}: {c.get('name','?')}")
    except urllib.error.HTTPError as e:
        sys.exit(f"Can't read course {course} ({e.code} {e.reason}).")

    try:
        a, _ = api(base, token, f"/api/v1/courses/{course}/assignments/{assignment}")
    except urllib.error.HTTPError as e:
        sys.exit(f"Can't read assignment {assignment} ({e.code} {e.reason}).")
    print(f"Assignment {assignment}: {a.get('name','?')}")

    if not a.get("peer_reviews"):
        print("  ! Peer reviews are OFF for this assignment.")
        print("    Edit the assignment -> tick 'Require Peer Reviews'.")
        ok = False
    elif a.get("automatic_peer_reviews"):
        print("  ! Peer reviews are set to assign AUTOMATICALLY.")
        print("    Canvas would ignore rotations and periods. Switch it to 'Manually Assign'.")
        ok = False
    else:
        print("  Peer reviews: on, manually assigned ✓")

    students = api_list(base, token, f"/api/v1/courses/{course}/users",
                        {"enrollment_type[]": "student", "enrollment_state[]": "active"})
    by_sid = build_index(students)[0]
    print(f"Roster: {len(students)} active students, {len(by_sid)} with a 6-digit ID")
    if students and not by_sid:
        print("  ! No student IDs visible. The token may lack permission to read SIS data,")
        print("    so pairings will have to be matched by name. That still works.")

    print("\nReady." if ok else "\nFix the items marked ! before running with --apply.")
    return 0 if ok else 1


# ---- main -------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Assign Canvas peer reviews from pairings.json")
    ap.add_argument("pairings", nargs="?", help="pairings.json exported from pair.html (not needed with --check)")
    ap.add_argument("--course", required=True, help="Canvas course id")
    ap.add_argument("--assignment", required=True, help="Canvas assignment id")
    ap.add_argument("--apply", action="store_true", help="actually assign (default is a dry run)")
    ap.add_argument("--check", action="store_true",
                    help="check the token, course and assignment setup, then stop")
    args = ap.parse_args()

    base, token = os.environ.get("CANVAS_URL"), os.environ.get("CANVAS_TOKEN")
    if not base or not token:
        sys.exit("Set CANVAS_URL and CANVAS_TOKEN first (see the docstring at the top of this file).")

    if args.check:
        return preflight(base, token, args.course, args.assignment)
    if not args.pairings:
        sys.exit("Give me a pairings.json (or run --check on its own).")

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
    by_sid = idx[0]
    print(f"  {len(students)} active students, {len(by_sid)} with a 6-digit ID\n")

    # Names for the printout come from Canvas, not from the pairing file.
    label = {s["id"]: s.get("name") or s["id"] for s in students}

    planned, problems, how = [], [], {}
    for r in reviews:
        reviewer_id, why_r, via_r = resolve(r, "reviewer", idx)
        author_id, why_a, via_a = resolve(r, "author", idx)
        for who_id, why, via in ((reviewer_id, why_r, via_r), (author_id, why_a, via_a)):
            if why:
                problems.append(why)
            elif via:
                how[via] = how.get(via, 0) + 1
        if reviewer_id and author_id:
            if reviewer_id == author_id:
                problems.append(f"{label.get(reviewer_id, reviewer_id)} would review their own post — skipped")
            else:
                planned.append((r, reviewer_id, author_id))

    for r, reviewer_id, author_id in planned:
        print(f"  {r.get('schedule',''):<22} {label[reviewer_id]} → {label[author_id]}")

    if how:
        print("\nMatched by: " + ", ".join(f"{v}× {k}" for k, v in sorted(how.items(), key=lambda x: -x[1])))

    if problems:
        print(f"\n{len(set(problems))} couldn't be matched:")
        for p in sorted(set(problems)):
            print(f"  ! {p}")
        print("  (fix it in Canvas or in pairings.json, then run again)")

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
            print(f"  ! {label[reviewer_id]} → {label[author_id]}: {e.code} {e.reason}{detail}")
    print(f"\nAssigned {ok} of {len(planned)}.")


if __name__ == "__main__":
    main()
