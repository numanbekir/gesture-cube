export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export type PinchState = "idle" | "pinching";

export interface PinchResult {
  readonly state: PinchState;
  readonly justStarted: boolean;
  readonly justEnded: boolean;
}

const PINCH_RATIO_THRESHOLD = 0.4;

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Normalized by palm size (wrist → middle MCP) so distance to the camera does not matter.
export function detectPinch(landmarks: readonly Point2D[], previousState: PinchState): PinchResult {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const handScale = distance(wrist, middleMcp);
  const pinchDistance = distance(thumbTip, indexTip);
  const isPinching = handScale > 0 && pinchDistance / handScale < PINCH_RATIO_THRESHOLD;
  const state: PinchState = isPinching ? "pinching" : "idle";
  return {
    state,
    justStarted: state === "pinching" && previousState !== "pinching",
    justEnded: state === "idle" && previousState === "pinching",
  };
}

export type GrabState = "idle" | "grabbing";

export interface GrabResult {
  readonly state: GrabState;
  readonly justStarted: boolean;
  readonly justEnded: boolean;
}

// [tip, mcp] per finger. The thumb is excluded on purpose: it moves in a different plane
// (opposition) and made the count noisy.
const FINGER_JOINTS: readonly [number, number][] = [
  [8, 5], // index
  [12, 9], // middle
  [16, 13], // ring
  [20, 17], // pinky
];

const EXTENDED_RATIO_THRESHOLD = 1.3; // tip-wrist / mcp-wrist above this = extended

// Counts extended fingers (thumb excluded), each evaluated independently.
export function countExtendedFingers(landmarks: readonly Point2D[]): number {
  return fingerExtensionRatios(landmarks).filter((ratio) => ratio > EXTENDED_RATIO_THRESHOLD).length;
}

// Below this a finger is clearly curled. Measured on real hands: curled 0.58–0.95,
// extended 1.37–1.93, relaxed/transitioning 1.2–1.5 (the ambiguous band).
const CURLED_RATIO_THRESHOLD = 1.1;

// Strict count for deliberate gestures: every finger must be clearly extended or clearly
// curled, otherwise null. Used only for counts that trigger moves; grab detection and the
// HUD keep using countExtendedFingers.
export function deliberateFingerCount(landmarks: readonly Point2D[]): number | null {
  const ratios = fingerExtensionRatios(landmarks);
  if (ratios.some((r) => r >= CURLED_RATIO_THRESHOLD && r <= EXTENDED_RATIO_THRESHOLD)) return null;
  return ratios.filter((r) => r > EXTENDED_RATIO_THRESHOLD).length;
}

// Raw extension ratio per finger (index, middle, ring, pinky); exported for calibration.
export function fingerExtensionRatios(landmarks: readonly Point2D[]): number[] {
  const wrist = landmarks[0];
  return FINGER_JOINTS.map(([tip, mcp]) => {
    const mcpDist = distance(landmarks[mcp], wrist);
    return mcpDist > 0 ? distance(landmarks[tip], wrist) / mcpDist : 0;
  });
}

// Measured ~0.50–0.60 on an open hand.
const THUMB_EXTENDED_RATIO_THRESHOLD = 0.45;

// Thumb uses its own metric: distance from thumb tip to index MCP, normalized by palm
// size. Distinguishes "four fingers" from "fully open hand".
export function thumbExtensionRatio(landmarks: readonly Point2D[]): number {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  const handScale = distance(wrist, middleMcp);
  return handScale > 0 ? distance(thumbTip, indexMcp) / handScale : 0;
}

export function isThumbExtended(landmarks: readonly Point2D[]): boolean {
  return thumbExtensionRatio(landmarks) > THUMB_EXTENDED_RATIO_THRESHOLD;
}

// Hysteresis: entering "grabbing" needs 0 fingers, staying in it tolerates 1. Prevents
// frame-to-frame jitter on a fist from dropping the grab mid-rotation.
export function detectGrab(landmarks: readonly Point2D[], previousState: GrabState): GrabResult {
  const extended = countExtendedFingers(landmarks);
  const isGrabbing = previousState === "grabbing" ? extended <= 1 : extended === 0;
  const state: GrabState = isGrabbing ? "grabbing" : "idle";
  return {
    state,
    justStarted: state === "grabbing" && previousState !== "grabbing",
    justEnded: state === "idle" && previousState === "grabbing",
  };
}
