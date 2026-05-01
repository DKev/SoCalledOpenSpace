# SoCalledOpenSpace

**Because "open space" was never quiet.**

Local-first web app: sample your mic, snap or upload a face photo, optionally slap on stickers and a company logo, export one **noise badge** PNG (**1600×900** landscape or **900×1600** portrait) — all in the browser.

**Repository ·** [github.com/DKev/SoCalledOpenSpace](https://github.com/DKev/SoCalledOpenSpace)

**[Quickstart](#quickstart)** ·
**[Features](#features)** ·
**[Privacy & network](#privacy--network)** ·
**[Disclaimer (dB)](#measurement-disclaimer-db)** ·
**[Architecture](#architecture)** ·
**[Development](#development)** ·
**[License](#license)**

---

> *Open-plan offices look great on slides, but your ears do not care about the floor plan. I wanted something that turns “how loud is it really?” into a single image you can share — without sending audio or photos to a server.*

## Install

### Prerequisites

- **Node.js** (LTS recommended) and **npm**
- A browser with **Web Audio**, **Canvas**, and **`getUserMedia`**
- A [**secure context**](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts): **`http://localhost`** or **HTTPS** (arbitrary `http://` hostnames often block microphone/camera)

### From source

```bash
git clone https://github.com/DKev/SoCalledOpenSpace.git
cd SoCalledOpenSpace
npm install
```

## Quickstart

```bash
npm run dev
```

Open the URL Vite prints (typically **http://localhost:5173**). Grant **microphone** when prompted; allow **camera** for a live selfie, or **upload a photo** instead.

### Production build

```bash
npm run build    # tsc && vite build
npm run preview  # serve the dist folder locally
```

### HTTPS (optional, LAN / device testing)

Place **`localhost.key`** and **`localhost.crt`** in the project root. [vite.config.ts](vite.config.ts) enables HTTPS when both files exist (e.g. via `openssl` or [mkcert](https://github.com/FiloSottile/mkcert)).

## Features

### Noise measurement

- Fixed **15 s** session (see [`DURATION` in `App.tsx`](src/App.tsx)).
- Samples about **10× per second** via `AnalyserNode` and aggregates **average** and **maximum** display dB after the run.
- Implementation: [`src/utils/audioMeter.ts`](src/utils/audioMeter.ts).

### Live readout while measuring

- **Live dB** overlay on the video or static photo.
- **Progress bar** and **countdown** for the remaining seconds.
- Camera preview runs in parallel with the **audio-only** mic stream (video track is not used for metering).

### Photo: camera or upload

- **Front camera** (`facingMode: 'user'`) for live preview during the run.
- **No camera?** Upload an image on the idle screen; the app uses it as the static “preview” and bakes it into the badge.
- Errors (e.g. mic denied, camera missing) surface inline with **Try again** / hints to upload.

### Face stickers (MediaPipe)

- Optional filters (e.g. glasses, dog, hat, crown, clown) aligned to **face landmarks**.
- **Live overlay** on video during measurement; same filter **composited into** the final capture (including **uploaded** photos).
- Uses **MediaPipe Tasks Vision** (BlazeFace short-range, WASM). First run downloads WASM + model from CDNs — see [Privacy & network](#privacy--network).
- Code: [`src/utils/faceDetector.ts`](src/utils/faceDetector.ts), [`src/utils/stickerRenderer.ts`](src/utils/stickerRenderer.ts).

### Company logo

- **Fortune 500**-style grid with **search**, plus **upload your own** image.
- Logo thumbnails try multiple hosts (e.g. Clearbit, DuckDuckGo favicon, Google favicon) with fallbacks; selecting a grid tile uses whichever URL actually loads in the preview.
- Badge draws a rounded logo plate at the **top-left** when set.
- Component: [`src/components/LogoPicker.tsx`](src/components/LogoPicker.tsx), data: [`src/data/fortune500.ts`](src/data/fortune500.ts).

### Shareable noise badge

- **PNG via Canvas:** **16∶9** (**1600×900**) or **9∶16** (**900×1600**), chosen before you start. Full-bleed photo (optional **blur / sharp face**), with **average dB** (large, **color-coded**) centered toward the bottom, **time and date** at the top-right, and optional **logo** at the top-left.
- After the run, the **done** screen still shows **max dB** and session stats; those extra numbers are **not** burned into the PNG.
- **Download** uses a timestamped filename (`so-called-open-space-<timestamp>.png`).
- Renderer: [`src/utils/badgeRenderer.ts`](src/utils/badgeRenderer.ts).

### Permissions summary

| Permission   | Role |
|-------------|------|
| Microphone  | Required for the main measurement flow |
| Camera      | Optional if you upload a photo instead |

## Privacy & network

- **No app-owned backend**: metering, detection snapshots, and badge rendering run **in your browser** (Web Audio, Canvas 2D, MediaPipe in-page).
- **Network you may still trigger:**
  - **Face detection:** MediaPipe **WASM** and **model** load from CDNs on first use (then cached by the browser as usual).
  - **Logo grid:** picking a company may load images from **third-party** icon/logo URLs; **uploading a file** avoids that for the logo. For **PNG export**, some hosts block cross-origin reads; the app may then fetch the same icon URL via a **public image relay** (so that service sees the URL) so the logo can be drawn on canvas.

## Measurement disclaimer (dB)

Displayed **dB** values are **not** calibrated **SPL**. They are **RMS-derived approximations** mapped to a readable 0–120-ish display range and will **vary by device**. Use for **relative** comparison or fun, not compliance or legal noise claims.

## Architecture

```
Browser tab (React + Vite)
    │
    ├── Idle UI
    │     ├── Filter picker (stickerRenderer.FILTERS)
    │     ├── Photo upload (optional)
    │     └── LogoPicker → Fortune 500 / file → data URL or image URL
    │
    ├── Measurement phase
    │     ├── AudioMeter → mic stream → AnalyserNode → avg / max dB
    │     ├── Video or static <img>
    │     └── rAF loop → snapshot → MediaPipe FaceDetector → drawSticker overlay
    │
    └── Completion
          ├── Final canvas snapshot (+ sticker bake for upload path)
          ├── renderBadge(photo, measurement, logo)
          └── PNG data URL → download
```

## Development

| Command         | Description |
|----------------|-------------|
| `npm run dev`  | Dev server (Vite) |
| `npm run build`| Typecheck + production bundle |
| `npm run preview` | Preview `dist/` |

### Project layout

```
src/
  App.tsx                 Phases, meter lifecycle, capture + badge pipeline
  main.tsx
  styles.css
  components/
    LogoPicker.tsx
  data/
    fortune500.ts
  utils/
    audioMeter.ts         Mic + display dB math
    badgeRenderer.ts      1600×900 / 900×1600 badge overlay
    faceDetector.ts       MediaPipe init + detectFace
    imageUtils.ts         Cover fit, rounded rect
    stickerRenderer.ts    Landmark-based stickers
```

`vite.config.ts` sets `optimizeDeps.exclude: ['@mediapipe/tasks-vision']` so WASM is not over-bundled.

## Contributing

Issues and PRs are welcome: bug fixes, UX polish, documentation, and careful performance work (especially around detection frequency and main-thread cost).

## License

[MIT](LICENSE)

## Acknowledgments

- [MediaPipe](https://developers.google.com/mediapipe) — face detection (Tasks Vision / BlazeFace)
- [Vite](https://vitejs.dev/), [React](https://react.dev/) — app shell and tooling
