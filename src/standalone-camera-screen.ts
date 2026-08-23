import { COLOR_TEXT_MUTED, FONT_BASE } from "./ui/theme";
import type { GestureCubeStrings } from "./strings";

// Standalone mode only: acquires the camera and hands the <video> to initGestureCube.
// On the platform this is replaced by the host's camera layer.
export function mountStandaloneCameraScreen(container: HTMLElement, strings: GestureCubeStrings["cameraScreen"], onReady: (video: HTMLVideoElement) => void): void {
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.gap = "12px";
  overlay.style.background = "#050507";
  overlay.style.color = COLOR_TEXT_MUTED;
  overlay.style.font = FONT_BASE;
  overlay.style.textAlign = "center";
  overlay.style.padding = "24px";
  overlay.style.boxSizing = "border-box";
  overlay.style.cursor = "pointer";

  const message = document.createElement("div");
  overlay.appendChild(message);
  container.appendChild(overlay);

  function setMessage(text: string) {
    message.textContent = text;
  }

  async function requestCamera() {
    setMessage(strings.requesting);
    try {
      // Ask for 1080p; `ideal` lets the browser fall back to the closest size the device
      // supports. Without it most browsers default to 640×480, which looks soft when
      // stretched to the full viewport.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();
      overlay.remove();
      onReady(video);
    } catch {
      setMessage(strings.denied);
    }
  }

  overlay.addEventListener("click", () => void requestCamera());
  void requestCamera();
}
