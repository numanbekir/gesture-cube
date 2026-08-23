import * as THREE from "three";

export interface VideoBackground {
  readonly texture: THREE.VideoTexture;
  readonly dispose: () => void;
}

// The <video> is owned by the caller (no getUserMedia here). `mirrored` flips the texture
// horizontally for a selfie camera; the caller decides based on facingMode.
export function createVideoBackground(scene: THREE.Scene, video: HTMLVideoElement, mirrored: boolean): VideoBackground {
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (mirrored) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = -1;
  }
  scene.background = texture;

  function dispose() {
    texture.dispose();
    if (scene.background === texture) scene.background = null;
  }

  return { texture, dispose };
}
