// Typography and color tokens — single source for all UI modules.
// System font stack on purpose: no bundled font in the showcase; on the platform the
// host container provides Geist, which system-ui matches closely enough.
export const FONT_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// One base size; everything inside cards scales with em. The hint help panel is the
// only deliberate exception (it stands alone in the center of the screen).
export const FONT_SIZE_BASE = "clamp(13px, 3.1vw, 16px)";
export const FONT_SIZE_LARGE = "clamp(15px, 3.8vw, 18px)";
// Note: the `font` shorthand is invalid without a size and silently ignored — use these.
export const FONT_BASE = `${FONT_SIZE_BASE} ${FONT_SANS}`;
export const FONT_LARGE = `${FONT_SIZE_LARGE} ${FONT_SANS}`;

export const COLOR_TEXT = "#e5e7eb";
export const COLOR_TEXT_MUTED = "#9ca3af";
export const COLOR_TEXT_DISABLED = "#6b7280";
export const COLOR_ACCENT_GREEN = "#4ade80";
export const COLOR_ACCENT_BLUE = "#38bdf8";

// Frosted "glass" card surface shared by every panel.
export const GLASS_BG = "linear-gradient(165deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 45%), rgba(15,15,20,0.32)";
export const GLASS_BG_SOLID = "rgba(15,15,20,0.55)";
export const GLASS_BORDER = "1px solid rgba(255,255,255,0.12)";
export const GLASS_DIVIDER = "rgba(255,255,255,0.12)";

// Small uppercase label (LEFT HAND / MOVES / HINT …), identical everywhere.
export function applyLabelStyle(el: HTMLElement): void {
  el.style.fontSize = "0.78em";
  el.style.letterSpacing = "0.04em";
  el.style.opacity = "0.6";
  el.style.color = COLOR_TEXT;
}
