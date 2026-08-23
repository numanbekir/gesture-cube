import { COLOR_ACCENT_GREEN, COLOR_TEXT, GLASS_BORDER, applyLabelStyle } from "./theme";
import type { GestureCubeStrings } from "../strings";

export interface SolvedStats {
  readonly moves: number;
  readonly timeMs: number;
  readonly optimalMoves: number;
}

export interface SolvedContentHandle {
  readonly element: HTMLElement;
  readonly update: (stats: SolvedStats) => void;
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function createStat(label: string): { element: HTMLElement; value: HTMLElement } {
  const col = document.createElement("div");
  col.style.display = "flex";
  col.style.flexDirection = "column";
  col.style.alignItems = "center";
  col.style.gap = "2px";
  col.style.minWidth = "0";
  const value = document.createElement("span");
  value.style.fontSize = "1.5em";
  value.style.fontWeight = "700";
  value.style.fontVariantNumeric = "tabular-nums";
  value.style.lineHeight = "1.1";
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  applyLabelStyle(labelEl);
  col.append(value, labelEl);
  return { element: col, value };
}

// End-of-game content shown in place of the live HUD: title, moves · time · optimal,
// and a restart button. Created twice (wide + narrow), like the HUD.
export function createSolvedContent(strings: GestureCubeStrings["gestureGuide"]["solved"], onRestart: () => void): SolvedContentHandle {
  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.alignItems = "center";
  root.style.gap = "clamp(10px, 2.4vw, 14px)";
  root.style.width = "100%";
  root.style.boxSizing = "border-box";
  root.style.textAlign = "center";

  const title = document.createElement("div");
  title.textContent = strings.title;
  title.style.fontWeight = "700";
  title.style.fontSize = "1.3em";
  title.style.letterSpacing = "0.04em";
  title.style.color = COLOR_ACCENT_GREEN;
  title.style.textShadow = `0 0 18px ${COLOR_ACCENT_GREEN}55`;

  const subtitle = document.createElement("div");
  subtitle.textContent = strings.subtitle;
  subtitle.style.opacity = "0.7";
  subtitle.style.fontSize = "0.9em";

  const stats = document.createElement("div");
  stats.style.display = "grid";
  stats.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  stats.style.gap = "clamp(8px, 2vw, 14px)";
  stats.style.width = "100%";
  stats.style.padding = "clamp(8px, 2vw, 12px) 0";
  stats.style.borderTop = GLASS_BORDER;
  stats.style.borderBottom = GLASS_BORDER;
  const moves = createStat(strings.movesLabel);
  const time = createStat(strings.timeLabel);
  const optimal = createStat(strings.optimalLabel);
  stats.append(moves.element, time.element, optimal.element);

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = strings.restartButton;
  button.style.font = "inherit";
  button.style.fontWeight = "700";
  button.style.fontSize = "0.95em";
  button.style.letterSpacing = "0.04em";
  button.style.color = "#0b0b0f";
  button.style.background = COLOR_ACCENT_GREEN;
  button.style.border = "none";
  button.style.borderRadius = "999px";
  button.style.padding = "10px 22px";
  button.style.cursor = "pointer";
  button.style.pointerEvents = "auto";
  button.style.boxShadow = `0 8px 24px ${COLOR_ACCENT_GREEN}44`;
  button.style.transition = "transform 0.15s ease, filter 0.15s ease";
  button.addEventListener("mouseenter", () => { button.style.transform = "scale(1.04)"; });
  button.addEventListener("mouseleave", () => { button.style.transform = "scale(1)"; });
  button.addEventListener("click", onRestart);

  root.append(title, subtitle, stats, button);
  root.style.color = COLOR_TEXT;

  return {
    element: root,
    update(s) {
      moves.value.textContent = String(s.moves);
      time.value.textContent = formatTime(s.timeMs);
      optimal.value.textContent = String(s.optimalMoves);
    },
  };
}
