import * as THREE from "three";
import type { Axis, CubeState, Move, MoveName } from "./cube-engine/types";
import { AXIS_INDEX, applyMove, parseMove } from "./cube-engine/moves";
import { createSolvedState, currentPosition } from "./cube-engine/state";
import { AXIS_VECTOR, createLayerPivot, releaseLayerPivot, rotateLayer, snapLayerPivot } from "./render/layer-pivot";
import { syncCubieTransforms } from "./render/cubies";

const ANIMATION_DURATION_MS = 250;
// Faster when more moves are queued (scramble), still slow enough to follow.
const QUEUED_ANIMATION_DURATION_MS = 150;
const SNAP_DURATION_MS = 120;

export interface InteractiveFace {
  readonly axis: Axis;
  readonly layer: 1 | -1;
}

// Single entry point for every move source; keeps state and animation in sync.
export class MoveExecutor {
  private readonly cubeGroup: THREE.Object3D;
  private readonly meshes: Map<number, THREE.Mesh>;
  private state: CubeState;
  private readonly queue: MoveName[] = [];
  private processing = false;

  private interactivePivot: THREE.Group | null = null;
  private interactiveFace: InteractiveFace | null = null;
  private interactiveAngle = 0;
  // `move` is the move that produced the state (undefined after reset()).
  private readonly onStateChange?: (state: CubeState, move?: MoveName) => void;

  constructor(cubeGroup: THREE.Object3D, meshes: Map<number, THREE.Mesh>, initialState: CubeState, onStateChange?: (state: CubeState, move?: MoveName) => void) {
    this.cubeGroup = cubeGroup;
    this.meshes = meshes;
    this.state = initialState;
    this.onStateChange = onStateChange;
  }

  getState(): CubeState {
    return this.state;
  }

  get isInteracting(): boolean {
    return this.interactivePivot !== null;
  }

  // Deliberately ignores `processing`: the last move's onStateChange fires while it is
  // still true, which would make isIdle always false at the end of a queue.
  get isIdle(): boolean {
    return this.queue.length === 0 && this.interactivePivot === null;
  }

  enqueue(name: MoveName): void {
    this.queue.push(name);
    void this.drain();
  }

  reset(): void {
    this.queue.length = 0;
    this.state = createSolvedState();
    syncCubieTransforms(this.state, this.meshes);
    this.onStateChange?.(this.state);
  }

  private layerMeshes(axis: Axis, layer: 1 | -1): THREE.Mesh[] {
    const axisIndex = AXIS_INDEX[axis];
    return this.state
      .filter((cubie) => Math.round(currentPosition(cubie)[axisIndex]) === layer)
      .map((cubie) => this.meshes.get(cubie.id))
      .filter((mesh): mesh is THREE.Mesh => mesh !== undefined);
  }

  // Start of an interactive drag: the layer is moved to a pivot, not rotated yet.
  beginInteractiveRotation(face: InteractiveFace): void {
    if (this.interactivePivot || this.processing) return;
    this.interactivePivot = createLayerPivot(this.cubeGroup, this.layerMeshes(face.axis, face.layer));
    this.interactiveFace = face;
    this.interactiveAngle = 0;
  }

  // Called every frame while dragging.
  updateInteractiveRotation(angle: number): void {
    if (!this.interactivePivot || !this.interactiveFace) return;
    this.interactiveAngle = angle;
    this.interactivePivot.setRotationFromAxisAngle(AXIS_VECTOR[this.interactiveFace.axis], angle);
  }

  // End of drag: snap to the nearest 90° and commit to the state.
  async endInteractiveRotation(): Promise<void> {
    const pivot = this.interactivePivot;
    const face = this.interactiveFace;
    if (!pivot || !face) return;
    this.interactivePivot = null;
    this.interactiveFace = null;

    const steps = Math.round(this.interactiveAngle / (Math.PI / 2));
    const turns = (((steps % 4) + 4) % 4) as 0 | 1 | 2 | 3;
    const targetAngle = steps * (Math.PI / 2);

    await snapLayerPivot(this.cubeGroup, pivot, face.axis, this.interactiveAngle, targetAngle, SNAP_DURATION_MS);

    if (turns !== 0) {
      const move: Move = { axis: face.axis, layer: face.layer, turns };
      this.state = applyMove(this.state, move);
      syncCubieTransforms(this.state, this.meshes);
      this.onStateChange?.(this.state);
    } else {
      syncCubieTransforms(this.state, this.meshes);
    }
  }

  // Abort without changing the state.
  cancelInteractiveRotation(): void {
    if (!this.interactivePivot) return;
    releaseLayerPivot(this.cubeGroup, this.interactivePivot);
    this.interactivePivot = null;
    this.interactiveFace = null;
    syncCubieTransforms(this.state, this.meshes);
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const name = this.queue.shift();
      if (!name) continue;
      const duration = this.queue.length > 0 ? QUEUED_ANIMATION_DURATION_MS : ANIMATION_DURATION_MS;
      await this.runMove(name, duration);
    }
    this.processing = false;
  }

  private async runMove(name: MoveName, durationMs: number): Promise<void> {
    const move = parseMove(name);
    const animation = rotateLayer(this.cubeGroup, this.layerMeshes(move.axis, move.layer), move.axis, move.turns, durationMs);
    this.state = applyMove(this.state, move);
    await animation;
    syncCubieTransforms(this.state, this.meshes);
    this.onStateChange?.(this.state, name);
  }
}
