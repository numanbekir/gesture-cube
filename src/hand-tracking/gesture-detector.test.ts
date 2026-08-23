import { describe, expect, it } from "vitest";
import { deliberateFingerCount, detectGrab, detectPinch, isThumbExtended, type Point2D } from "./gesture-detector";

// isThumbExtended uses wrist(0), middleMcp(9), thumbTip(4), indexMcp(5) only
function makeThumbLandmarks(thumbExtended: boolean): Point2D[] {
  const landmarks: Point2D[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  landmarks[0] = { x: 0, y: 0 }; // wrist
  landmarks[9] = { x: 0, y: 0.1 }; // middleMcp -> handScale = 0.1
  landmarks[5] = { x: 0, y: 0 }; // indexMcp
  landmarks[4] = { x: thumbExtended ? 0.15 : 0.02, y: 0 }; // ratio 1.5 vs 0.2 (threshold 0.45)
  return landmarks;
}

// FINGER_JOINTS: index[8,5], middle[12,9], ring[16,13], pinky[20,17]; mcpDist fixed at 0.1
function makeHandLandmarks(extendedCount: number): Point2D[] {
  const landmarks: Point2D[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  landmarks[0] = { x: 0, y: 0 }; // wrist
  const joints: readonly [number, number][] = [
    [8, 5],
    [12, 9],
    [16, 13],
    [20, 17],
  ];
  joints.forEach(([tip, mcp], i) => {
    landmarks[mcp] = { x: 0, y: 0.1 };
    landmarks[tip] = { x: 0, y: i < extendedCount ? 0.2 : 0.05 }; // ratio 2 vs 0.5 (threshold 1.3)
  });
  return landmarks;
}

// only 0 (wrist), 4 (thumb tip), 8 (index tip), 9 (middle mcp) matter
function makeLandmarks(thumbTip: Point2D, indexTip: Point2D): Point2D[] {
  const landmarks: Point2D[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  landmarks[0] = { x: 0, y: 0 }; // wrist
  landmarks[9] = { x: 0, y: 0.2 }; // middle mcp -> handScale = 0.2
  landmarks[4] = thumbTip;
  landmarks[8] = indexTip;
  return landmarks;
}

describe("detectPinch", () => {
  it("returns idle when the fingers are apart", () => {
    const landmarks = makeLandmarks({ x: 0, y: 0 }, { x: 0.3, y: 0 });
    const result = detectPinch(landmarks, "idle");
    expect(result.state).toBe("idle");
    expect(result.justStarted).toBe(false);
  });

  it("returns pinching when the fingers are close", () => {
    const landmarks = makeLandmarks({ x: 0, y: 0 }, { x: 0.01, y: 0 });
    const result = detectPinch(landmarks, "idle");
    expect(result.state).toBe("pinching");
  });

  it("sets justStarted on idle → pinching", () => {
    const landmarks = makeLandmarks({ x: 0, y: 0 }, { x: 0.01, y: 0 });
    const result = detectPinch(landmarks, "idle");
    expect(result.justStarted).toBe(true);
    expect(result.justEnded).toBe(false);
  });

  it("sets justEnded on pinching → idle", () => {
    const landmarks = makeLandmarks({ x: 0, y: 0 }, { x: 0.3, y: 0 });
    const result = detectPinch(landmarks, "pinching");
    expect(result.justEnded).toBe(true);
    expect(result.justStarted).toBe(false);
  });

  it("keeps justStarted/justEnded false when the state does not change", () => {
    const landmarks = makeLandmarks({ x: 0, y: 0 }, { x: 0.01, y: 0 });
    const result = detectPinch(landmarks, "pinching");
    expect(result.justStarted).toBe(false);
    expect(result.justEnded).toBe(false);
  });
});

describe("detectGrab", () => {
  it("enters grabbing from idle with 0 fingers", () => {
    const result = detectGrab(makeHandLandmarks(0), "idle");
    expect(result.state).toBe("grabbing");
    expect(result.justStarted).toBe(true);
  });

  it("does not enter grabbing from idle with 1 finger (strict entry)", () => {
    const result = detectGrab(makeHandLandmarks(1), "idle");
    expect(result.state).toBe("idle");
  });

  // hysteresis: one finger flickering open during a fist must not drop the grab
  it("stays grabbing with 1 finger (hysteresis)", () => {
    const result = detectGrab(makeHandLandmarks(1), "grabbing");
    expect(result.state).toBe("grabbing");
    expect(result.justEnded).toBe(false);
  });

  it("returns to idle with 2 fingers (real release)", () => {
    const result = detectGrab(makeHandLandmarks(2), "grabbing");
    expect(result.state).toBe("idle");
    expect(result.justEnded).toBe(true);
  });
});

describe("isThumbExtended", () => {
  it("returns false when the thumb is close to the palm", () => {
    expect(isThumbExtended(makeThumbLandmarks(false))).toBe(false);
  });

  it("returns true when the thumb is extended", () => {
    expect(isThumbExtended(makeThumbLandmarks(true))).toBe(true);
  });
});

// builds landmarks from extension ratios (index..pinky); mcpDist = 0.1, tip = ratio × 0.1
function makeHandWithRatios(ratios: readonly [number, number, number, number]): Point2D[] {
  const landmarks: Point2D[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  const joints: readonly [number, number][] = [[8, 5], [12, 9], [16, 13], [20, 17]];
  joints.forEach(([tip, mcp], i) => {
    landmarks[mcp] = { x: 0, y: 0.1 };
    landmarks[tip] = { x: 0, y: ratios[i] * 0.1 };
  });
  return landmarks;
}

// Real-hand measurements; these lock the thresholds to observed values.
describe("deliberateFingerCount", () => {
  it("deliberate 3 fingers (pinky clearly curled) → 3", () => {
    expect(deliberateFingerCount(makeHandWithRatios([1.72, 1.84, 1.83, 0.94]))).toBe(3);
    expect(deliberateFingerCount(makeHandWithRatios([1.37, 1.56, 1.70, 0.93]))).toBe(3);
  });

  it("deliberate 4 → 4, deliberate 1 → 1", () => {
    expect(deliberateFingerCount(makeHandWithRatios([1.82, 1.88, 1.79, 1.58]))).toBe(4);
    expect(deliberateFingerCount(makeHandWithRatios([1.93, 0.63, 0.58, 0.73]))).toBe(1);
  });

  it("relaxed hand with one ambiguous finger → null", () => {
    // real false-trigger case: a single-threshold count read this as 3
    expect(deliberateFingerCount(makeHandWithRatios([1.47, 1.39, 1.40, 1.18]))).toBeNull();
    expect(deliberateFingerCount(makeHandWithRatios([1.8, 1.8, 1.2, 0.7]))).toBeNull();
  });

  it("fist → 0", () => {
    expect(deliberateFingerCount(makeHandWithRatios([0.7, 0.6, 0.6, 0.8]))).toBe(0);
  });
});
