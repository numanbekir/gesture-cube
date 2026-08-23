import * as THREE from "three";
import type { Point2D } from "../hand-tracking/gesture-detector";

const raycaster = new THREE.Raycaster();
const PLANE_DISTANCE = 5.8; // fixed distance from the camera, close to the cube

// Must receive the same `mirrored` value as the video background.
export function landmarkToNdc(point: Point2D, mirrored: boolean): { x: number; y: number } {
  const x = mirrored ? 1 - point.x : point.x;
  return { x: x * 2 - 1, y: -(point.y * 2 - 1) };
}

// Intersects the NDC ray with a plane perpendicular to the view direction (not a world
// axis), so screen corners map to the same depth as the center.
export function screenToWorld(camera: THREE.Camera, ndcX: number, ndcY: number): THREE.Vector3 | null {
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const planeCenter = camera.position.clone().addScaledVector(forward, PLANE_DISTANCE);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(forward, planeCenter);
  const point = new THREE.Vector3();
  const hit = raycaster.ray.intersectPlane(plane, point);
  return hit ? point : null;
}

export function palmCenter(landmarks: readonly Point2D[]): Point2D {
  return landmarks[9]; // middle MCP
}

// Exponential smoothing to absorb landmark jitter before it reaches the rotation.
export class SmoothedPosition {
  private current: THREE.Vector3 | null = null;
  private readonly smoothing: number;

  constructor(smoothing = 0.2) {
    this.smoothing = smoothing;
  }

  update(target: THREE.Vector3): THREE.Vector3 {
    if (!this.current) {
      this.current = target.clone();
    } else {
      this.current.lerp(target, this.smoothing);
    }
    return this.current.clone();
  }

  reset(): void {
    this.current = null;
  }
}
