import { initGestureCube, type GestureCubeInstance } from "./app";
import { mountStandaloneCameraScreen } from "./standalone-camera-screen";
import { STRINGS_BY_LOCALE, resolveLocale } from "./strings";
import type { HandDelegate } from "./hand-tracking/hand-landmarker";

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) throw new Error("#app not found");

// Standalone entry: owns the camera and fullscreen; initGestureCube stays host-agnostic.
// Fullscreen is requested inside the start click (user gesture). Leaving fullscreen
// restarts the flow with the same video. spaciousLayout is always true here because the
// container is always full-viewport.
const locale = resolveLocale(window.location.search, navigator.language);
document.documentElement.lang = locale;

// Benchmark knobs (standalone only): ?delegate=cpu|gpu or VITE_HAND_DELEGATE, ?stats=1 or VITE_PERF_STATS.
const params = new URLSearchParams(window.location.search);
function resolveDelegate(): HandDelegate | undefined {
  const raw = (params.get("delegate") ?? import.meta.env.VITE_HAND_DELEGATE ?? "").toUpperCase();
  return raw === "CPU" || raw === "GPU" ? raw : undefined;
}
const handDelegate = resolveDelegate();
const perfStats = params.get("stats") === "1" || (params.get("stats") !== "0" && (import.meta.env.VITE_PERF_STATS === "1" || import.meta.env.DEV));

let instance: GestureCubeInstance | null = null;

function start(target: HTMLDivElement): void {
  mountStandaloneCameraScreen(target, STRINGS_BY_LOCALE[locale].cameraScreen, (video) => mount(target, video));
}

function mount(target: HTMLDivElement, video: HTMLVideoElement): void {
  instance = initGestureCube(target, {
    video,
    mirrored: true,
    strings: STRINGS_BY_LOCALE[locale],
    spaciousLayout: true,
    onCameraEnded: () => start(target),
    onPlayClick: () => void target.requestFullscreen?.(),
    // dev-only keyboard shortcuts
    devKeyboard: import.meta.env.DEV,
    handDelegate,
    perfStats,
  });
}

document.addEventListener("fullscreenchange", () => {
  const isNowFullscreen = document.fullscreenElement === container;
  if (!isNowFullscreen && instance) {
    instance.destroy();
    instance = null;
    start(container);
  }
});

start(container);
