import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { CubeState, MoveName } from "../cube-engine/types";
import { applyMoveName, parseMove } from "../cube-engine/moves";
import { createSolvedState, isSolved } from "../cube-engine/state";
import { solve } from "../solver/solver";
import { stateToCorners, toPhysicalMove } from "../solver/encoding";
import { computeFaceGrid } from "./face-grid";
import { moveForDirection, referenceFaceForAxis, targetForMove } from "./layer-swipe";

// Uses the real camera (scene.ts: (3,3,4) looking at the origin) and all 24 snap orientations.
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(3, 3, 4);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
const CAMERA_RIGHT = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
const CAMERA_UP = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);

function allSnapOrientations(): THREE.Quaternion[] {
  const result: THREE.Quaternion[] = [];
  const seen = new Set<string>();
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  for (const a of axes) for (let i = 0; i < 4; i++) for (const b of axes) for (let j = 0; j < 4; j++) {
    const q = new THREE.Quaternion().setFromAxisAngle(a, (i * Math.PI) / 2).multiply(new THREE.Quaternion().setFromAxisAngle(b, (j * Math.PI) / 2));
    const m = new THREE.Matrix4().makeRotationFromQuaternion(q).elements.map((e) => Math.round(e)).join(",");
    if (!seen.has(m)) {
      seen.add(m);
      result.push(q);
    }
  }
  return result;
}
const SNAP_ORIENTATIONS = allSnapOrientations();

const ALL_MOVES: readonly MoveName[] = ["U", "U'", "U2", "D", "D'", "D2", "L", "L'", "L2", "R", "R'", "R2", "F", "F'", "F2", "B", "B'", "B2"];

// Reproduces the exact chain in app.ts (solve → toPhysicalMove → referenceFaceForAxis →
// computeFaceGrid → targetForMove → swipe → moveForDirection, plus double-move tracking)
// since WebGL/hand tracking cannot run here. Guards three historical bugs: unfinished "2"
// moves, missing normalized→physical conversion, and a `lastMove` patch that masked it.
class HintSession {
  state: CubeState = createSolvedState();
  currentSolution: readonly MoveName[] = [];
  pendingSecondHalf: MoveName | null = null;
  readonly orientation: THREE.Quaternion;

  constructor(scramble: readonly MoveName[], orientation: THREE.Quaternion = new THREE.Quaternion()) {
    this.orientation = orientation;
    for (const m of scramble) this.state = applyMoveName(this.state, m);
    this.currentSolution = this.freshSolution();
  }

  private freshSolution(): MoveName[] {
    return solve(stateToCorners(this.state)).map((m) => toPhysicalMove(this.state, m));
  }

  private onStateChange(executedMove: MoveName) {
    const shownHintMove = this.pendingSecondHalf ?? this.currentSolution[0];
    if (shownHintMove) {
      if (executedMove === shownHintMove) {
        this.pendingSecondHalf = null;
      } else if (shownHintMove.endsWith("2") && !executedMove.endsWith("2") && parseMove(shownHintMove).axis === parseMove(executedMove).axis && parseMove(shownHintMove).layer === parseMove(executedMove).layer) {
        this.pendingSecondHalf = executedMove;
      } else {
        this.pendingSecondHalf = null;
      }
    } else {
      this.pendingSecondHalf = null;
    }
    this.currentSolution = this.freshSolution();
  }

  // one player step: compute the hint target, swipe as the player would, apply
  followHintOnce(): { shownMove: MoveName; executedMove: MoveName } {
    const shownMove = this.pendingSecondHalf ?? this.currentSolution[0];
    if (!shownMove) throw new Error("No hint to show (cube already solved)");
    const move = parseMove(shownMove);
    const reference = referenceFaceForAxis(move.axis);
    const cells = computeFaceGrid(reference.axis, reference.layer, this.state, this.orientation, CAMERA_RIGHT, CAMERA_UP);
    const target = targetForMove(shownMove, cells);
    if (!target) throw new Error(`No target on the reference face (${reference.axis}${reference.layer}) for ${shownMove}`);
    const executedMove = moveForDirection(target.cell, target.direction);
    this.state = applyMoveName(this.state, executedMove);
    this.onStateChange(executedMove);
    return { shownMove, executedMove };
  }

  // an arbitrary move that deviates from the hint
  deviate(move: MoveName) {
    this.state = applyMoveName(this.state, move);
    this.onStateChange(move);
  }

  get solved(): boolean {
    return isSolved(this.state);
  }

  // same value the MOVES badge shows (onCubeStateChange)
  get displayedCount(): number {
    return this.currentSolution.length;
  }
}

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function randomScramble(rand: () => number, length: number, family: readonly MoveName[]): MoveName[] {
  const out: MoveName[] = [];
  for (let i = 0; i < length; i++) out.push(family[Math.floor(rand() * family.length)]);
  return out;
}

// Invariants while following hints: (a) two consecutive moves never cancel each other,
// (b) the MOVES badge never increases (may stay equal during the first half of a "2").
function followUntilSolved(session: HintSession, label: string, maxSteps = 20) {
  let lastExecuted: MoveName | null = null;
  let previousCount = session.displayedCount;
  let guard = 0;
  while (!session.solved && guard < maxSteps) {
    const { executedMove } = session.followHintOnce();
    if (lastExecuted) {
      const prev = parseMove(lastExecuted);
      const curr = parseMove(executedMove);
      const sameLayer = prev.axis === curr.axis && prev.layer === curr.layer;
      const isCancelling = sameLayer && lastExecuted.endsWith("'") !== executedMove.endsWith("'");
      expect(isCancelling, `${label} guard=${guard}: ${executedMove} right after ${lastExecuted} — cancelling loop`).toBe(false);
    }
    expect(session.displayedCount, `${label} guard=${guard}: rozet ${previousCount}'den ${session.displayedCount}'e ARTTI`).toBeLessThanOrEqual(previousCount);
    previousCount = session.displayedCount;
    lastExecuted = executedMove;
    guard++;
  }
  expect(session.solved, `${label}: not solved within ${guard} steps`).toBe(true);
}

describe("hint end to end: following the shown target solves the cube", () => {
  it("a fixed scramble containing R2 requires two identical swipes and solves", () => {
    const session = new HintSession(["R", "U", "F'", "R'", "U2", "F", "R2", "U'"]);
    expect(session.solved).toBe(false);

    const steps: { shownMove: MoveName; executedMove: MoveName }[] = [];
    let guard = 0;
    while (!session.solved && guard < 30) {
      steps.push(session.followHintOnce());
      guard++;
    }
    expect(session.solved, `not solved within ${guard} steps`).toBe(true);

    const doubleMoveSteps = steps.filter((s) => s.shownMove.endsWith("2"));
    expect(doubleMoveSteps.length, "expected at least one '2' move in this scramble").toBeGreaterThan(0);
    for (const doubleStep of doubleMoveSteps) {
      const idx = steps.indexOf(doubleStep);
      const next = steps[idx + 1];
      expect(next, `no second swipe step after ${doubleStep.shownMove}`).toBeDefined();
      expect(next.executedMove, `both halves of ${doubleStep.shownMove} must be the same swipe`).toBe(doubleStep.executedMove);
    }
  });

  it("regression: hints still solve after the user deviates with a D/L/B turn", () => {
    // never solved without toPhysicalMove (U/U' loop)
    for (const deviation of ["D", "L", "B", "D'", "L'", "B'", "D2"] as MoveName[]) {
      const session = new HintSession(["R", "U", "F'", "R'", "U2", "F", "R2", "U'"]);
      session.followHintOnce();
      session.deviate(deviation);
      followUntilSolved(session, `sapma=${deviation}`);
    }
  });

  it("150 six-face scrambles × sampled snap orientations: always solves, badge never grows, no cancel loops", () => {
    const rand = lcg(2026);
    for (let trial = 0; trial < 150; trial++) {
      const scramble = randomScramble(rand, 4 + Math.floor(rand() * 8), ALL_MOVES);
      const orientation = SNAP_ORIENTATIONS[trial % SNAP_ORIENTATIONS.length];
      const session = new HintSession(scramble, orientation);
      if (session.solved) continue;
      followUntilSolved(session, `trial=${trial} scramble=${scramble.join(" ")}`);
    }
  });

  it("solves even with random deviations from the hint", () => {
    const rand = lcg(7);
    for (let trial = 0; trial < 100; trial++) {
      const session = new HintSession(randomScramble(rand, 8, ALL_MOVES), SNAP_ORIENTATIONS[Math.floor(rand() * SNAP_ORIENTATIONS.length)]);
      // 1–3 random deviations with a few correct hint steps in between
      const deviations = 1 + Math.floor(rand() * 3);
      for (let d = 0; d < deviations && !session.solved; d++) {
        const correctSteps = Math.floor(rand() * 3);
        for (let i = 0; i < correctSteps && !session.solved; i++) session.followHintOnce();
        if (!session.solved) session.deviate(ALL_MOVES[Math.floor(rand() * ALL_MOVES.length)]);
      }
      if (session.solved) continue;
      // after deviating, following hints again must decrease monotonically and solve
      followUntilSolved(session, `trial=${trial}`);
    }
  });
});
