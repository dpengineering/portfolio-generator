#!/usr/bin/env python3
"""Build the official mentor roster (mentors.csv) from two sheets.

    IDs sheet      student ID, first name, last name   (e.g. a Canvas/SIS export)
    Mentors sheet  first name, last name, mentor       (e.g. the Enterprise Groups roster)

The names are only used to join the two sheets. The output keys every student
by ID, so peer_review_sheet.py --mentors never has to match on a name again:

    student_id,name,mentor,note

Usage
-----
    python3 tools/build_mentor_roster.py --ids ids.xlsx --mentors groups.xlsx
    # both in one workbook, on different tabs:
    python3 tools/build_mentor_roster.py --ids roster.xlsx:IDs --mentors "roster.xlsx:Enterprise Groups"
    # then
    python3 tools/peer_review_sheet.py peer-review-status.json --mentors mentors.csv

Columns are found by their headers ("ID"/"Student ID"/"SIS ID", "First",
"Last", "Mentor"), wherever the header row is. A sheet with one "Name" or
"Student" column ("Ada Lovelace" or "Lovelace, Ada") works too.

Matching, most certain first: the full first+last name; then first word of the
first name + last word of the last name (middle names, two-part surnames);
then the preferred-name rule (same last name, one first name starts the other,
like Alex/Alexander). A match still has to be the only candidate. Anything less
certain is NOT filled in. It's left blank, with the closest names in the note
column, so a guess never becomes official. --accept-close fills those in
anyway; the note still says so.

Every student on the IDs sheet gets a row, mentor or not, so the blanks are the
to-do list. The output holds student names and IDs: mentors*.csv is gitignored.
"""
import argparse, csv, difflib, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from peer_review_sheet import canonical_mentor, known_mentors, norm, read_table


def split_source(spec):
    """'file.xlsx:Sheet name' -> (path, sheet). A plain path has no sheet."""
    m = re.match(r"^(.*\.xlsx?m?):(.+)$", spec, re.I)
    return (m.group(1), m.group(2)) if m else (spec, None)


def find_columns(rows, need, where):
    """Locate the header row and the columns we need in it.

    need: the roles required besides the name ("id" or "mentor"). Names come
    either as first + last columns or as one name column.
    """
    words = {"id": ("student id", "sis id", "user id", "sid", "id"),
             "mentor": ("mentor",),
             "first": ("first",), "last": ("last",),
             "name": ("student", "name")}
    for i, row in enumerate(rows[:25]):
        low = [c.lower().strip() for c in row]

        def find(role, skip=()):
            for w in words[role]:
                for j, c in enumerate(low):
                    if j in skip or not c:
                        continue
                    # "id" must be a whole word, or "midterm" would be an ID column
                    if (re.search(rf"\b{re.escape(w)}\b", c) if len(w) <= 3 else w in c):
                        return j
            return None

        cols = {r: find(r) for r in (need, "first", "last")}
        if cols[need] is None:
            continue
        if cols["first"] is None or cols["last"] is None:
            cols["first"] = cols["last"] = None
            cols["name"] = find("name", skip={cols[need]})
            if cols["name"] is None:
                continue
        return i, cols
    sys.exit(f"{where}: couldn't find a header row with a {need} column and first/last "
             "(or name) columns. Check the sheet, or name the right tab as FILE:SHEET.")


def people(rows, head, cols, need):
    """[(first, last, value_of_need)] from the rows under the header."""
    out = []
    get = lambda row, k: row[cols[k]].strip() if cols.get(k) is not None and cols[k] < len(row) else ""
    for row in rows[head + 1:]:
        if cols.get("name") is not None:
            full = get(row, "name")
            if "," in full:
                last, _, first = full.partition(",")
            else:
                first, _, last = full.rpartition(" ")
                if not first:
                    first, last = last, ""
        else:
            first, last = get(row, "first"), get(row, "last")
        value = get(row, need)
        if (first or last) or value:
            out.append((first.strip(), last.strip(), value))
    return out


def keys(first, last):
    """Match keys, strongest first."""
    f, l = first.split(), last.split()
    return [norm(first + last),
            norm((f[0] if f else "") + (l[-1] if l else ""))]


def main():
    ap = argparse.ArgumentParser(description="Join an ID sheet and a mentor sheet into mentors.csv")
    ap.add_argument("--ids", required=True, metavar="FILE[:SHEET]", help="sheet of student IDs, first and last names")
    ap.add_argument("--mentors", required=True, metavar="FILE[:SHEET]", help="sheet of first names, last names and mentors")
    ap.add_argument("--out", default="mentors.csv", help="default: %(default)s")
    ap.add_argument("--accept-close", action="store_true",
                    help="also fill in close-but-not-certain name matches (still marked in the note)")
    args = ap.parse_args()

    ipath, isheet = split_source(args.ids)
    mpath, msheet = split_source(args.mentors)
    irows, mrows = read_table(ipath, isheet), read_table(mpath, msheet)
    ihead, icols = find_columns(irows, "id", args.ids)
    mhead, mcols = find_columns(mrows, "mentor", args.mentors)
    students = [(f, l, i) for f, l, i in people(irows, ihead, icols, "id") if i]
    groups = [(f, l, m) for f, l, m in people(mrows, mhead, mcols, "mentor") if m and (f or l)]
    print(f"{args.ids}: {len(students)} students with an ID")
    print(f"{args.mentors}: {len(groups)} students with a mentor")

    dup = {i for i in {s[2] for s in students} if sum(1 for s in students if s[2] == i) > 1}
    if dup:
        print(f"  ! the same ID appears on more than one row: {', '.join(sorted(dup))}")

    # index the mentor sheet by each key; a key two students share is useless
    index = [{}, {}]
    for n, (f, l, m) in enumerate(groups):
        for level, k in enumerate(keys(f, l)):
            if k:
                index[level].setdefault(k, set()).add(n)
    by_last = {}
    for n, (f, l, m) in enumerate(groups):
        by_last.setdefault(norm(l.split()[-1] if l.split() else l), []).append(n)

    mentors = known_mentors()
    full_names = [f"{f} {l}".strip() for f, l, _ in groups]
    used, rows = {}, []
    for first, last, sid in students:
        hit, note = None, ""
        for level, k in enumerate(keys(first, last)):
            cand = index[level].get(k) or set()
            if len(cand) == 1:
                hit = next(iter(cand))
                note = "" if level == 0 else f"matched as {full_names[hit]}"
                break
            if len(cand) > 1:
                note = "several students on the mentor sheet share this name"
                break
        if hit is None and not note:
            # preferred names: same last name, and one first name starts the other
            fn = norm(first.split()[0] if first.split() else first)
            cand = [n for n in by_last.get(norm(last.split()[-1] if last.split() else last), [])
                    if fn and (norm(groups[n][0]).startswith(fn) or fn.startswith(norm(groups[n][0])))]
            if len(cand) == 1:
                hit, note = cand[0], f"matched as {full_names[cand[0]]} (preferred name)"
        if hit is None and not note:
            close = difflib.get_close_matches(f"{first} {last}", full_names, n=3, cutoff=0.75)
            if close:
                if args.accept_close and len(close) == 1:
                    hit = full_names.index(close[0])
                    note = f"CLOSE MATCH, check: {close[0]}"
                else:
                    note = "not found; closest: " + "; ".join(close)
            else:
                note = "not on the mentor sheet"
        mentor = ""
        if hit is not None:
            mentor = canonical_mentor(groups[hit][2], mentors)
            used.setdefault(hit, []).append(sid)
            if mentors and mentor not in mentors:
                note = (note + "; " if note else "") + f"{mentor!r} isn't in MENTORS (shared.js)"
        rows.append((sid, f"{first} {last}".strip(), mentor, note))

    # one mentor-sheet student claimed by two IDs means one of the matches is wrong
    for n, sids in used.items():
        if len(sids) > 1:
            rows = [(s, nm, "" if s in sids else m,
                     (f"{full_names[n]} on the mentor sheet matched {len(sids)} IDs" if s in sids else note))
                    for s, nm, m, note in rows]

    rows.sort(key=lambda r: (bool(r[2]), r[1].split()[-1].lower() if r[1] else "", r[1].lower()))
    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["student_id", "name", "mentor", "note"])
        w.writerows(rows)

    filled = [r for r in rows if r[2]]
    loose = [r for r in filled if r[3]]
    blank = [r for r in rows if not r[2]]
    left = [full_names[n] for n in range(len(groups)) if n not in used]
    print(f"\nWrote {args.out}: {len(filled)} of {len(rows)} students have a mentor")
    if loose:
        print(f"\n{len(loose)} matched, but not on the exact name. Worth a glance:")
        for r in loose:
            print(f"  {r[1]:<28} {r[2]:<12} {r[3]}")
    if blank:
        print(f"\n{len(blank)} have no mentor yet (blank rows are at the top of {args.out}):")
        for r in blank:
            print(f"  {r[1]:<28} {r[3]}")
    if left:
        print(f"\n{len(left)} on the mentor sheet matched no ID:")
        for n in left:
            print(f"  {n}")
    print(f"\nFix the blanks in {args.out} (or in the sheets, and run again), then:")
    print(f"  python3 tools/peer_review_sheet.py peer-review-status.json --mentors {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
