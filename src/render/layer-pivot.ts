import * as THREE from "three";
import type { Axis } from "../cube-engine/types";

export const AXIS_VECTOR: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

// Attaches meshes to a temporary pivot group, preserving world transforms.
export function createLayerPivot(parent: THREE.Object3D, meshes: THREE.Object3D[]): THREE.Group {
  const pivot = new THREE.Group();
  parent.add(pivot);
  for (const mesh of meshes) pivot.attach(mesh);
  return pivot;
}

// Returns the meshes to the parent, preserving world transforms.
export function releaseLayerPivot(parent: THREE.Object3D, pivot: THREE.Group): void {
  for (const mesh of [...pivot.children]) parent.attach(mesh);
  parent.remove(pivot);
}

function animatePivotAngle(pivot: THREE.Group, axis: Axis, fromAngle: number, toAngle: number, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    const axisVector = AXIS_VECTOR[axis];
    const startTime = performance.now();

    function step() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - (1 - t) * (1 - t);
      pivot.setRotationFromAxisAngle(axisVector, fromAngle + (toAngle - fromAngle) * eased);
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      resolve();
    }
    requestAnimationFrame(step);
  });
}

// Animated full turn (keyboard/scramble/solver moves).
export async function rotateLayer(parent: THREE.Object3D, meshes: THREE.Object3D[], axis: Axis, turns: 1 | 2 | 3, durationMs: number): Promise<void> {
  // turns=3 is the same state as -90°; animate the short way.
  const shortestTurns = turns === 3 ? -1 : turns;
  const targetAngle = (shortestTurns * Math.PI) / 2;
  const pivot = createLayerPivot(parent, meshes);
  await animatePivotAngle(pivot, axis, 0, targetAngle, durationMs);
  releaseLayerPivot(parent, pivot);
}

// End of an interactive drag: snap the existing pivot from its current angle to the target.
export async function snapLayerPivot(parent: THREE.Object3D, pivot: THREE.Group, axis: Axis, fromAngle: number, toAngle: number, durationMs: number): Promise<void> {
  await animatePivotAngle(pivot, axis, fromAngle, toAngle, durationMs);
  releaseLayerPivot(parent, pivot);
}
