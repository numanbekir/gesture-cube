import * as THREE from "three";
import type { Axis } from "../cube-engine/types";

// Per face: its normal and a fixed local "up" used as the 0° spin reference.
const LOCAL_AXES: readonly { vector: THREE.Vector3; axis: Axis; layer: 1 | -1; up: THREE.Vector3 }[] = [
  { vector: new THREE.Vector3(1, 0, 0), axis: "x", layer: 1, up: new THREE.Vector3(0, 1, 0) },
  { vector: new THREE.Vector3(-1, 0, 0), axis: "x", layer: -1, up: new THREE.Vector3(0, 1, 0) },
  { vector: new THREE.Vector3(0, 1, 0), axis: "y", layer: 1, up: new THREE.Vector3(0, 0, 1) },
  { vector: new THREE.Vector3(0, -1, 0), axis: "y", layer: -1, up: new THREE.Vector3(0, 0, 1) },
  { vector: new THREE.Vector3(0, 0, 1), axis: "z", layer: 1, up: new THREE.Vector3(0, 1, 0) },
  { vector: new THREE.Vector3(0, 0, -1), axis: "z", layer: -1, up: new THREE.Vector3(0, 1, 0) },
];

export interface SnapOrientation {
  readonly quaternion: THREE.Quaternion;
  readonly axis: Axis;
  readonly layer: 1 | -1;
}

function projectOntoPlane(v: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 {
  return v.clone().sub(normal.clone().multiplyScalar(v.dot(normal)));
}

// Rotates the face normal towards the camera, then spins it so local up matches camera up.
// This is one of the 4 screen-aligned candidates (0/90/180/270°), not the final answer.
function baseFaceOrientation(vector: THREE.Vector3, localUp: THREE.Vector3, forward: THREE.Vector3, cameraUp: THREE.Vector3): { align: THREE.Quaternion; base: THREE.Quaternion } {
  const towardsCamera = forward.clone().negate();
  const align = new THREE.Quaternion().setFromUnitVectors(vector, towardsCamera);
  const rotatedUp = projectOntoPlane(localUp.clone().applyQuaternion(align), towardsCamera);
  const targetUp = projectOntoPlane(cameraUp, towardsCamera);
  if (rotatedUp.lengthSq() < 1e-8 || targetUp.lengthSq() < 1e-8) return { align, base: align };
  rotatedUp.normalize();
  targetUp.normalize();
  const cross = new THREE.Vector3().crossVectors(rotatedUp, targetUp);
  const sign = Math.sign(cross.dot(towardsCamera)) || 1;
  const spinAngle = sign * rotatedUp.angleTo(targetUp);
  const spin = new THREE.Quaternion().setFromAxisAngle(towardsCamera, spinAngle);
  return { align, base: spin.multiply(align) };
}

// Of the 4 screen-aligned rolls for this face, pick the one closest to the current
// rotation so the snap does not jump away from what the user sees.
function faceOrientation(vector: THREE.Vector3, localUp: THREE.Vector3, forward: THREE.Vector3, cameraUp: THREE.Vector3, current: THREE.Quaternion): THREE.Quaternion {
  const towardsCamera = forward.clone().negate();
  const { base } = baseFaceOrientation(vector, localUp, forward, cameraUp);
  const quarterTurn = new THREE.Quaternion().setFromAxisAngle(towardsCamera, Math.PI / 2);

  let best = base;
  let bestDot = -Infinity;
  let candidate = base.clone();
  for (let i = 0; i < 4; i++) {
    const dot = Math.abs(candidate.dot(current)); // q and -q are the same rotation
    if (dot > bestDot) {
      bestDot = dot;
      best = candidate.clone();
    }
    candidate = quarterTurn.clone().multiply(candidate);
  }
  return best;
}

// Face whose world normal points most towards the camera — independent of spin.
function nearestFace(current: THREE.Quaternion, cameraForward: THREE.Vector3) {
  let best = LOCAL_AXES[0];
  let bestDot = -Infinity;
  const towardsCamera = cameraForward.clone().negate();
  for (const candidate of LOCAL_AXES) {
    const worldNormal = candidate.vector.clone().applyQuaternion(current);
    const dot = worldNormal.dot(towardsCamera);
    if (dot > bestDot) {
      bestDot = dot;
      best = candidate;
    }
  }
  return best;
}

// Nearest face plus the closest screen-aligned spin for it.
export function nearestSnapOrientation(current: THREE.Quaternion, cameraForward: THREE.Vector3, cameraUp: THREE.Vector3): SnapOrientation {
  const { vector, axis, layer, up } = nearestFace(current, cameraForward);
  const quaternion = faceOrientation(vector, up, cameraForward, cameraUp, current);
  return { quaternion, axis, layer };
}

export function animateToOrientation(object: THREE.Object3D, target: THREE.Quaternion, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = object.quaternion.clone();
    const startTime = performance.now();

    function step() {
      const t = Math.min((performance.now() - startTime) / durationMs, 1);
      const eased = 1 - (1 - t) * (1 - t);
      object.quaternion.copy(start).slerp(target, eased);
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      resolve();
    }
    requestAnimationFrame(step);
  });
}

// Position counterpart of animateToOrientation (ease-out, rAF, Promise).
export function animatePosition(object: THREE.Object3D, target: THREE.Vector3, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = object.position.clone();
    const startTime = performance.now();

    function step() {
      const t = Math.min((performance.now() - startTime) / durationMs, 1);
      const eased = 1 - (1 - t) * (1 - t);
      object.position.lerpVectors(start, target, eased);
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      resolve();
    }
    requestAnimationFrame(step);
  });
}
