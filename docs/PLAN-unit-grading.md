# Unit Post Grading — per-criterion mentor grader

A mentor grading tool for unit/monthly posts, requested by the 12th-grade team
and likely to be adopted by grades 9–11. Like the performance review's
`grade.html`, mentors open it from a link at the bottom of the submitted post.
It replaces grading in Canvas SpeedGrader beside a Canvas rubric, which mentors
find clunky, and replaces
the self-rubric's one-level-per-section output with a 0–4 score **per
criterion**.

Status: **design only — no code yet.**

---

## Locked decisions

| Area | Decision |
|------|----------|
| **Transport** | A **grading link** at the bottom of the submitted post, like the perf review's: `unit.html` builds it when the student downloads, and places it **inside the post's Self Grade Rubric fold**. Like the perf-review link, it's click-to-select (SpeedGrader's preview blocks clicks); the mentor pastes it into a tab and the grader opens prefilled. Not everyone can be expected to download submission zips yet. |
| **What the link carries** | The post's **text, not its photos**: name/grade/unit, Project Update pt. 1–2 (subtitles + text), Reflection, figure numbers + captions, file-management screenshot count, and the student's self-rubric checks. A post's writing is a few KB; compressed (deflate) and base64url-encoded into the URL **fragment**, it stays a few KB and never reaches a server, as with `grade.html#d=…`. Photos would make it megabytes. |
| **Side by side** | The grader shows the post's text next to the criteria that grade it (Project Update beside its four criteria, Reflection beside its three). Figures appear as "Figure N: caption" placeholders; the mentor checks the photos themselves (criterion 4, file management) in the SpeedGrader pane. |
| **Fallback** | The grader also accepts a dropped/selected post `.html`. That covers posts submitted before the link existed, since unit posts already embed their data (`#portfolio-data` JSON + inline `<img>`s; `loadData` in `unit.html` recovers both), and it shows the photos too. The Canvas submissions zip could come later on the same loader. |
| **Granularity** | Every criterion gets its **own 0–4 score, whole numbers only**. The rubric is a grid (criteria × levels): a criterion's Level 4 is the stronger version of its Level 3, not a separate item. The "Level 4 requires every Level 3 box" rule goes away. |
| **Prefill** | The student's self-rubric prefills the mentor's scores: Grade 12's chosen levels carry over exactly ([Student self-rubric](#student-self-rubric-grade-12)); checkbox rubrics map through a table ([Prefill](#prefill-from-the-checkbox-self-rubric-grades-911-older-posts)). Mentors grade by exception. |
| **Scoring** | Section score = **average** of its criteria. Overall = **0.6 × Update + 0.3 × Reflection + 0.1 × Files**, on 0–4. Output: score for the Canvas points box + a comment, as in `grade.html`. |
| **Grader address** | **One address for both graders: `portfolio.dpeacl.org/grade`.** Unit links use their own fragment key (`/grade#u=…`; perf reviews keep `#d=…`). `grade.html` recognizes a unit code, in the URL or its paste box, and hands off to the unit grader, which lives in its own file so the perf-review grader's code stays untouched mid-year. Mentors keep one bookmark and one paste box. The address is baked into permanent files, so it must stay reachable. |
| **Which grades** | The link goes in posts for **all grades**, so 9–11 can adopt the grader without another generator change. |
| **Versioning** | The payload carries a **rubric version**, and the grader **displays** it (e.g. "Unit rubric v1"), so rubric wording or criteria can change later without breaking links in older posts. |
| **Canvas comment** | Per-criterion notes only where the mentor changed the prefilled score (as `grade.html` does), plus overall notes. |
| **Peer review** | **Tabled.** Leave room for a peer column in the layout; decide later. |

---

## Criteria

### Project Update (60%) — 4 criteria
From the rubric's sub-grading areas; `unit.html`'s `RUBRIC.update` `l3[i]` and
`l4[i]` already line up by index in this order.

| # | Criterion | Level 3 | Level 4 |
|---|-----------|---------|---------|
| 1 | Key Terms in Context | Uses key terms correctly and precisely — clarity, not padding | Written so a reader outside the project could follow it — terms explained or clear in context, no filler |
| 2 | Organization of Content | Opens by stating what you set out to build or solve, and why | Maintains clear focus on the project throughout |
| 3 | Writing Style | Explains the reasoning behind key decisions ("I did X because…") | Supports results with specific evidence (numbers, parts, behaviors) and explains the correlation |
| 4 | Image Quality & Content | Each image is referred to by figure number and shows something discussed | Visuals do explanatory work — labeled, annotated, or captioned to teach |

Levels 2 and 1 have per-criterion wording in the rubric sheet (`Unit Post Rubric.xlsx`, E3/F3).
Level 0: no submission, improper link, or academic dishonesty.

### Reflection/Synthesis (30%) — 3 criteria
Pairing approved 2026-10-28.

| # | Criterion | Level 3 | Level 4 |
|---|-----------|---------|---------|
| 5 | Growth | Explains what you learned or how you grew — not just what you did | Names a specific way your thinking or approach changed |
| 6 | Connections | Connects this work to a specific earlier experience or class | Draws a transferable lesson and says how you'll apply it going forward |
| 7 | Personal detail | Grounded in real personal detail — an actual moment, decision, or feeling | *(none — meeting Level 3 counts as full marks, 4)* |

Levels 2 and 1 use the sheet's generic Reflection wording, shown under all three
criteria: Level 2 "Makes connections without adequate explanation or personal
detail"; Level 1 "No thoughtful synthesis or connections — lists learning from
each space, but does not make connections".

So criterion 7 offers Levels 0–3 only, and choosing Level 3 scores **4**, so a
perfect Reflection can still reach 4.

### File Management (10%) — 1 criterion
| # | Criterion | Scoring |
|---|-----------|---------|
| 8 | File management screenshots | Pass/fail in practice: two screenshots, named & organized correctly → 4; done incorrectly → 1; missing → 0 |

---

## Student self-rubric (Grade 12)

12th graders self-grade in the **same per-criterion format mentors use**:
each of the 8 criteria is a row showing its Level 1–4 descriptors, and the
student picks one. Grades 9–11 keep today's checkboxes until that team opts in.

- **Levels 1–4 only** for students; Level 0 (no submission / academic dishonesty) is mentor-only.
  Personal detail offers 1–3, with 3 scoring 4, as for mentors.
- **Comments stay per section** (Update, Reflection, File Management), required as
  today, rather than one per criterion. That avoids 8 required boxes.
- **Live self-score** using the same weights as the grader (section averages →
  60/30/10 → 0–4), shown as a mirror like the perf review's self-score. It is never
  the official grade.
- **The rendered post's rubric section** shows each criterion's chosen level and
  descriptor, the section averages, and the self-score, then the grading link.
- **Prefill is exact**: the mentor's scores start at the student's chosen levels.
- **Old drafts**: a Grade 12 draft saved with checkboxes converts to levels on load
  with the prefill table below, and the student confirms.
- **Peer review mode** locks the level pickers the same way it locks the checkboxes now.
- **Cost**: `unit.html` maintains two rubric UIs, switched by grade (as `isMonthly`
  already switches Unit/Month and peer review), until 9–11 moves over.

## Prefill from the checkbox self-rubric (Grades 9–11, older posts)

Per criterion, from the existing checkboxes:

| Student checked | Prefilled score |
|---|---|
| Level 3 and Level 4 | 4 |
| Level 3 only | 3 |
| Level 4 only | 3 (Level 4 assumes Level 3) |
| Neither | 2 (checkboxes can't distinguish 2 from 1; mentor adjusts) |

File Management prefills 4 if both boxes are checked, else 1.

Later, consider having students pick a level per criterion the same way
mentors do. That changes the grade 9–11 generator too, so decide it with that team.

---

## Scoring

- Each criterion: integer 0–4.
- Update = mean of criteria 1–4; Reflection = mean of 5–7; Files = criterion 8.
- **Overall = 0.6·Update + 0.3·Reflection + 0.1·Files** → 0.00–4.00 (rounded to 2 places for Canvas).
- Weights live in one editable block in the grader.

---

## Open

- **Publish-ready posts** hide the Self Grade Rubric fold, and the link with it.
  That's right for public posts; students must leave it unchecked for Canvas
  (the generator already says so).
- **Peer review** (tabled): peer comments live in Canvas submission comments,
  which the zip doesn't include. Options when revisited: export them via
  `tools/assign_peer_reviews.py` (it already fetches them) for the grader to load,
  or have the final submission carry the peer data in the file.
