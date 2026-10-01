# DPEA Portfolios

The student-facing portfolio tools for DPEngineering. Everything is plain
HTML/CSS/JS with no build step, no server, no accounts, and no database —
each tool runs entirely in the browser and produces a **self-contained
`.html` file** the student submits through Canvas.

**Live:** <https://portfolio.dpeacl.org/>

| Path | Tool | Who | Cadence |
|------|------|-----|---------|
| `/` (`index.html`) | Rotation / weekly post generator | grades 9–12 | weekly |
| `/unit` (`unit.html`) | Unit post generator (monthly for grade 12) | grades 9–12 | per unit / month |
| `/review` (`review.html`) | Weekly performance review | **grade 12 only** | weekly |
| `/grade` (`grade.html`) | Mentor grading tool | mentors | weekly |

Students in grades 9–11 use the two post generators. Grade 12 additionally
completes a weekly performance review. Canvas is the system of record for every
grade; **no Canvas rubric is used for any assignment.**

## Hosting

`portfolio.dpeacl.org` is a custom domain pointed at this repo's GitHub Pages
site, so the tools are served from the repo root (`/unit`, `/grade` — extensionless
URLs work). The custom domain exists because **the student network blocks
`github.io` URLs but not the custom domain.** Mentors are not blocked.

During student testing the generators are also embedded in Google Sites, which
needs each tool as one file — hence the generated `*-standalone.html` builds
(see [`tools/build_standalone.py`](tools/build_standalone.py)). Once testing is
done the Sites pages become redirects to `portfolio.dpeacl.org` and the
standalone builds can be retired.

> **`GRADE_URL` is permanent.** `review.html` bakes the grading-tool URL into
> every submission it produces, and those files live forever. The old address
> (`dpengineering.github.io/performance-review/grade`) must stay reachable —
> submissions downloaded before the domain move point at it.

## The post generators

- Fill in a title card (name, project, classroom, grade, unit), Learning Moments,
  captioned photos, and a reflection.
- A live checklist gates the download until every requirement is met, including
  at least three `*asterisk*` key terms highlighted across the post.
- Download produces one self-contained `.html` named
  `<Initials+Last4>_<Class>_Grade<N>_Unit<N>.html` — no external files needed.
- Drafts autosave locally, and a downloaded post can be re-opened to keep editing.
- iPhone/iPad HEIC photos convert automatically (via the bundled
  [heic2any](https://github.com/alexcorvi/heic2any), MIT).
- A **personal project** toggle drops the school fields. Personal projects are
  for the student's own content and later publication on their personal site —
  they carry no Canvas or grading requirements, so they never generate a
  performance review.

## The performance review (grade 12)

- The student attaches their weekly post, adds DELTA skills, and rates 12 rubric
  items `a`/`m`/`s`/`n`, seeing a live self-score.
- Download produces a **static, read-only** page: portfolio content, DELTAs, and
  the student's self-ratings, with no interactive controls — so it renders in
  SpeedGrader's sandboxed preview, which runs no JavaScript.
- The submission's footer carries a **grading link** to `/grade` with the
  student's ratings in the URL fragment. The mentor opens it, the tool is
  prefilled with the self-ratings, they adjust by exception, and copy the
  generated score and comment into Canvas.
- The student's self-score is a reflection mirror only — never the official grade.

Full rubric, weights, and scoring model: [`docs/PLAN-performance-review.md`](docs/PLAN-performance-review.md).

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
