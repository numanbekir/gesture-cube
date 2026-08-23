import { COLOR_TEXT, COLOR_TEXT_MUTED, FONT_BASE } from "./theme";
import { svgEl } from "./primitives";
import type { GestureCubeStrings } from "../strings";

// Landscape phones leave ~300px of height, not enough for the cube plus the HUD. The gate
// is driven by the viewport's height, not orientation, so landscape tablets are unaffected.
// It measures the viewport (what "rotate your phone" can change), not the container: an
// embedding host may render a small landscape box on a portrait phone and go fullscreen
// only later.
const MIN_HEIGHT_PX = 480;

export interface OrientationGate {
  readonly remove: () => void;
}

function createRotateIcon(): SVGSVGElement {
  const svg = svgEl("svg", { viewBox: "0 0 64 64" });
  svg.style.width = "56px";
  svg.style.height = "56px";
  const g = svgEl("g", { fill: "none", stroke: COLOR_TEXT, "stroke-width": "2.2", "stroke-linecap": "round", "stroke-linejoin": "round" });
  g.appendChild(svgEl("rect", { x: "8", y: "30", width: "48", height: "24", rx: "3" })); // phone, landscape
  g.appendChild(svgEl("line", { x1: "8", y1: "42", x2: "12", y2: "42" })); // home indicator
  g.appendChild(svgEl("path", { d: "M50 22 A20 20 0 0 0 18 14" })); // rotation arrow
  g.appendChild(svgEl("path", { d: "M17 8 L18 14 L24 13" }));
  svg.appendChild(g);
  return svg;
}

export function createOrientationGate(container: HTMLElement, strings: GestureCubeStrings["orientationGate"]): OrientationGate {
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.zIndex = "30";
  overlay.style.display = "none";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.gap = "12px";
  overlay.style.padding = "24px";
  overlay.style.boxSizing = "border-box";
  overlay.style.background = "rgba(5,5,7,0.92)";
  overlay.style.color = COLOR_TEXT;
  overlay.style.font = FONT_BASE;
  overlay.style.textAlign = "center";

  const title = document.createElement("div");
  title.textContent = strings.title;
  title.style.fontWeight = "700";
  title.style.fontSize = "1.15em";
  title.style.letterSpacing = "0.02em";

  const text = document.createElement("div");
  text.textContent = strings.text;
  text.style.color = COLOR_TEXT_MUTED;
  text.style.maxWidth = "32ch";
  text.style.lineHeight = "1.4";

  overlay.append(createRotateIcon(), title, text);
  container.appendChild(overlay);

  function update() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    overlay.style.display = h < MIN_HEIGHT_PX && w > h ? "flex" : "none";
  }
  const observer = new ResizeObserver(update);
  observer.observe(container);
  window.addEventListener("resize", update);
  update();

  return {
    remove() {
      observer.disconnect();
      window.removeEventListener("resize", update);
      overlay.remove();
    },
  };
}
