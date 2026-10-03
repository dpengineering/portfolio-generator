#!/usr/bin/env python3
"""DEPRECATED — do not update this script, and do not run it.

The whole point of the dev branch it belongs to is to retire single-file
builds and serve everything from portfolio.dpeacl.org instead. This script is
kept only so the frozen *-standalone.html files in the repo root can be traced
back to the source they came from.

Those frozen files are the copies pasted into Google Sites, which students keep
as a fallback during rollout. Running this would overwrite them with current
source -- which no longer matches what Sites is serving -- and the rebuilt page
would then need re-pasting. Don't.

Once the Sites pages are switched over to portfolio.dpeacl.org, delete this
script and the two *-standalone.html files together.

(For the record, as last maintained: it inlined shared.js, heic2any.min.js and
perfreview.js and dropped the hub link, so a page ran from one file.)

  weekly.html -> portfolio-standalone.html  (rotation post generator)
  unit.html   -> unit-standalone.html       (unit post generator)
"""
import re, pathlib

# Repo root = this script's parent dir's parent (tools/build_standalone.py).
ROOT = pathlib.Path(__file__).resolve().parent.parent
shared = (ROOT / "shared.js").read_text()
heic = (ROOT / "heic2any.min.js").read_text()
perfreview = (ROOT / "perfreview.js").read_text()

# (source page, output filename) — the standalone build for each generator.
BUILDS = [
    ("weekly.html", "portfolio-standalone.html"),
    ("unit.html", "unit-standalone.html"),
]


def inline_safe(js):
    # Prevent an accidental </script> inside the code from closing the tag early.
    return re.sub(r"</script", r"<\\/script", js, flags=re.I)


def build(src, dst):
    html = (ROOT / src).read_text()

    # 1) Drop the hub link — a standalone ships one tool alone, with no hub to
    #    return to. Both generators now point at index.html (the hub).
    html, n_link = re.subn(
        r'\s*<a class="switch-link" href="index\.html">.*?</a>',
        "", html, flags=re.S)
    assert n_link == 1, f"{src}: expected 1 switch link, removed {n_link}"

    # 2) Inline heic2any (local <script src>). Lambda repl → backslashes stay literal.
    heic_tag = "<script>\n" + inline_safe(heic) + "\n</script>"
    html, n_heic = re.subn(
        r'<script src="heic2any\.min\.js"></script>', lambda m: heic_tag, html)
    assert n_heic == 1, f"{src}: expected 1 heic2any tag, replaced {n_heic}"

    # 3) Inline shared.js (drop the ?v= cache-buster; irrelevant once inlined).
    shared_tag = "<script>\n" + inline_safe(shared) + "\n</script>"
    html, n_shared = re.subn(
        r'<script src="shared\.js\?v=\d+"></script>', lambda m: shared_tag, html)
    assert n_shared == 1, f"{src}: expected 1 shared.js tag, replaced {n_shared}"

    # 4) Inline perfreview.js — only weekly.html loads it (grade 12), so this is
    #    optional per page, but a page that references it MUST get it inlined or
    #    the standalone ships a dangling <script src>.
    pr_tag = "<script>\n" + inline_safe(perfreview) + "\n</script>"
    html, n_pr = re.subn(
        r'<script src="perfreview\.js\?v=\d+"></script>', lambda m: pr_tag, html)
    assert n_pr <= 1, f"{src}: expected at most 1 perfreview.js tag, replaced {n_pr}"

    # Sanity: no real external tag should remain as an actual <script src="...">.
    # (A harmless mention of `<script src="shared.js?v=N">` survives inside shared.js's
    #  own comment; that's inside an inlined block and never fetched, so it's fine.)
    for pat in (r'<script src="heic2any\.min\.js">', r'<script src="shared\.js\?v=\d+">',
                r'<script src="perfreview\.js\?v=\d+">'):
        assert not re.search(pat, html), f"{src}: external tag still present: {pat}"

    out = ROOT / dst
    out.write_text(html)
    print(f"wrote {out} ({len(html):,} bytes)")


for src, dst in BUILDS:
    build(src, dst)
