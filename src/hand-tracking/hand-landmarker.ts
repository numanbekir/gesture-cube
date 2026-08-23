import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";

export type HandDelegate = "GPU" | "CPU";

// Where the host serves the MediaPipe runtime and the model. Standalone serves them from
// the site root; an embedding host (the Tanırım platform) can mount them under a prefix.
export interface HandAssetPaths {
  readonly wasmBasePath: string;
  readonly modelPath: string;
}

export const DEFAULT_HAND_ASSET_PATHS: HandAssetPaths = {
  wasmBasePath: "/mediapipe/wasm",
  modelPath: "/models/hand_landmarker.task",
};

export interface HandLandmarkerHandle {
  readonly landmarker: HandLandmarker;
  // the delegate actually in use (GPU may fall back to CPU)
  readonly delegate: HandDelegate;
}

// All inference runs in the browser. GPU (WebGL) is preferred; CPU (WASM) is the
// fallback when WebGL is unavailable, or can be forced for benchmarking.
export async function createHandLandmarker(preferred: HandDelegate = "GPU", paths: HandAssetPaths = DEFAULT_HAND_ASSET_PATHS): Promise<HandLandmarkerHandle> {
  const vision = await FilesetResolver.forVisionTasks(paths.wasmBasePath);
  const create = (delegate: HandDelegate) =>
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: paths.modelPath, delegate },
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
