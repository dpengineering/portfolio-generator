#!/usr/bin/env python3
"""Assemble a single self-contained index.html for the rotation post generator.

Inlines shared.js and heic2any.min.js, drops the unit-post link. Output stays a
byte-for-byte superset of the multi-file page's behavior — no logic edits here.
"""
import re, pathlib

# Repo root = this script's parent dir's parent (tools/build_standalone.py).
ROOT = pathlib.Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text()
shared = (ROOT / "shared.js").read_text()
heic = (ROOT / "heic2any.min.js").read_text()

def inline_safe(js):
    # Prevent an accidental </script> inside the code from closing the tag early.
    return re.sub(r"</script", r"<\\/script", js, flags=re.I)

# 1) Drop the "Unit Post Generator" link (this build ships the rotation tool alone).
html, n_link = re.subn(
    r'\s*<a class="switch-link" href="unit\.html">.*?</a>', "", html, flags=re.S)
assert n_link == 1, f"expected 1 unit link, removed {n_link}"

# 2) Inline heic2any (local <script src>). Lambda repl → backslashes stay literal.
heic_tag = "<script>\n" + inline_safe(heic) + "\n</script>"
html, n_heic = re.subn(
    r'<script src="heic2any\.min\.js"></script>', lambda m: heic_tag, html)
assert n_heic == 1, f"expected 1 heic2any tag, replaced {n_heic}"

# 3) Inline shared.js (drop the ?v= cache-buster; irrelevant once inlined).
shared_tag = "<script>\n" + inline_safe(shared) + "\n</script>"
html, n_shared = re.subn(
    r'<script src="shared\.js\?v=\d+"></script>', lambda m: shared_tag, html)
assert n_shared == 1, f"expected 1 shared.js tag, replaced {n_shared}"

# Sanity: neither real external tag should remain as an actual <script src="..."></script>.
# (A harmless mention of `<script src="shared.js?v=N">` survives inside shared.js's own
#  comment; that's inside an inlined block and never fetched, so it's fine.)
for pat in (r'<script src="heic2any\.min\.js">', r'<script src="shared\.js\?v=\d+">'):
    assert not re.search(pat, html), f"external tag still present: {pat}"

out = ROOT / "portfolio-standalone.html"
out.write_text(html)
print(f"wrote {out} ({len(html):,} bytes)")
