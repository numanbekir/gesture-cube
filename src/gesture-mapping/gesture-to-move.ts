import * as THREE from "three";
import type { Axis } from "../cube-engine/types";

export interface GrabbedFace {
  readonly axis: Axis;
  readonly layer: 1 | -1;
}

const raycaster = new THREE.Raycaster();

// Raycasts from the pinch point and returns the axis/side of the first cube face hit.
export function findGrabbedFace(camera: THREE.Camera, ndcX: number, ndcY: number, cubeMeshes: THREE.Object3D[]): GrabbedFace | null {
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const hit = raycaster.intersectObjects(cubeMeshes, false)[0];
  if (!hit?.face) return null;

  const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  const abs: [number, number, number] = [Math.abs(worldNormal.x), Math.abs(worldNormal.y), Math.abs(worldNormal.z)];
  const dominant = abs.indexOf(Math.max(...abs)) as 0 | 1 | 2;
  const axis: Axis = dominant === 0 ? "x" : dominant === 1 ? "y" : "z";
  const layer = worldNormal.getComponent(dominant) > 0 ? 1 : -1;
  return { axis, layer };
}

function projectOntoPlane(v: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 {
  return v.clone().sub(normal.clone().multiplyScalar(v.dot(normal)));
}

// Signed angle (radians) swept around the face axis from the start point to the current one.
export function resolveLiveAngle(face: GrabbedFace, startWorld: THREE.Vector3, currentWorld: THREE.Vector3, cubeCenter: THREE.Vector3): number {
  const axisVector = new THREE.Vector3(face.axis === "x" ? 1 : 0, face.axis === "y" ? 1 : 0, face.axis === "z" ? 1 : 0);
  const r1 = projectOntoPlane(startWorld.clone().sub(cubeCenter), axisVector);
  const r2 = projectOntoPlane(currentWorld.clone().sub(cubeCenter), axisVector);
  if (r1.lengthSq() < 1e-6 || r2.lengthSq() < 1e-6) return 0;
  const cross = new THREE.Vector3().crossVectors(r1, r2);
  const sign = Math.sign(cross.dot(axisVector)) || 1;
  return sign * r1.angleTo(r2);
}
