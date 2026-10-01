# Weekly Performance Review

A browser-based tool that streamlines the weekly performance-review submission process
for 12th-grade engineering seniors at DPEngineering. Students fill in a 12-item rubric
self-review, download a self-contained page, and submit it through Canvas. Mentors read
that page in SpeedGrader and enter the official grade with **Canvas's built-in rubric**.

Sibling project: [portfolio-generator](https://github.com/dpengineering/portfolio-generator)
— same zero-backend, single-file philosophy.

## How it works

- **Student** fills the rubric (`a`/`m`/`s`/`n` per item, with descriptors shown as
  guidance) plus short reflection notes, and sees a live self-score. A checklist gates
  the download.
- **Download** produces one self-contained `.html` file — no external files needed —
  which the student submits to a Canvas assignment. The submission is a **static,
  read-only page**: the portfolio content, DELTAs, and the student's self-ratings +
  self-score, with no interactive controls (so it renders in SpeedGrader's sandboxed
  preview without needing any script to run).
- **Mentor** reads the submission in SpeedGrader — the self-ratings give context — and
  enters the official score and comments with **Canvas's built-in rubric**.

Everything runs in the browser. Nothing is uploaded to us; Canvas is the system of record.
The student's self-score is a reflection mirror only — never the official grade.

See [`PLAN.md`](PLAN.md) for the full rubric, scoring model, and design.

## Running it locally

Because the tools are self-contained, you can open the HTML directly in a browser
(`file://`) or serve the folder with any static server, e.g.:

```bash
python3 -m http.server 8000
```

> Note: avoid VS Code **Live Server** — its live-reload injection lands inside the
> page's inline script and breaks it. Open the file directly or use a plain static
> server instead.

## Scoring at a glance

The student's self-score uses this model: `a`/`m`/`s`/`n` map to `3`/`2`/`1`/`0`
(reversed for the two counterproductive items), summed across 12 items (0–36) and
normalized to a **0.00–4.00** scale. This is a self-assessment mirror only; the official
grade comes from the mentor's Canvas rubric.
