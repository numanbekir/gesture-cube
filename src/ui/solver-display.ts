import { COLOR_TEXT, FONT_BASE, FONT_LARGE, GLASS_BG, GLASS_BORDER, GLASS_DIVIDER, applyLabelStyle } from "./theme";
import { svgEl, createCardElement, createCornerButton } from "./primitives";
import type { HintHelpStep, GestureCubeStrings } from "../strings";
import { HINT_COLOR_CSS } from "../render/hint-arrow";

// Thin line-art isometric cube icon, matching the hand icons in gesture-guide.ts.
function createBoxIcon(): SVGSVGElement {
  const svg = svgEl("svg", { viewBox: "0 0 28 28" });
  svg.style.flexShrink = "0";
  svg.style.display = "block";
  // same clamp as the move count so both read as one unit
  svg.style.width = "clamp(28px, 5vw, 40px)";
  svg.style.height = "clamp(28px, 5vw, 40px)";
  const group = svgEl("g", { fill: "none", stroke: COLOR_TEXT, "stroke-width": "1.4", "stroke-linejoin": "round" });
  group.appendChild(svgEl("path", { d: "M14 3 L23 8 L14 13 L5 8 Z" }));
  group.appendChild(svgEl("path", { d: "M5 8 L14 13 L14 24 L5 19 Z" }));
  group.appendChild(svgEl("path", { d: "M23 8 L14 13 L14 24 L23 19 Z" }));
  svg.appendChild(group);
  return svg;
}


// ---- hint help illustrations ----
// Same line-art style; hint elements use HINT_COLOR_CSS so they match the cube exactly.
const ILLUS_STROKE = COLOR_TEXT;
const ILLUS_SIZE = "clamp(68px, 16vw, 92px)";

type Pt = readonly [number, number];
function lerp(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
// 2×2 grid lines inside a parallelogram (works for each face of the isometric cube).
function gridLines(group: SVGGElement, a: Pt, b: Pt, c: Pt, d: Pt): void {
  for (const t of [1 / 2]) {
    const p1 = lerp(a, b, t), p2 = lerp(d, c, t);
    const q1 = lerp(a, d, t), q2 = lerp(b, c, t);
    group.appendChild(svgEl("path", { d: `M${p1[0]} ${p1[1]} L${p2[0]} ${p2[1]}` }));
    group.appendChild(svgEl("path", { d: `M${q1[0]} ${q1[1]} L${q2[0]} ${q2[1]}` }));
  }
}
function quadPath(a: Pt, b: Pt, c: Pt, d: Pt): string {
  return `M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]} L${d[0]} ${d[1]} Z`;
}
function createIllusSvg(): SVGSVGElement {
  const svg = svgEl("svg", { viewBox: "0 0 64 64" });
  svg.style.display = "block";
  svg.style.flexShrink = "0";
  svg.style.width = ILLUS_SIZE;
  svg.style.height = ILLUS_SIZE;
  svg.style.filter = `drop-shadow(0 0 6px ${HINT_COLOR_CSS}55)`;
  return svg;
}

// Step 1: isometric 2×2 cube, hint frame around the facing face.
function createCubeFrameIllustration(): SVGSVGElement {
  const svg = createIllusSvg();
  const top: [Pt, Pt, Pt, Pt] = [[32, 6], [56, 18], [32, 30], [8, 18]];
  const left: [Pt, Pt, Pt, Pt] = [[8, 18], [32, 30], [32, 58], [8, 46]];
  const right: [Pt, Pt, Pt, Pt] = [[32, 30], [56, 18], [56, 46], [32, 58]];
  const lines = svgEl("g", { fill: "none", stroke: ILLUS_STROKE, "stroke-width": "1.1", "stroke-linejoin": "round", opacity: "0.8" });
  for (const f of [top, left, right]) {
    lines.appendChild(svgEl("path", { d: quadPath(...f) }));
    gridLines(lines, ...f);
  }
  svg.appendChild(lines);
  // hint frame
  svg.appendChild(svgEl("path", { d: quadPath(...left), fill: "none", stroke: HINT_COLOR_CSS, "stroke-width": "2.6", "stroke-linejoin": "round" }));
  return svg;
}

// Steps 2/3: flat 2×2 face, ring on the top-right cell, plus a swipe arrow for step 3.
function createFaceGridIllustration(withArrow: boolean): SVGSVGElement {
  const svg = createIllusSvg();
  const sq: [Pt, Pt, Pt, Pt] = [[8, 8], [56, 8], [56, 56], [8, 56]];
  const lines = svgEl("g", { fill: "none", stroke: ILLUS_STROKE, "stroke-width": "1.1", "stroke-linejoin": "round", opacity: "0.8" });
  lines.appendChild(svgEl("path", { d: quadPath(...sq) }));
  gridLines(lines, ...sq);
  svg.appendChild(lines);
  // top-right cell center (ring ratio matches cell-marker.ts)
  const cx = 44, cy = 20;
  svg.appendChild(svgEl("circle", { cx: String(cx), cy: String(cy), r: "6", fill: "none", stroke: HINT_COLOR_CSS, "stroke-width": "2.6" }));
  if (withArrow) {
    // body + head, leading away from the ring
    const arrow = svgEl("g", { fill: "none", stroke: HINT_COLOR_CSS, "stroke-width": "2.4", "stroke-linecap": "round", "stroke-linejoin": "round" });
    arrow.appendChild(svgEl("path", { d: `M${cx - 9} ${cy} L14 ${cy}` }));
    arrow.appendChild(svgEl("path", { d: `M20 ${cy - 5} L14 ${cy} L20 ${cy + 5}` }));
    svg.appendChild(arrow);
    // small double-headed arrow below: "half turn, either way"
    const dbl = svgEl("g", { fill: "none", stroke: HINT_COLOR_CSS, "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", opacity: "0.8" });
    dbl.appendChild(svgEl("path", { d: "M16 46 L48 46" }));
    dbl.appendChild(svgEl("path", { d: "M21 42 L16 46 L21 50" }));
    dbl.appendChild(svgEl("path", { d: "M43 42 L48 46 L43 50" }));
    svg.appendChild(dbl);
  }
  return svg;
}

function createHelpStepRow(index: number, step: HintHelpStep, illustration: SVGSVGElement): HTMLElement {
  const row = document.createElement("div");
  row.style.display = "grid";
  row.style.gridTemplateColumns = "auto minmax(0, 1fr)";
  row.style.alignItems = "center";
  row.style.gap = "clamp(14px, 3.2vw, 20px)";

  const textCol = document.createElement("div");
  textCol.style.display = "flex";
  textCol.style.flexDirection = "column";
  textCol.style.gap = "4px";

  const labelEl = document.createElement("div");
  labelEl.style.display = "flex";
  labelEl.style.alignItems = "baseline";
  labelEl.style.gap = "6px";
  const num = document.createElement("span");
  num.textContent = String(index + 1);
  num.style.color = HINT_COLOR_CSS;
  num.style.fontWeight = "700";
  num.style.fontSize = "0.95em";
  num.style.textShadow = `0 0 12px ${HINT_COLOR_CSS}66`;
  const label = document.createElement("span");
  label.textContent = step.label;
  label.style.fontWeight = "700";
  label.style.fontSize = "0.9em";
  label.style.letterSpacing = "0.06em";
  labelEl.append(num, label);

  const text = document.createElement("div");
  text.textContent = step.text;
  text.style.opacity = "0.7";
  text.style.fontSize = "0.88em";
  text.style.lineHeight = "1.4";

  textCol.append(labelEl, text);
  row.append(illustration, textCol);
  return row;
}

// "?" help card: same glass look and heading layout as the guide panels, hint accent.
// Centered on screen and shown instead of the live HUD (app.ts hides it via onHelpOpenChange).
function createHelpPanel(strings: GestureCubeStrings["solverDisplay"]["help"], onClose: () => void): HTMLElement {
  const card = createCardElement();
  card.style.position = "absolute";
  card.style.top = "50%";
  card.style.left = "50%";
  card.style.transform = "translate(-50%, -50%)";
  card.style.zIndex = "11"; // above panels (10)
  // deliberately larger than the guide cards
  card.style.width = "min(clamp(320px, 86vw, 440px), calc(100vw - 24px))";
  card.style.gap = "clamp(16px, 3.4vw, 22px)";
  card.style.padding = "clamp(18px, 4.2vw, 28px)";
  card.style.font = FONT_LARGE;

  const heading = document.createElement("div");
  const titleEl = document.createElement("div");
  titleEl.textContent = strings.title;
  titleEl.style.fontWeight = "700";
  titleEl.style.fontSize = "1.3em";
  titleEl.style.color = HINT_COLOR_CSS;
  titleEl.style.letterSpacing = "0.02em";
  titleEl.style.textShadow = `0 0 18px ${HINT_COLOR_CSS}55`;
  titleEl.style.paddingRight = "32px"; // clear the ✕ button
  const subtitleEl = document.createElement("div");
  subtitleEl.textContent = strings.subtitle;
  subtitleEl.style.opacity = "0.75";
  subtitleEl.style.fontSize = "0.85em";
  subtitleEl.style.letterSpacing = "0.03em";
  const rule = document.createElement("div");
  rule.style.width = "28px";
  rule.style.height = "2px";
  rule.style.background = HINT_COLOR_CSS;
  rule.style.opacity = "0.6";
  rule.style.margin = "4px 0";
  heading.append(titleEl, subtitleEl, rule);

  const [s1, s2, s3] = strings.steps;
  card.append(
    heading,
    createHelpStepRow(0, s1, createCubeFrameIllustration()),
    createHelpStepRow(1, s2, createFaceGridIllustration(false)),
    createHelpStepRow(2, s3, createFaceGridIllustration(true)),
  );

  const closeButton = createCornerButton("✕", strings.closeAriaLabel, onClose);
  closeButton.style.display = "flex";
  card.appendChild(closeButton);
  return card;
}

export interface SolverDisplay {
  // count=0 renders as solved
  readonly setMinimumMoves: (count: number) => void;
  // Updates the switch look only; the hint itself is drawn on the cube.
  readonly setHintActive: (active: boolean) => void;
  // Used by gesture-guide.ts to anchor the mobile HUD below this panel.
  readonly element: HTMLElement;
  // Hidden while the gesture guide is open.
  readonly setVisible: (visible: boolean) => void;
  // Closes the help panel from outside (e.g. when the gesture guide opens).
  readonly closeHelp: () => void;
  readonly remove: () => void;
}

// Top-center pill: minimum remaining moves + hint on/off switch + "?" help button.
// onHelpOpenChange fires when the help panel opens/closes.
export function createSolverDisplay(container: HTMLElement, strings: GestureCubeStrings["solverDisplay"], onToggleHint: () => void, onHelpOpenChange: (open: boolean) => void): SolverDisplay {
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.top = "80px";
  wrapper.style.left = "50%";
  wrapper.style.transform = "translateX(-50%)";
  wrapper.style.zIndex = "10"; // above the play-screen overlay
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "8px";
  wrapper.style.transition = "opacity 0.4s ease";

  const badge = document.createElement("div");
  badge.style.display = "flex";
  badge.style.alignItems = "center";
  badge.style.gap = "14px";
  // same glass tone as the guide cards
  badge.style.padding = "11px 16px";
  badge.style.borderRadius = "999px";
  badge.style.background = GLASS_BG;
  badge.style.border = GLASS_BORDER;
  badge.style.backdropFilter = "blur(8px)";
  badge.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.09)";
  badge.style.color = COLOR_TEXT;
  badge.style.font = FONT_BASE; // shorthand needs a size, see theme.ts

  const icon = createBoxIcon();

  const textCol = document.createElement("div");
  textCol.style.display = "flex";
  textCol.style.flexDirection = "column";
  textCol.style.alignItems = "flex-start";
  textCol.style.lineHeight = "1.1";

  const countEl = document.createElement("span");
  countEl.style.fontSize = "clamp(28px, 5vw, 40px)";
  countEl.style.fontWeight = "700";
  countEl.style.fontVariantNumeric = "tabular-nums";

  const labelEl = document.createElement("span");
  applyLabelStyle(labelEl);
  labelEl.style.marginTop = "2px";

  textCol.append(countEl, labelEl);
  badge.append(icon, textCol);

  // divider between the counter and the switch
  const divider = document.createElement("div");
  divider.style.width = "1px";
  divider.style.alignSelf = "stretch";
  divider.style.background = GLASS_DIVIDER;

  // hint on/off toggle, label above the track
  const switchRow = document.createElement("label");
  switchRow.style.display = "flex";
  switchRow.style.flexDirection = "column";
  switchRow.style.alignItems = "center";
  switchRow.style.gap = "5px";
  switchRow.style.cursor = "pointer";

  const switchLabel = document.createElement("span");
  switchLabel.textContent = strings.hintLabel;
  applyLabelStyle(switchLabel);
  switchLabel.style.opacity = "0.85"; // clickable control, slightly stronger than HUD labels

  const track = document.createElement("div");
  track.style.width = "32px";
  track.style.height = "18px";
  track.style.borderRadius = "999px";
  track.style.background = "rgba(255,255,255,0.2)";
  track.style.position = "relative";
  track.style.transition = "background 0.15s ease";
  track.style.flexShrink = "0";

  const knob = document.createElement("div");
  knob.style.position = "absolute";
  knob.style.top = "2px";
  knob.style.left = "2px";
  knob.style.width = "14px";
  knob.style.height = "14px";
  knob.style.borderRadius = "50%";
  knob.style.background = COLOR_TEXT;
  knob.style.transition = "transform 0.15s ease";
  track.appendChild(knob);

  switchRow.append(switchLabel, track);
  switchRow.addEventListener("click", onToggleHint);

  badge.append(divider, switchRow);

  // "?" inside the pill; closing is done from the help panel itself
  let helpOpen = false;
  const helpButton = createCornerButton("?", strings.help.openAriaLabel, () => setHelpOpen(!helpOpen));
  helpButton.style.display = "flex";
  helpButton.style.position = "static";
  helpButton.style.width = "26px";
  helpButton.style.height = "26px";
  helpButton.style.fontSize = "12px";
  helpButton.style.flexShrink = "0";
  badge.appendChild(helpButton);

  const helpPanel = createHelpPanel(strings.help, () => setHelpOpen(false));
  helpPanel.style.display = "none";
  helpPanel.style.opacity = "0";
  helpPanel.style.transition = "opacity 0.25s ease";

  wrapper.append(badge);
  container.append(wrapper, helpPanel);

  function setHelpOpen(open: boolean) {
    if (open === helpOpen) return;
    helpOpen = open;
    if (open) {
      helpPanel.style.display = "flex";
      // let the display change apply before fading in
      requestAnimationFrame(() => { helpPanel.style.opacity = "1"; });
    } else {
      helpPanel.style.opacity = "0";
      helpPanel.style.display = "none";
    }
    onHelpOpenChange(open);
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && helpOpen) setHelpOpen(false);
  }
  window.addEventListener("keydown", onKeyDown);

  function setMinimumMoves(count: number) {
    if (count === 0) {
      countEl.textContent = "✓";
      labelEl.textContent = strings.solvedLabel;
    } else {
      countEl.textContent = String(count).padStart(2, "0");
      labelEl.textContent = strings.movesLabel;
    }
  }

  function setHintActive(active: boolean) {
    track.style.background = active ? HINT_COLOR_CSS : "rgba(255,255,255,0.2)";
    knob.style.transform = active ? "translateX(14px)" : "translateX(0)";
  }

  function setVisible(visible: boolean) {
    wrapper.style.opacity = visible ? "1" : "0";
    wrapper.style.pointerEvents = visible ? "auto" : "none";
  }

  function remove() {
    window.removeEventListener("keydown", onKeyDown);
    wrapper.remove();
    helpPanel.remove();
  }

  return { setMinimumMoves, setHintActive, element: wrapper, setVisible, closeHelp: () => setHelpOpen(false), remove };
}
