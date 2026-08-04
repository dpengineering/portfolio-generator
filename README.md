# Portfolio / Rotation Post Generator

A single-page tool for students to write up a weekly engineering rotation post,
add captioned photos, and download a finished, self-contained portfolio page to
submit through Canvas.

**Use it here:** https://dpengineering.github.io/portfolio-generator/

## What it does

- Fill in a title card (name, project, classroom, grade, unit), two Learning
  Moments (50–75 words each), captioned photos, and a reflection.
- A live checklist gates the download until every requirement is met, including
  at least three `*asterisk*` key terms highlighted across the post.
- **Download portfolio** produces one self-contained `.html` file named
  `<Initials+Last4>_<Class>_Grade<N>_Unit<N>.html` — no external files needed.
- Everything runs in the browser. Nothing is uploaded; drafts autosave locally,
  and a downloaded post can be re-opened here to keep editing.
- iPhone/iPad HEIC photos convert automatically (via the bundled
  [heic2any](https://github.com/alexcorvi/heic2any), MIT).

## Running it locally

Because it's a single file, you can just open `index.html` directly in a browser
(`file://`) or serve the folder with any static server, e.g.:

```bash
python3 -m http.server 8000
```

> Note: avoid VS Code **Live Server** for this file — its live-reload injection
> lands inside the page's inline script and breaks it. Open the file directly or
> use a plain static server instead.
