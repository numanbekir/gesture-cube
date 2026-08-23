# Gesture Cube

[![CI](https://github.com/tanirim/gesture-cube/actions/workflows/ci.yml/badge.svg)](https://github.com/tanirim/gesture-cube/actions/workflows/ci.yml)

Solve a 2×2 Rubik's cube in your browser using only hand gestures. The cube is rendered
in AR over your webcam feed; your hands are tracked in real time, and an optimal solver
shows you the next move directly on the cube.

Everything (hand tracking, 3D rendering, the solver) runs **inside the browser**.
No video ever leaves the device and there is no inference server.

> Part of the [Tanırım](https://tanirim.com) computer-vision platform. This repository is
> the standalone, self-contained version of the module.

## How it plays

| Gesture | Effect |
|---|---|
| Both hands in a fist, move the right hand | Rotate the whole cube |
| Right hand: 1–4 fingers | Select a square on the facing face (TL / TR / BL / BR) |
| Left hand: 1–4 fingers | Turn the selected layer right / left / up / down |
| HINT switch | Shows the next optimal move on the cube: a frame on the face to look at, a ring on the square to select, an arrow for the direction (double-headed = half turn) |

The game ends with a summary (moves, time, optimal move count) and a *Play Again* button.
Interface in Turkish and English (`?lang=tr|en`, otherwise the browser language).

## Architecture

```
camera ──▶ MediaPipe HandLandmarker (WASM + WebGL/CPU delegate)
              │ 21 landmarks × 2 hands, every frame
              ▼
        gesture-detector  ──▶  gesture-mapping  ──▶  MoveExecutor ──▶ cube-engine (state)
        fist / pinch /         screen-space face       queue + layer        8 corner cubies,
        finger count           grid, swipe → move      animations           integer rotation matrices
                                                            │
                                                            ▼
                                                   solver (IDA*) ──▶ hint overlay (three.js)
```

- **`src/cube-engine`**: pure cube model: 8 corners, each an integer 3×3 rotation matrix.
  Moves are matrix products; the solved test is orientation-agnostic.
- **`src/solver`**: IDA* with a permutation-distance pruning table (7! = 5 040 entries),
  built at load time by BFS. God's number for the 2×2 is 11, so random scrambles solve in
  milliseconds. The solver works in a normalized frame (reference corner fixed) and its
  output is converted back to the physical cube before it is shown.
- **`src/hand-tracking`**: MediaPipe wrapper and gesture primitives (pinch, grab with
  hysteresis, deliberate finger count with an ambiguity band).
- **`src/gesture-mapping`**: geometry: which world axis is "horizontal" on screen, which
  cube face the camera sees, how a swipe on a cell maps to a move, and the inverse of that
  for hints.
- **`src/render`**: three.js scene, cubies, layer pivots, snapping, selection/hint overlays.
- **`src/ui`**: HUD, gesture guide, hint help, end-of-game panel. Plain DOM, no framework;
  all text comes from `src/strings.ts`.
- **`src/app.ts`**: wires everything; the host only provides a `<video>` and strings.

### Where does inference run?

Entirely on the visitor's device. MediaPipe prefers the **GPU delegate** (WebGL); when
WebGL is unavailable it falls back to the **CPU delegate** (WASM), slower but functional.
The server only ships static files (≈7.8 MB hand-landmarker model + WASM runtime), so
hosting cost is independent of traffic and no camera data is transmitted.

## Benchmarks

Hand-tracking inference time per frame (`detectForVideo`, both hands visible, slow cube
rotation, 30 s window). fps is the effective tracking rate and is capped by the camera
and the display refresh rate.

| Device | Browser | Camera | Delegate | p50 | p95 | fps |
|---|---|---|---|---|---|---|
| NVIDIA RTX 3060 Laptop ¹ | Chrome 136 | 1280×720 | GPU (WebGL) | 16.1 ms | 17.3 ms | 57 |
| Intel UHD Graphics (TGL GT1, iGPU) | Chrome 136 | 1280×720 | GPU (WebGL) | 20.1 ms | 22.8 ms | 51 |
| Intel Core i7-11800H | Chrome 136 | 1280×720 | CPU (WASM) | 59.3 ms | 62.3 ms | 21 |
| iPhone 12 Pro (A14) | Safari | 1080×1920 | GPU (WebGL) | 33 ms | 42 ms | 25 |
| iPhone 12 Pro (A14) | Safari | 1080×1920 | CPU (WASM) | 96 ms | 98 ms | 10 |

¹ Linux, proprietary NVIDIA driver, Chrome using the ANGLE Vulkan backend. Laptop rows
measured on the same machine with its built-in webcam (720p max). The app requests 1080p and falls back to what the camera offers.

Takeaways: an integrated GPU is within 25 % of a discrete one, since the model is small;
the CPU path is ~3× slower but keeps the game playable; on phones the GPU is shared with
rendering, hence the wider p50–p95 gap.

Reproduce with the built-in readout (see below).

## Running locally

Requirements: Node 20+, pnpm.

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm test           # vitest
pnpm typecheck
pnpm lint
pnpm build          # static output in dist/
```

`pnpm install` also copies the MediaPipe WASM runtime from `node_modules` into
`public/mediapipe/` (git-ignored), so the served files always match the installed
`@mediapipe/tasks-vision` version.

### Deploying

`pnpm build` produces a fully static `dist/`; serve it from any static host (Nginx,
Vercel, GitHub Pages, S3). There is no server-side component, so no container is needed.

### Benchmark readout and delegate override

| | URL parameter | Environment (`.env`, see `.env.example`) |
|---|---|---|
| Force delegate | `?delegate=cpu` / `?delegate=gpu` | `VITE_HAND_DELEGATE=CPU` |
| Perf readout | `?stats=1` (`?stats=0` hides it in dev) | `VITE_PERF_STATS=1` |

The readout (bottom-left) shows the active delegate, p50/p95 inference time over the last
30 s, fps and sample count. It is always on in `pnpm dev`.

### Testing on a phone

Camera access requires HTTPS outside `localhost`.

```bash
mkcert -install
mkdir -p certs
mkcert -cert-file certs/dev-cert.pem -key-file certs/dev-key.pem localhost <your-lan-ip>
pnpm dev:https      # https://<your-lan-ip>:5173
```

Open the address on the phone (same Wi-Fi) and accept the certificate warning.
`certs/` is git-ignored.

### Developer shortcuts

In `pnpm dev` only: `U D L R F B` apply a move (Shift = inverse), `0` resets the cube.
Disabled in production builds; the product is gesture-driven.

## Embedding in a host page

The package entry (`src/index.ts`) exposes the same engine the standalone page uses. The
host owns the camera and hands over a ready `<video>`:

```ts
import { initGestureCube, STRINGS_BY_LOCALE } from "gesture-cube";

const instance = initGestureCube(container, {
  video,                                   // a playing HTMLVideoElement
  mirrored: facingMode === "user",
  strings: STRINGS_BY_LOCALE.en,
  assetPaths: { wasmBasePath: "/gesture-cube/wasm", modelPath: "/gesture-cube/hand_landmarker.task" },
  watermark: false,                        // the host draws its own
  videoBackground: false,                  // the host already shows the <video> under the canvas
  autoLoad: true,                          // load the model right away; the player clicks once
  onEvent: (type) => track(type),          // "play_start" | "successful_detection" | "completion"
  onStatus: (s) => panel.update(s),        // live session snapshot (phase, hands, delegate, ms, moves)
});
instance.setSpaciousLayout(isFullscreen);  // toggles the gesture guide
instance.drawOverlay(ctx, dx, dy, dw, dh); // 3D layer for photo/video capture
instance.destroy();
```

`gesture-cube/strings` exposes only the UI strings and locale helpers (no MediaPipe or
three.js imports), for hosts that build their dictionaries on the server.

The host serves the MediaPipe WASM runtime (from `@mediapipe/tasks-vision/wasm`) and
`public/models/hand_landmarker.task` at the paths given in `assetPaths`. The entry is
TypeScript source; bundlers that consume it must transpile the package.

## Known limits

- **Phones: portrait only.** Landscape phones leave ~300 px of height, not enough for the
  cube and the HUD; a "rotate your phone" screen is shown. Tablets are tall enough in
  both orientations.
- Gesture recognition needs reasonable lighting and both hands in frame; finger counting
  uses a strict threshold and deliberately ignores ambiguous hand poses.
- The hint shows the optimal next move from the current state; it does not "teach" a
  method.

## Model and licenses

- Hand tracking: [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
  (`hand_landmarker.task`, Apache 2.0) and `@mediapipe/tasks-vision`.
- Rendering: [three.js](https://threejs.org) (MIT).
- This project's own code: see [LICENSE](LICENSE).
