import type { SceneContext } from "./scene";

// onTick runs before every render, independent of hand tracking (e.g. idle rotation).
export function startAnimationLoop(ctx: SceneContext, onTick?: () => void): () => void {
  let frameId: number | null = null;

  function tick() {
    onTick?.();
    ctx.controls.update();
    ctx.renderer.render(ctx.scene, ctx.camera);
    frameId = requestAnimationFrame(tick);
  }
  frameId = requestAnimationFrame(tick);

  return function stop() {
    if (frameId !== null) cancelAnimationFrame(frameId);
  };
}
