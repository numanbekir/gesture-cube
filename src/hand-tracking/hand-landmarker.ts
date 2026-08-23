import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";

const WASM_BASE_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/models/hand_landmarker.task";

export type HandDelegate = "GPU" | "CPU";

export interface HandLandmarkerHandle {
  readonly landmarker: HandLandmarker;
  // the delegate actually in use (GPU may fall back to CPU)
  readonly delegate: HandDelegate;
}

// All inference runs in the browser. GPU (WebGL) is preferred; CPU (WASM) is the
// fallback when WebGL is unavailable, or can be forced for benchmarking.
export async function createHandLandmarker(preferred: HandDelegate = "GPU"): Promise<HandLandmarkerHandle> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
  const create = (delegate: HandDelegate) =>
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: "VIDEO",
      numHands: 2,
    });
  if (preferred === "CPU") return { landmarker: await create("CPU"), delegate: "CPU" };
  try {
    return { landmarker: await create("GPU"), delegate: "GPU" };
  } catch {
    return { landmarker: await create("CPU"), delegate: "CPU" };
  }
}

export function detectHands(landmarker: HandLandmarker, video: HTMLVideoElement, timestampMs: number): HandLandmarkerResult {
  return landmarker.detectForVideo(video, timestampMs);
}
