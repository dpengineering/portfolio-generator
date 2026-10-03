# Merging the performance review into the portfolio tools

Status: **phases 1a, 2 and 3 done** (this branch, `dev`). Nothing pushed.

Phase 4 has started: the standalone builds are retired rather than maintained.

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
| **3** ✅ | `perfreview.js`: the review inside `weekly.html` for seniors, built on demand; two separately-gated downloads; round-trip dead | yes, large |
| **4** | Flip the Google Sites pages to point at `portfolio.dpeacl.org`; delete `build_standalone.py` and the two frozen `*-standalone.html` files | coordination |

## Rollout

The new system goes live at `portfolio.dpeacl.org`. The Google Sites pages stay
up **unchanged**, holding the older single-file generators, so students have a
working path if the new site misbehaves, and Sites gains a link across to the
new one.

`build_standalone.py` is **deprecated — do not update or run it.** The point of
this branch is to retire single-file builds. The committed `*-standalone.html`
files are frozen copies of what Sites is serving; regenerating them would
produce something Sites isn't serving and would need re-pasting. Script and
files get deleted together once the Sites pages are switched over.

This also retires the constraint that drove the original fork: the review no
longer has to be one self-contained file, which is why phase 1b is now free of
deployment consequences and can follow phase 2 instead of blocking on it.

## Peer review and the schedule

The hub asks grades 9–11 for a **rotation** (A–D) and grade 12 for one or more
**periods** (1–4), and every post carries that in its metadata along with a
derived `peerKey`. That's what makes bulk peer-review matching possible: pull a
week's submissions out of Canvas, group by `peerKey`, pair at random. Seniors
match on their **first picked** period, so the pick *order* is preserved rather
than sorted — unchecking the first one promotes the next.

Opening a classmate's post now switches `unit.html` into peer review by itself,
rather than relying on the reviewer remembering a toggle. Two signals, cheapest
first: `?peer=1` in the URL, then an author name that doesn't match the local
profile. Anything ambiguous is treated as your own post, so nobody gets locked
out of their own writing. **`?peer=1` is the hook a future handoff should set** —
whatever it ends up being (LTI, Drive, something else), if it can open the post
with that parameter the reviewer lands in the right mode with no instructions.

In peer review the author's self-assessment is now genuinely read-only: criteria
checkboxes disabled, comments greyed and locked, and a separate feedback box per
category for the reviewer. The two never share a field, so a review cannot
overwrite the work it is reviewing, and the downloaded post renders both — the
author's "Self Grade Rubric" and the reviewer's "Peer Review".

## Peer review delivery

Settled: **Canvas's own peer-review feature** is the channel. "Only your partner
can see your work" is an authorization requirement, and authorization needs
something that knows who the viewer is — Canvas already does, already holds the
roster, and students already know the UI. The alternatives considered were
per-student Google Drive folders via Apps Script (a second place to look) and
Cloudflare Access on the custom domain (the first real backend in a project
built on not having one; kept in reserve for a proper in-browser review UI).
An unguessable link on a static host was rejected outright: that's obscurity,
not privacy.

Canvas can't pair by rotation or period, so pairing is ours: `pair.html` groups
by `meta.peerKey` in the browser and `tools/assign_peer_reviews.py` assigns the
reviews through the API. The split exists because turning a name into a Canvas
user id is the one step that needs the authoritative roster — doing it in the
script keeps the browser tool from guessing identity out of a download filename,
a format Canvas doesn't actually document.

Decisions: mutual pairs (A↔B), a trio for an odd group, repeats across months
are fine so no pairing history is kept, and non-submitters need no special
handling — they're absent from the download and spend the period finishing a
late post.

Identity is the student's **6-digit Canvas ID**, collected on the hub. That
makes Canvas matching exact where a typed name is fuzzy, and it means the
exported pairing file carries no student names at all — not even in filenames,
which is why the export dropped them. Names are included only for posts made
before the ID was asked for, since matching has nothing else to go on.

Worth stating plainly: **no student data goes to an AI service.** The pairing
tool makes no network calls and the script talks only to Canvas. An MCP-driven
approach was considered and rejected for exactly this reason — editing course
modules through one is fine, routing a roster through one is not.

## Open

- **`review.html` is now unlinked** but still on disk and still working, as a
  safety valve while the fused flow is tested. Delete it once seniors have used
  the fused flow for a few weeks — and note that `perfreview.js` is a port of its
  internals, so the rubric, weights and artifact CSS live in both until then.
- **One click, two downloads** was rejected: iPad Safari drops the second
  programmatic download. If that ever changes, the two buttons could merge.
- **Opportunity, not scoped here:** with no Canvas rubric anywhere, mentors are
  presumably typing points by hand for the weekly and unit posts while seniors'
  reviews get a prefilled tool. `unit.html` already collects a structured
  self-grade rubric that could feed the same `#d=` link pattern.
