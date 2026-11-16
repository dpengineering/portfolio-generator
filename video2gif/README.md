# Video → GIF

A dead-simple, ad-free, **100% client-side** video-to-GIF converter. Built for students
to turn iPad/phone videos into clean, uniform GIFs for their portfolios.

- Nothing is uploaded — conversion happens in the browser via FFmpeg (WebAssembly).
- Works offline once loaded. No accounts, no tracking, no ads.
- Hostable on GitHub Pages as-is (all dependencies are vendored, no build step).

## Locked output preset

Every GIF comes out the same, regardless of the input:

| Setting     | Value                          |
|-------------|--------------------------------|
| Width       | 480 px (never upscaled)        |
| Frame rate  | 12 fps                         |
| Palette     | Optimized 2-pass (high quality)|
| Looping     | Infinite                       |

To change the preset, edit the `PRESET` object and `VF` filter string in `index.html`.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## Deploy to GitHub Pages

1. Create a repo and push these files.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   pick your branch and `/ (root)`.
3. Wait for the green check; your site is at `https://<user>.github.io/<repo>/`.

The single-threaded FFmpeg core is used specifically so **no special HTTP headers**
(`COOP`/`COEP`) are required — which GitHub Pages cannot set.

## Files

- `index.html` — the entire app (UI + logic).
- `vendor/` — FFmpeg.wasm library + single-threaded core (`ffmpeg-core.wasm` is ~32 MB).
- `.nojekyll` — tells GitHub Pages to serve files as-is.
