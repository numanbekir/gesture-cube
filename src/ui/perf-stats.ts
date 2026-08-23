import { COLOR_TEXT_MUTED, FONT_SANS } from "./theme";
import type { HandDelegate } from "../hand-tracking/hand-landmarker";

export interface PerfStats {
  readonly setDelegate: (delegate: HandDelegate) => void;
  readonly setSource: (width: number, height: number) => void;
  // inference time of one frame in ms; smoothed internally
  readonly addSample: (ms: number) => void;
  readonly remove: () => void;
}

const REFRESH_MS = 500;
const WINDOW_MS = 30_000;

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[index];
}

// Bottom-left readout for benchmarking: delegate, inference p50/p95 over the last 30 s,
// and fps. Opt-in via GestureCubeOptions.perfStats; never shown in production.
export function createPerfStats(container: HTMLElement): PerfStats {
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.left = "10px";
  el.style.bottom = "10px";
  el.style.zIndex = "10";
  el.style.padding = "4px 8px";
  el.style.borderRadius = "6px";
  el.style.background = "rgba(15,15,20,0.55)";
  el.style.color = COLOR_TEXT_MUTED;
  el.style.font = `11px ${FONT_SANS}`;
  el.style.fontVariantNumeric = "tabular-nums";
  el.style.letterSpacing = "0.04em";
  el.style.pointerEvents = "none";
  el.textContent = "…";
  container.appendChild(el);

  let delegate: HandDelegate | null = null;
  let source = "";
  const samples: { t: number; ms: number }[] = [];
  let lastRender = 0;

  function render(now: number) {
    if (now - lastRender < REFRESH_MS) return;
    lastRender = now;
    while (samples.length > 0 && now - samples[0].t > WINDOW_MS) samples.shift();
    const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
    const span = samples.length > 1 ? samples[samples.length - 1].t - samples[0].t : 0;
    const fps = span > 0 ? Math.round(((samples.length - 1) * 1000) / span) : 0;
    const ms = sorted.length === 0 ? "– ms" : `p50 ${percentile(sorted, 0.5).toFixed(1)} ms · p95 ${percentile(sorted, 0.95).toFixed(1)} ms`;
    el.textContent = `${delegate ?? "?"}${source ? ` · ${source}` : ""} · ${ms} · ${fps} fps · ${Math.round(Math.min(span, WINDOW_MS) / 1000)}s · n=${samples.length}`;
  }

  return {
    setDelegate(d) {
      delegate = d;
      render(performance.now());
    },
    setSource(width, height) {
      source = `${width}×${height}`;
      render(performance.now());
    },
    addSample(ms) {
      const now = performance.now();
      samples.push({ t: now, ms });
      render(now);
    },
    remove() {
      el.remove();
    },
  };
}
