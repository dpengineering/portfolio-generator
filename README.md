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

Students in grades 9–11 use the two post generators. Grade 12 fills in a weekly
performance review **inside the rotation post generator** and downloads two
files, one per Canvas assignment. Canvas is the system of record for every
grade; **no Canvas rubric is used for any assignment.**

### The hub

`index.html` asks once for a name, a grade, and where the student sits in the
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
  or a subtitle the student gives it instead.
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
