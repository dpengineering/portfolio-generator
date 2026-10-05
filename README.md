# DPEA Portfolios

The student-facing portfolio tools for DPEngineering. Everything is plain
HTML/CSS/JS with no build step, no server, no accounts, and no database —
each tool runs entirely in the browser and produces a **self-contained
`.html` file** the student submits through Canvas.

**Live:** <https://portfolio.dpeacl.org/>

| Path | Tool | Who | Cadence |
|------|------|-----|---------|
| `/` (`index.html`) | Hub — asks your grade, then shows your tools | everyone | — |
| `/weekly` (`weekly.html`) | Rotation post generator | grades 9–12 | weekly |
| `/unit` (`unit.html`) | Unit post generator (monthly for grade 12) | grades 9–12 | per unit / month |
| `/review` (`review.html`) | Standalone performance review — kept as a fallback, no longer linked | — | — |
| `/grade` (`grade.html`) | Mentor grading tool | mentors | weekly |
| `/pair` (`pair.html`) | Peer-review pairing tool | teachers | per unit / month |

Students in grades 9–11 use the two post generators. Grade 12 fills in a weekly
performance review **inside the rotation post generator** and downloads two
files, one per Canvas assignment. Canvas is the system of record for every
grade; **no Canvas rubric is used for any assignment.**

### The hub

`index.html` asks once for a name, a **6-digit student ID** (the one on their
Canvas account), a grade, and where the student sits in the
schedule — a **rotation** (A–D) for grades 9–11, or one or more **periods**
(1–4) for grade 12 — and remembers it on the device (`dpea.profile.v1`). It then
shows only the tools that grade needs. Pre-fill never overwrites a field that
already has something in it, so a loaded draft always wins.

**Every field is required.** This is a student's first contact with the system,
and everything downstream depends on it: a name for their posts, a grade to pick
their tools, a rotation or period to pair them for peer review. Next stays
disabled and names the first thing still missing.

The schedule travels with every post as `meta.rotation` / `meta.periods` plus a
derived `meta.peerKey`, which is what peer-review matching pairs on: same
rotation for grades 9–11, same **home period** for grade 12 — the earliest one
they're present for, so periods are stored ascending and the lowest is the key.

Append `?grade=12` to any page to override the stored grade for one page load.
It isn't saved, and it carries through to whichever tool you click. It's there
for demos, mid-year transfers, and a senior sitting in a junior's section. This
is UX scoping, not access control — everything runs client-side.

## Hosting

`portfolio.dpeacl.org` is a custom domain pointed at this repo's GitHub Pages
site, so the tools are served from the repo root (`/unit`, `/grade` — extensionless
URLs work). The custom domain exists because **the student network blocks
`github.io` URLs but not the custom domain.** Mentors are not blocked.

The Google Sites pages stay up as a **fallback** during rollout: they hold the
older single-file generators, so students have something that still works if the
new site misbehaves. Those are the committed `*-standalone.html` builds, and
they are **frozen** — [`tools/build_standalone.py`](tools/build_standalone.py)
regenerates them from current source, which would mean re-pasting into Sites, so
only run it when you mean to refresh the fallback. Once rollout is done the Sites
pages become links to `portfolio.dpeacl.org` and the builds can be retired.

> **`GRADE_URL` is permanent.** `review.html` bakes the grading-tool URL into
> every submission it produces, and those files live forever. The old address
> (`dpengineering.github.io/performance-review/grade`) must stay reachable —
> submissions downloaded before the domain move point at it.

## The post generators

- Fill in a title card (name, project, classroom, grade, unit), Learning Moments,
  captioned photos, and a reflection. Every section is collapsible, so students
  can fold away the parts they aren't working on, with a **Collapse all** button
  in the toolbar; the choice lasts the session and a new visit starts fully
  expanded.
- The unit post's Project Update is written in **two parts**, each with its own
  pair of photos (four in total), so the finished post reads in chunks rather
  than one wall of text. Each part heads its section `Project Update — pt. N`,
  or a subtitle the student gives it instead. The reflection takes up to two
  more photos, optionally — but anything added still needs a caption.
- A live checklist gates the download until every requirement is met, including
  at least three `*asterisk*` key terms highlighted across the post.
- Download produces one self-contained `.html` named
  `<Initials+Last4>_<Class>_Grade<N>_Unit<N>.html` — no external files needed.
- Drafts autosave locally, and a downloaded post can be re-opened to keep editing.
  `localStorage` is about 5MB and photos overflow it, so when a draft won't fit,
  autosave falls back to saving everything *except* the images and says so —
  a too-big draft costs the student their photos, never their writing.
- iPhone/iPad HEIC photos convert automatically (via the bundled
  [heic2any](https://github.com/alexcorvi/heic2any), MIT).
- A **personal project** toggle drops the school fields. Personal projects are
  for the student's own content and later publication on their personal site —
  they carry no Canvas or grading requirements, so they never generate a
  performance review.

## The performance review (grade 12)

Seniors fill this in as part of the rotation post, in the same form — see
[`perfreview.js`](perfreview.js), which `weekly.html` loads. It appears only when
`grade === "12"` and the personal-project toggle is off, and it is *built on
demand* rather than hidden, so a grade 9–11 student never has those inputs in
their DOM and the download checklist can't deadlock on fields they can't see.

**Two files, two buttons.** The rotation post and the review download
separately, and they are gated separately: an unfinished rubric never blocks the
portfolio post, which is its own assignment. The review additionally requires the
post, because it embeds it. The two downloads are deliberately *not* one click —
iPad Safari drops the second of two programmatic downloads, and a silently
missing submission is the worst failure available here.

The review's copy of the photos is re-encoded smaller (≤1000px, JPEG q0.7); the
rotation post keeps the originals.

- The student rates 12 rubric items `a`/`m`/`s`/`n`, adds DELTA skills, and sees
  a live self-score.
- Download produces a **static, read-only** page: portfolio content, DELTAs, and
  the student's self-ratings, with no interactive controls — so it renders in
  SpeedGrader's sandboxed preview, which runs no JavaScript.
- The submission's footer carries a **grading link** to `/grade` with the
  student's ratings in the URL fragment. The mentor opens it, the tool is
  prefilled with the self-ratings, they adjust by exception, and copy the
  generated score and comment into Canvas.
- The student's self-score is a reflection mirror only — never the official grade.

Full rubric, weights, and scoring model: [`docs/PLAN-performance-review.md`](docs/PLAN-performance-review.md).
The `WEIGHTS` block is duplicated in `perfreview.js` and `grade.html` — keep them
identical, or the student's self-score and the mentor's score diverge.

`review.html` is the pre-merge standalone version. It still works and still
produces a valid submission, but nothing links to it; it's there as a safety
valve while the fused flow is tested, and can go once that's settled.

## Peer review

Peer review runs on the **unit/monthly** post, through Canvas's own peer-review
feature — students and teachers already know it, Canvas already knows who
everyone is, and a student only ever sees the submission assigned to them.

> **Peer reviews live on the assignment the students submitted to.** Canvas
> attaches a review to a submission, so you enable peer review on the unit post
> assignment itself and assign reviews there. A separate "peer review"
> assignment has no submissions to point at and every API call returns 404.
>
> **Addressing gotcha:** the Canvas API docs say the `:submission_id` in the
> peer-review paths is the *student's user id*. On our instance that 404s for
> every student and only the submission's own id works, so the script looks the
> submission ids up and uses those. `--probe` reports which form an instance
> wants, against one real pair, cleaning up after itself.

The one thing Canvas can't do is pair students by rotation or period: its
automatic assignment ignores both. So leave the assignment on **Require Peer
Reviews → Manually Assign** and pair them in two steps:

1. **[`pair.html`](pair.html)** — download all submissions from Canvas, unzip,
   and drop the folder in. It reads each post's own `meta.peerKey`, groups
   students who share a rotation (9–11) or a home period (12), shuffles, and
   pairs them mutually: A reviews B, B reviews A. An odd group ends in a trio
   (A→B→C→A) so everyone still writes exactly one review and receives exactly
   one. Students who didn't submit simply aren't in the download; anything it
   can't pair it says so, rather than dropping it quietly. Export `pairings.json`.
2. **[`tools/assign_peer_reviews.py`](tools/assign_peer_reviews.py)** — run it on
   your machine with a Canvas API token. `--check` first to confirm the token,
   course and assignment setup; then a dry run, which prints every pairing
   without writing; then `--apply`.

Assigning is **idempotent** — anything already assigned is left alone, so a
re-run after a partial failure fills only the gaps and running it twice does
nothing. `--undo` reverses it, and `--undo --apply` commits that:

```bash
# put a live assignment back the way it was
python3 tools/assign_peer_reviews.py pairings.json --course N --assignment M --undo --apply
```

Undo removes only the pairings in the file you hand it, so a peer review
assigned by hand outside it survives. A review the reviewer has **already
completed** is kept and reported, since removing it would throw away feedback
they actually wrote — `--force` overrides that, deliberately.

The dry run opens by reporting what identity the pairing file actually carries,
and closes with how each student was matched. If that summary says everyone
matched on *the name typed in the post*, the filename ids never made it into the
export — re-export from `pair.html`, which shows the same breakdown before you
download. For the last few students who still can't be placed, `--aliases
fixes.json` takes `{"name they typed": <canvas user id or 6-digit number>}`, so
the correction is reusable next cycle instead of a one-off edit.

**Matching students to Canvas.** A Canvas submissions download names each file
`lastfirst_<user id>_<submission id>_<their file>.html`, and both the name and
the numbers come from Canvas itself — so they match the roster exactly, unlike
the name a student typed into the generator. The pairing export carries, in
order of preference: the student's own 6-digit ID, the numbers from the
filename, and only then a name. The script tries each in turn and reports what
it couldn't place rather than guessing. Nothing is assumed about *which*
number is which: the user id resolves and the submission id matches nobody.

**Testing before a real cycle:** posts made before the hub asked for a rotation
or period have nothing to group by. `pair.html` offers a *treat everyone as one
group* switch for exactly that case, so an existing batch of submissions can be
run end to end. It's a visible switch rather than a silent fallback, because
left on during a real cycle it would pair a 9th grader with a senior.

Reviewers then download their partner's file from Canvas and load it into
`/unit`, where peer-review mode switches itself on because the post's author
isn't them. They write their feedback, press **Copy review for Canvas**, and
paste it as a **comment** on their partner's submission.

That last step is the one that matters: **Canvas marks a peer review complete
when the reviewer leaves a comment.** Nothing downloaded from the generator
completes anything, so peer mode makes copying the comment the primary action
and demotes the download to an optional extra for anyone who also wants to
attach the rendered page.

**No student data leaves your machine.** `pair.html` runs in the browser with no
network calls at all, and the script talks only to Canvas. Nothing is sent to
any third party, and deliberately nothing to an AI service — rosters and student
work shouldn't go there.

## Running it locally

Open any of the HTML files directly (`file://`) or serve the folder:

```bash
python3 -m http.server 8000
```

> Note: avoid VS Code **Live Server** — its live-reload injection lands inside
> each page's inline script and breaks it. Open the file directly or use a plain
> static server instead.

Bump the `?v=N` on `shared.js` in **every** page that loads it whenever
`shared.js` changes, so district iPads (Safari) pick up the new version without
a hard refresh.
