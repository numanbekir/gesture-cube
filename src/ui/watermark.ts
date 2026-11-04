import { svgEl } from "./primitives";
import { FONT_SANS } from "./theme";

// 64 px viewfinder mark and 12 px "tanirim.com" label, bottom-right, 80 % opacity.
// Standalone only; an embedding host can render its own.
let instanceCounter = 0;

export function createWatermark(container: HTMLElement): () => void {
  // SVG gradient ids are document-global; make each instance unique
  const gradientId = `gc-wm-g-${++instanceCounter}`;
  const root = document.createElement("div");
  root.style.position = "absolute";
  root.style.right = "12px";
  root.style.bottom = "12px";
  root.style.zIndex = "10";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.alignItems = "center";
  root.style.gap = "4px";
  root.style.opacity = "0.8";
  root.style.filter = "drop-shadow(0 4px 3px rgba(0,0,0,0.35))";
  root.style.pointerEvents = "none";

  const svg = svgEl("svg", { viewBox: "0 0 32 32", fill: "none", "aria-hidden": "true" });
  svg.style.width = "64px";
  svg.style.height = "64px";
  const defs = svgEl("defs", {});
  const grad = svgEl("linearGradient", { id: gradientId, x1: "2", y1: "2", x2: "30", y2: "30", gradientUnits: "userSpaceOnUse" });
  grad.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#6366f1" }));
  grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#38bdf8" }));
  defs.appendChild(grad);
  svg.appendChild(defs);
  for (const d of ["M11 4H7a3 3 0 0 0-3 3v4", "M21 4h4a3 3 0 0 1 3 3v4", "M4 21v4a3 3 0 0 0 3 3h4", "M28 21v4a3 3 0 0 1-3 3h-4"]) {
    svg.appendChild(svgEl("path", { d, stroke: `url(#${gradientId})`, "stroke-width": "2.4", "stroke-linecap": "round" }));
  }
  svg.appendChild(svgEl("circle", { cx: "12", cy: "14", r: "1.6", fill: `url(#${gradientId})` }));
  svg.appendChild(svgEl("circle", { cx: "20", cy: "14", r: "1.6", fill: `url(#${gradientId})` }));
  svg.appendChild(svgEl("path", { d: "M12.5 19h7M16 19v6", stroke: "#f4f4f5", "stroke-width": "2.4", "stroke-linecap": "round", "stroke-linejoin": "round" }));

  const label = document.createElement("span");
  label.textContent = "tanirim.com";
  label.style.font = `600 12px ${FONT_SANS}`;
  label.style.letterSpacing = "-0.01em";
  label.style.color = "#f4f4f5";

  root.append(svg, label);
  container.appendChild(root);
  return () => root.remove();
}
