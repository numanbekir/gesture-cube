import { COLOR_TEXT, FONT_BASE, GLASS_BG, GLASS_BG_SOLID, GLASS_BORDER } from "./theme";

const SVG_NS = "http://www.w3.org/2000/svg";

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  return el;
}

// Glass card used by every panel (guide, HUD, hint help).
export function createCardElement(): HTMLElement {
  const card = document.createElement("div");
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.gap = "clamp(14px, 3vw, 20px)";
  card.style.padding = "clamp(14px, 3.4vw, 22px)";
  card.style.borderRadius = "20px";
  card.style.background = GLASS_BG;
  card.style.border = GLASS_BORDER;
  card.style.boxShadow = "0 16px 44px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.09)";
  card.style.backdropFilter = "blur(8px)";
  // Pre-composite the blur layer so the first fade-in does not lag behind the card.
  card.style.willChange = "opacity, backdrop-filter";
  card.style.color = COLOR_TEXT;
  card.style.font = FONT_BASE;
  card.style.boxSizing = "border-box";
  return card;
}

// Round corner button ("?" / "✕"). Hidden by default; the caller controls visibility.
export function createCornerButton(text: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", ariaLabel);
  button.textContent = text;
  button.style.position = "absolute";
  button.style.top = "10px";
  button.style.right = "10px";
  button.style.width = "28px";
  button.style.height = "28px";
  button.style.borderRadius = "50%";
  button.style.border = "1px solid rgba(255,255,255,0.14)";
  button.style.background = GLASS_BG_SOLID;
  button.style.color = COLOR_TEXT;
  button.style.fontSize = "13px";
  button.style.fontWeight = "700";
  button.style.display = "none";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.cursor = "pointer";
  button.style.pointerEvents = "auto"; // wrapper has pointer-events:none
  button.addEventListener("click", onClick);
  return button;
}
