import { COLOR_TEXT_MUTED, FONT_BASE } from "./theme";
import type { GestureCubeStrings } from "../strings";

export interface PlayScreen {
  readonly remove: () => void;
  // Swaps the play triangle for a spinner while the model loads and ignores clicks.
  readonly setLoading: (loading: boolean) => void;
  // Status line under the button (inside the overlay so it stays on top).
  readonly setMessage: (text: string) => void;
}

// Translucent start overlay shown over the live camera feed.
export function createPlayScreen(container: HTMLElement, strings: GestureCubeStrings["playScreen"], onPlay: () => void): PlayScreen {
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.background = "rgba(0,0,0,0.34)";
  overlay.style.cursor = "pointer";
  overlay.style.transition = "background 0.2s ease";
  overlay.style.padding = "24px";
  overlay.style.boxSizing = "border-box";
  overlay.style.overflowY = "auto";

  const content = document.createElement("div");
  content.style.position = "absolute";
  content.style.left = "50%";
  // Tall boxes: below the cube, keeping it unobstructed. Short boxes (an embedding
  // host's 16:9 box on a phone) have no room under the cube: center the button instead.
  const SHORT_CONTAINER_PX = 480;
  function applyPlacement() {
    if (container.clientHeight < SHORT_CONTAINER_PX) {
      content.style.bottom = "auto";
      content.style.top = "50%";
      content.style.transform = "translate(-50%, -50%)";
    } else {
      content.style.top = "auto";
      content.style.bottom = "min(10vh, 64px)";
      content.style.transform = "translateX(-50%)";
    }
  }
  applyPlacement();
  const placementObserver = new ResizeObserver(applyPlacement);
  placementObserver.observe(container);
  content.style.display = "flex";
  content.style.flexDirection = "column";
  content.style.alignItems = "center";
  content.style.gap = "16px";

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", strings.startAriaLabel);
  button.style.width = "88px";
  button.style.height = "88px";
  button.style.borderRadius = "50%";
  button.style.border = "2px solid rgba(255,255,255,0.85)";
  button.style.background = "rgba(255,255,255,0.15)";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.cursor = "pointer";
  button.style.transition = "background 0.15s ease, transform 0.15s ease";

  const triangle = document.createElement("div");
  triangle.style.width = "0";
  triangle.style.height = "0";
  triangle.style.borderTop = "16px solid transparent";
  triangle.style.borderBottom = "16px solid transparent";
  triangle.style.borderLeft = "26px solid #fff";
  triangle.style.marginLeft = "6px"; // optical centering
  button.appendChild(triangle);

  // loading ring: same footprint as the triangle, rotates via the Web Animations API
  const spinner = document.createElement("div");
  spinner.style.width = "30px";
  spinner.style.height = "30px";
  spinner.style.borderRadius = "50%";
  spinner.style.border = "3px solid rgba(255,255,255,0.25)";
  spinner.style.borderTopColor = "#fff";
  spinner.style.boxSizing = "border-box";
  spinner.style.display = "none";
  button.appendChild(spinner);
  let spinnerAnimation: Animation | null = null;
  let loading = false;

  overlay.addEventListener("mouseenter", () => {
    button.style.background = "rgba(255,255,255,0.28)";
    button.style.transform = "scale(1.05)";
  });
  overlay.addEventListener("mouseleave", () => {
    button.style.background = "rgba(255,255,255,0.15)";
    button.style.transform = "scale(1)";
  });

  const message = document.createElement("div");
  message.style.color = COLOR_TEXT_MUTED;
  message.style.font = FONT_BASE;
  message.style.textAlign = "center";
  message.style.marginTop = "12px";
  message.style.minHeight = "1em"; // no layout shift when empty

  content.appendChild(button);
  content.appendChild(message);
  overlay.appendChild(content);
  container.appendChild(overlay);

  overlay.addEventListener("click", () => {
    if (!loading) onPlay();
  });

  function setLoading(next: boolean) {
    loading = next;
    triangle.style.display = next ? "none" : "block";
    spinner.style.display = next ? "block" : "none";
    overlay.style.cursor = next ? "progress" : "pointer";
    button.setAttribute("aria-busy", String(next));
    if (next && !spinnerAnimation) {
      spinnerAnimation = spinner.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 900, iterations: Infinity, easing: "linear" });
    } else if (!next && spinnerAnimation) {
      spinnerAnimation.cancel();
      spinnerAnimation = null;
    }
  }

  function setMessage(text: string) {
    message.textContent = text;
  }

  function remove() {
    placementObserver.disconnect();
    spinnerAnimation?.cancel();
    overlay.remove();
  }

  return { remove, setMessage, setLoading };
}
