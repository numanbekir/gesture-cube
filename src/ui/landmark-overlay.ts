import { HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { COLOR_ACCENT_BLUE, COLOR_ACCENT_GREEN } from "./theme";

export function createLandmarkOverlay(container: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  container.appendChild(canvas);
  return canvas;
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type Pt = { x: number; y: number };

// Visual-only smoothing of the drawn landmarks (gesture logic uses the raw values and
// has its own hysteresis). Adaptive: a still hand is filtered hard so it does not
// jitter, a fast-moving hand follows almost raw so there is no visible lag.
const SMOOTH_MIN = 0.12; // blend factor when still
const SMOOTH_MAX = 0.85; // blend factor when moving fast
const SMOOTH_SPEED_REF = 0.02; // normalized movement per frame that counts as "fast"
// per-overlay state (keyed by canvas) — no module-level state shared between instances
const smoothedByCanvas = new WeakMap<HTMLCanvasElement, Map<string, Pt[]>>();

function smoothHand(smoothed: Map<string, Pt[]>, key: string, raw: readonly Pt[]): Pt[] {
  const prev = smoothed.get(key);
  if (!prev || prev.length !== raw.length) {
    const copy = raw.map((p) => ({ ...p }));
    smoothed.set(key, copy);
    return copy;
  }
  // hand-level speed from the wrist and middle MCP so every joint gets the same response
  const speed = (Math.hypot(raw[0].x - prev[0].x, raw[0].y - prev[0].y) + Math.hypot(raw[9].x - prev[9].x, raw[9].y - prev[9].y)) / 2;
  const k = Math.min(1, speed / SMOOTH_SPEED_REF);
  const alpha = SMOOTH_MIN + (SMOOTH_MAX - SMOOTH_MIN) * k;
  for (let i = 0; i < raw.length; i++) {
    prev[i].x += (raw[i].x - prev[i].x) * alpha;
    prev[i].y += (raw[i].y - prev[i].y) * alpha;
  }
  return prev;
}

// MediaPipe's classic skeleton (straight bones + joint dots), lightly styled: left hand
// green, right hand blue (HUD accents), a soft glow under the bones, white joint dots.
// Must receive the same `mirrored` value as the video background.
export function drawLandmarks(canvas: HTMLCanvasElement, result: HandLandmarkerResult, mirrored: boolean): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const unit = Math.max(1, Math.min(w, h) / 540);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let smoothed = smoothedByCanvas.get(canvas);
  if (!smoothed) {
    smoothed = new Map();
    smoothedByCanvas.set(canvas, smoothed);
  }
  const seen = new Set<string>();
  result.landmarks.forEach((rawLandmarks, i) => {
    const label = result.handedness[i]?.[0]?.categoryName ?? `hand-${i}`;
    const color = label === "Left" ? COLOR_ACCENT_GREEN : COLOR_ACCENT_BLUE;
    seen.add(label);
    const landmarks = smoothHand(smoothed, label, rawLandmarks);
    const px = (x: number) => (mirrored ? 1 - x : x) * w;
    const py = (y: number) => y * h;

    // bones: glow pass + crisp pass
    for (const [width, style] of [[6 * unit, withAlpha(color, 0.2)], [2 * unit, color]] as const) {
      ctx.lineWidth = width;
      ctx.strokeStyle = style;
      ctx.beginPath();
      for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
        const a = landmarks[start];
        const b = landmarks[end];
        if (!a || !b) continue;
        ctx.moveTo(px(a.x), py(a.y));
        ctx.lineTo(px(b.x), py(b.y));
      }
      ctx.stroke();
    }

    // joints: white dots with a thin accent ring
    for (const p of landmarks) {
      ctx.beginPath();
      ctx.arc(px(p.x), py(p.y), 3 * unit, 0, Math.PI * 2);
      ctx.fillStyle = "#f4f4f5";
      ctx.fill();
      ctx.lineWidth = 1 * unit;
      ctx.strokeStyle = withAlpha(color, 0.9);
      ctx.stroke();
    }
  });
  // forget hands that left the frame so they do not glide in from a stale position
  for (const key of smoothed.keys()) if (!seen.has(key)) smoothed.delete(key);
}
