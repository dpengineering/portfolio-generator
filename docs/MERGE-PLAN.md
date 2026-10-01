# Merging the performance review into the portfolio tools

Status: **phases 1a + 2 done** (this branch, `dev`). Nothing pushed.

## Why merge

1. **The round-trip is pure friction.** A senior writes a weekly post, downloads
   the `.html`, then re-uploads it into the performance review, which parses
   `#portfolio-data` and re-compresses the images (`review.html`,
   `attachPortfolio` / `recompressPortfolio`). Same student, same week, same
   content, two files to juggle.
2. **One custom domain, one Pages site.** `portfolio.dpeacl.org` attaches to a
   single GitHub Pages site and already serves this repo at root. The review and
   the grading tool can only live on that domain by living in this repo.
3. **The infra was forked.** `review.html` re-declares `$`, `val`, `esc`,
   `paras`, key-term highlighting, `downloadBlob` and `autosave`, all of which
   `shared.js` already has — because it had to be one self-contained file for the
   Google Sites iframe.

## Locked decisions

| Area | Decision |
|------|----------|
| **Merge target** | This repo. It has the traffic, the Google Sites embeds, and the custom domain. Repo name is cosmetic once a custom domain serves it at root — don't rename until after the Sites flip, since renaming changes the `github.io` fallback URL. |
| **Who sees the review** | Renders iff `grade === "12" && !personalMode`. Grades 9–11 use the two post generators only. |
| **Personal projects** | Never generate a performance review. The toggle exists so students can make their own content with no Canvas or grading requirements, for later publication on their personal sites. |
| **Canvas rubrics** | None, for any assignment. Mentors grade seniors through the link in the submission footer (`/grade`), and that tool stays — mentors rely on it. |
| **Unit post** | Keeps its own Level 3/4 self-grade rubric and does **not** absorb the performance review. Different cadence, different instrument. |
| **Output** | One filled form emits **two files** (`…_Portfolio_….html` and `…_PerfReview_….html`), not one combined file. This decouples the merge from any Canvas assignment restructuring: existing assignments and mentor habits stay as they are, and the student still stops re-uploading. |
| **Grade as a routing input** | Asked once, up front, and sticky per device — not buried mid-form in the Title Card, which would reshape the form under the student. It still pre-fills the title card. |
| **Gating** | Don't `display:none` the review — **don't build it.** An invisible-but-present 12-item rubric would deadlock the download checklist for grades 9–11 on fields they can't see. Build the DOM conditionally and have the checklist iterate over present sections. |
| **Escape hatch** | A URL override (`?grade=12`) for demos, mid-year transfers, and a senior sitting in a junior's section. This is UX scoping, not access control — everything is client-side. |
| **Draft autosave** | Autosave images **when we can.** On `QuotaExceededError`, warn via `notify()` and keep going, falling back to persisting text-only so the draft is never lost outright. Today the review deliberately keeps attached portfolio images out of `localStorage` while the generators keep theirs in; a fused senior draft holds both against a ~5MB budget. |
| **Cross-tool links** | Absolute to `https://portfolio.dpeacl.org/…`. Relative would break inside the Google Sites iframes the tools still run in during student testing. |

## `GRADE_URL` is permanent

`review.html` bakes the grading-tool URL into every submission, and those files
live forever. The old address, `dpengineering.github.io/performance-review/grade`,
must stay reachable for anything downloaded before the domain move. Keep the
`performance-review` repo's Pages site alive as a redirect; don't delete it.
Fragments survive HTTP redirects and the payload is ~160 chars, so old
submissions keep working.

Mentors are **not** blocked from `github.io` — only students are. So the domain
move is a consolidation, not a fix for a broken path.

## Phases

| Phase | Work | Visible to students? |
|-------|------|----------------------|
| **1a** ✅ | Reshape into the root layout; one README; point links and `GRADE_URL` at the custom domain | no — `/grade` starts resolving |
| **2** ✅ | Hub at `/`; weekly generator moved to `/weekly`; grade asked once and remembered; review tile for grade 12 only; `?grade=` override; quota-aware autosave | yes — `/` is now the hub |
| **1b** | Collapse the forked infra onto `shared.js`; move the review's image recompression into it; swap `alert()` for `notify()`; bump `?v=` | no |
| **3** | Fuse the weekly post and the review into one form for seniors; emit two files; round-trip dies | yes, large |
| **4** | Flip the Google Sites pages to redirect to `portfolio.dpeacl.org`; retire the standalone builds | coordination |

## Rollout

The Google Sites pages are a **frozen fallback**: they keep the older
single-file generators so students have a working path if the new site
misbehaves, and Sites gains a link to `portfolio.dpeacl.org`. The committed
`*-standalone.html` files are those frozen copies — `build_standalone.py` still
works but regenerating them means re-pasting into Sites, so it's left alone.

This also retires the constraint that drove the original fork: the review no
longer has to be one self-contained file, which is why phase 1b is now free of
deployment consequences and can follow phase 2 instead of blocking on it.

## Open

- **Phase 3's reshape.** Once the weekly post and the review share one form, a
  senior changing their grade mid-form reshapes it. `personalMode` already sets
  that precedent in `weekly.html` (`applyFieldVisibility`), so follow it: build
  the review section conditionally and let the checklist iterate over present
  sections only.
- **Opportunity, not scoped here:** with no Canvas rubric anywhere, mentors are
  presumably typing points by hand for the weekly and unit posts while seniors'
  reviews get a prefilled tool. `unit.html` already collects a structured
  self-grade rubric that could feed the same `#d=` link pattern.
