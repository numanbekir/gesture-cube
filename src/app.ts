import * as THREE from "three";
import { createScene } from "./render/scene";
import { createCubieMeshes } from "./render/cubies";
import { createFaceFrame, hideFaceFrame, showFaceFrame } from "./render/face-frame";
import { createVideoBackground } from "./render/video-background";
import { startAnimationLoop } from "./render/animation-loop";
import { createSolvedState } from "./cube-engine/state";
import { MoveExecutor } from "./move-executor";
import { createHandLandmarker, detectHands, type HandAssetPaths, type HandDelegate } from "./hand-tracking/hand-landmarker";
import { createPerfStats, type PerfStats } from "./ui/perf-stats";
import { createOrientationGate } from "./ui/orientation-gate";
import { createWatermark } from "./ui/watermark";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { detectGrab, countExtendedFingers, isThumbExtended, type GrabState, type Point2D } from "./hand-tracking/gesture-detector";
import { createLandmarkOverlay, drawLandmarks } from "./ui/landmark-overlay";
import { createPlayScreen, type PlayScreen } from "./ui/play-screen";
import { landmarkToNdc, palmCenter, screenToWorld, SmoothedPosition } from "./gesture-mapping/hand-to-world";
import { animatePosition, animateToOrientation, nearestSnapOrientation } from "./render/cube-snap";
import { parseMove } from "./cube-engine/moves";
import type { CubeState, MoveName } from "./cube-engine/types";
import { stateToCorners, toPhysicalMove } from "./solver/encoding";
import { solve } from "./solver/solver";
import { generateScramble } from "./solver/scramble";
import { createSolverDisplay } from "./ui/solver-display";
import { createGestureGuide, type HandFingerState } from "./ui/gesture-guide";
import { computeFaceGrid } from "./gesture-mapping/face-grid";
import { LayerTurnGesture } from "./gesture-mapping/layer-turn-gesture";
import { createCellMarker, hideCellMarker, showCellMarker } from "./render/cell-marker";
import { createHintOverlay } from "./render/hint-overlay";
import type { GestureCubeStrings } from "./strings";

export type GestureCubeEventType = "play_start" | "successful_detection" | "completion";

// Live session snapshot for host UIs (side panels etc.), reported via onStatus.
export interface GestureCubeStatus {
  readonly phase: "idle" | "loadingModel" | "ready" | "playing";
  // Hands currently visible to the tracker (0-2); null before tracking starts.
  readonly handsVisible: number | null;
  readonly delegate: HandDelegate | null;
  // Smoothed per-frame inference time; null until the first samples arrive.
  readonly inferenceMs: number | null;
  // Minimum remaining moves from the solver; null before the scramble finishes.
  readonly minMovesRemaining: number | null;
  readonly solved: boolean;
}

export interface GestureCubeOptions {
  // The caller owns the camera and provides a ready <video>.
  readonly video: HTMLVideoElement;
  // mirrored = facingMode === "user"; defaults to true (front camera).
  readonly mirrored?: boolean;
  readonly strings: GestureCubeStrings;
  // Force "there is room for the gesture guide" (standalone: always true). When false or
  // unset the engine decides from the container height, see hasRoomForGuide().
  readonly spaciousLayout?: boolean;
  readonly onEvent?: (type: GestureCubeEventType) => void;
  // Live status for host UIs; called on phase changes and at most ~2×/s while tracking.
  readonly onStatus?: (status: GestureCubeStatus) => void;
  // Called synchronously on the first start click, inside the user gesture (e.g. to request
  // fullscreen). With autoLoad that is the single "ready" click.
  readonly onPlayClick?: () => void;
  // Start loading the hand model immediately instead of waiting for the first click, so the
  // player only clicks once (hosts where the user already pressed a "start" button).
  readonly autoLoad?: boolean;
  // Fired when the video track ends; the instance cleans itself up, the caller handles reconnection.
  readonly onCameraEnded?: () => void;
  // Dev-only keyboard shortcuts (U/D/L/R/F/B, Shift = prime, 0 = reset). Off by default:
  // the product is gesture-driven and "0" would fake a completion.
  readonly devKeyboard?: boolean;
  // Preferred MediaPipe delegate. Default "GPU" with automatic CPU fallback; "CPU"
  // forces WASM inference (benchmarking, or hosts that want predictable behavior).
  readonly handDelegate?: HandDelegate;
  // Where the MediaPipe WASM runtime and the hand model are served from. Defaults to
  // the standalone layout (/mediapipe/wasm, /models/hand_landmarker.task).
  readonly assetPaths?: HandAssetPaths;
  // Shows a small "delegate · ms · fps" readout. Dev/benchmark only.
  readonly perfStats?: boolean;
  // Bottom-right tanirim.com watermark. On by default (standalone); a host that
  // renders its own passes false.
  readonly watermark?: boolean;
  // Draw the camera feed as the scene background. On by default (standalone); a host
  // that already shows the <video> under the canvas passes false for a transparent scene.
  readonly videoBackground?: boolean;
}

export interface GestureCubeInstance {
  readonly destroy: () => void;
  // Room for the guide can change during the instance lifetime (platform fullscreen).
  readonly setSpaciousLayout: (spacious: boolean) => void;
  // Draws the 3D layer (cube, frames, hint) with a transparent background into a 2D
  // context, for photo/video capture on the host: the host composites the camera frame
  // first, then calls this, then its own watermark. DOM panels are not included.
  readonly drawOverlay: (ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number) => void;
}

const ROTATION_SENSITIVITY = 3; // screen-space hand motion → radians
const SNAP_DURATION_MS = 250;
const ENTRY_ANIMATION_MS = 900;
const IDLE_ROTATION_SPEED = 0.006; // rad/frame before the first interaction
const MOBILE_BREAKPOINT = 640;
const MOBILE_CUBE_SCALE = 0.75;

// "ready" = model loaded, scramble not started yet; gives the user time to see the guide.
type AppState =
  | { readonly phase: "idle" }
  | { readonly phase: "loadingModel" }
  | { readonly phase: "ready"; readonly landmarker: HandLandmarker }
  | { readonly phase: "playing"; readonly landmarker: HandLandmarker };

// Camera right/up axes: rotation is measured against these so it matches what is on screen.
function cameraAxes(camera: THREE.Camera): { right: THREE.Vector3; up: THREE.Vector3 } {
  return {
    right: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
    up: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1),
  };
}

// Left fist unlocks, right fist grabs; both are required to avoid accidental rotation.
function findHandByLabel(result: { landmarks: readonly Point2D[][]; handedness: readonly { categoryName: string }[][] }, label: "Left" | "Right"): Point2D[] | null {
  const index = result.handedness.findIndex((h) => h[0]?.categoryName === label);
  return index !== -1 ? [...result.landmarks[index]] : null;
}

// Raw finger state for the HUD icon — instantaneous, independent of grab hysteresis.
function classifyHandFingerState(hand: readonly Point2D[] | null): HandFingerState {
  if (!hand) return "absent";
  const count = countExtendedFingers(hand);
  if (count === 0) return "fist";
  if (count === 1) return "one";
  if (count === 2) return "two";
  if (count === 3) return "three";
  return isThumbExtended(hand) ? "open" : "four";
}

// All scene/gesture state lives in this closure; destroy() releases everything, which
// makes it safe under React StrictMode double-mount. The video is read, never opened, here.
export function initGestureCube(container: HTMLElement, options: GestureCubeOptions): GestureCubeInstance {
  const mirrored = options.mirrored ?? true;
  const video = options.video;
  const strings = options.strings;

  const sceneContext = createScene(container);
  const { scene, camera, renderer, controls, dispose: disposeScene } = sceneContext;
  const videoBackground = options.videoBackground === false ? null : createVideoBackground(scene, video, mirrored);
  if (!videoBackground) {
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
  }
  const cubeGroup = new THREE.Group();
  const CUBE_REST_POSITION = new THREE.Vector3(0, -1.5, 0);
  // Resting position while the start overlay is shown.
  const CUBE_START_POSITION = new THREE.Vector3(0, -0.4, 0);
  cubeGroup.position.copy(CUBE_START_POSITION);
  scene.add(cubeGroup);
  const state = createSolvedState();
  const meshes = createCubieMeshes(state, cubeGroup);
  const faceFrame = createFaceFrame(); // cyan: "release now → this face" preview
  const cellMarker = createCellMarker(); // cyan ring: cell selected by the right hand
  cubeGroup.add(faceFrame, cellMarker);
  const hintOverlay = createHintOverlay(scene, cubeGroup, meshes);

  // Smaller cube on narrow screens. ResizeObserver for the same reason as in scene.ts.
  // Room for the guide depends on the container height too (see hasRoomForGuide).
  const cubeScaleObserver = new ResizeObserver(() => {
    cubeGroup.scale.setScalar(container.clientWidth < MOBILE_BREAKPOINT ? MOBILE_CUBE_SCALE : 1);
    updateGestureGuideVisibility();
  });
  cubeScaleObserver.observe(container);

  const overlay = createLandmarkOverlay(container);
  const solverDisplay = createSolverDisplay(container, strings.solverDisplay, () => toggleHint(), (open) => {
    // Help panel replaces the live HUD and closes a manually opened guide.
    hintHelpOpen = open;
    if (open && guideManuallyOpen) guideManuallyOpen = false;
    updateGestureGuideVisibility();
  });
  const gestureGuide = createGestureGuide(
    container,
    strings.gestureGuide,
    // "✕": closes the guide whether it was opened manually or automatically. guideDismissed
    // is separate from hasInteracted, which has other side effects (idle rotation, grab).
    () => {
      if (guideManuallyOpen) {
        guideManuallyOpen = false;
      } else {
        guideDismissed = true;
      }
      updateGestureGuideVisibility();
    },
    () => {
      guideManuallyOpen = !guideManuallyOpen;
      if (guideManuallyOpen) solverDisplay.closeHelp(); // never both help panels at once
      updateGestureGuideVisibility();
    },
    solverDisplay.element,
    () => restartGame(),
  );
  // Seed the HUD text before the tracking loop runs.
  gestureGuide.updateHandStatus({ left: "absent", right: "absent", unlocked: false, rotationActive: false });

  let hintActive = false;
  let currentSolution: MoveName[] = [];
  // A "2" hint cannot be completed by one swipe (moveForDirection never yields "2").
  // Tracks that the first half was applied so the same target is shown again.
  let pendingSecondHalfOfDoubleMove: MoveName | null = null;
  let hasScrambled = false; // scramble only once; a solved state before scrambling is not a completion
  // "Room for the guide" is the caller's signal; not the same as fullscreen.
  let hasSpaciousLayout = options.spaciousLayout ?? false;
  // The auto guide (side panels + middle card) needs vertical room. Hosts that know they
  // are full-viewport pass spaciousLayout; otherwise the container height decides, so a
  // 16:9 box on a laptop still gets the guide while a short box only gets the "?" button.
  const MIN_GUIDE_HEIGHT_PX = 480;
  function hasRoomForGuide(): boolean {
    return hasSpaciousLayout || container.clientHeight >= MIN_GUIDE_HEIGHT_PX;
  }
  // Guide opened via "?"; stays open until "?" is pressed again.
  let guideManuallyOpen = false;
  // Hint help panel open → live HUD hidden.
  let hintHelpOpen = false;
  // Auto-opened guide closed early with "✕".
  let guideDismissed = false;
  // Set once the scramble finishes; the middle panel appears only after that.
  let scrambleCompleted = false;
  // End of game: the cube is solved, layer moves are locked until restart. Free rotation
  // stays enabled so the solved cube can still be looked at.
  let solvedState = false;

  // ---- onStatus reporting (host side panels). Cheap no-ops when the host passes none.
  const STATUS_INTERVAL_MS = 500;
  let currentDelegate: HandDelegate | null = null;
  let handsVisible: number | null = null;
  let statusInferenceMs: number | null = null; // exponential moving average
  let lastStatusEmit = 0;
  let lastStatusJson = "";
  function reportStatus(throttled = false) {
    if (!options.onStatus) return;
    const now = performance.now();
    if (throttled && now - lastStatusEmit < STATUS_INTERVAL_MS) return;
    const status: GestureCubeStatus = {
      phase: currentState.phase,
      handsVisible,
      delegate: currentDelegate,
      inferenceMs: statusInferenceMs === null ? null : Math.round(statusInferenceMs * 10) / 10,
      minMovesRemaining: scrambleCompleted ? currentSolution.length : null,
      solved: solvedState,
    };
    const json = JSON.stringify(status);
    if (json === lastStatusJson) return;
    lastStatusJson = json;
    lastStatusEmit = now;
    options.onStatus(status);
  }
  let userMoves = 0;
  let solveStartedAt = 0;
  let optimalAtStart = 0;

  // The HUD and the pill are always visible except while the gesture guide is open.
  // The guide opens automatically after the scramble (until the first interaction) or manually via "?".
  function updateGestureGuideVisibility() {
    const guideVisible = (hasRoomForGuide() && scrambleCompleted && !hasInteracted && !guideDismissed) || guideManuallyOpen;
    // the guide (auto or manual) and the hint help never overlap; closeHelp() re-enters
    // this function with hintHelpOpen=false, so return here and let that call finish
    if (guideVisible && hintHelpOpen) {
      solverDisplay.closeHelp();
      return;
    }
    gestureGuide.setSideVisible(guideVisible);
    gestureGuide.setMiddleVisible(guideVisible);
    // The HUD and the pill only exist once the game is running; before that the box shows
    // just the cube and the play screen.
    const playing = currentState.phase === "playing";
    gestureGuide.setHandStatusVisible(playing && !guideVisible && !hintHelpOpen && !solvedState);
    gestureGuide.setSolvedVisible(solvedState && !guideVisible && !hintHelpOpen);
    gestureGuide.setManualMode(guideManuallyOpen);
    // "?" is only meaningful once the auto guide is gone, or when there was no room for it.
    gestureGuide.setHelpButtonVisible(currentState.phase === "playing" && (hasInteracted || guideDismissed || !hasRoomForGuide()));
    // Pill hidden while the guide or its own help panel is open.
    const pillVisible = playing && !guideVisible && !hintHelpOpen;
    solverDisplay.setVisible(pillVisible);
    // Opacity changes are invisible to the guide's ResizeObserver; report them explicitly.
    gestureGuide.setHintPanelVisible(pillVisible);
  }
  // Gesture input disabled during the entry animation and scramble; cleared in onCubeStateChange.
  let inputLocked = true;

  function hideHintVisuals() {
    hintOverlay.hide();
  }

  function toggleHint() {
    hintActive = !hintActive;
    solverDisplay.setHintActive(hintActive);
    // hide immediately, don't wait for the next frame
    if (!hintActive) hideHintVisuals();
  }

  // The move the hint should show right now, or null. pendingSecondHalfOfDoubleMove wins
  // over a fresh solve() so the second half of a "2" points at the same target.
  function hintMove(): MoveName | null {
    if (!hintActive || solvedState) return null;
    return pendingSecondHalfOfDoubleMove ?? currentSolution[0] ?? null;
  }

  // Called by MoveExecutor after every move; updates the move counter and hint tracking.
  function onCubeStateChange(cubeState: CubeState, executedMove?: MoveName) {
    // capture what was actually shown before recomputing
    const shownHintMove: MoveName | undefined = pendingSecondHalfOfDoubleMove ?? currentSolution[0];
    if (executedMove && shownHintMove) {
      if (executedMove === shownHintMove) {
        // hint followed (or second half of a "2" completed)
        pendingSecondHalfOfDoubleMove = null;
      } else if (shownHintMove.endsWith("2") && !executedMove.endsWith("2") && parseMove(shownHintMove).axis === parseMove(executedMove).axis && parseMove(shownHintMove).layer === parseMove(executedMove).layer) {
        // first half of a "2" applied; remember to show the second half
        pendingSecondHalfOfDoubleMove = executedMove;
      } else {
        // different move: reset
        pendingSecondHalfOfDoubleMove = null;
      }
    } else {
      // reset(): nothing pending
      pendingSecondHalfOfDoubleMove = null;
    }

    // solve() speaks in the normalized frame; convert to the physical cube before use.
    currentSolution = solve(stateToCorners(cubeState)).map((m) => toPhysicalMove(cubeState, m));
    solverDisplay.setMinimumMoves(currentSolution.length);
    reportStatus();
    if (inputLocked && executor.isIdle) {
      inputLocked = false;
      scrambleCompleted = true;
      solveStartedAt = performance.now();
      optimalAtStart = currentSolution.length;
      userMoves = 0;
      updateGestureGuideVisibility();
    } else if (executedMove && scrambleCompleted && !solvedState) {
      userMoves++;
    }
    // a solved state before the scramble is not a completion
    if (currentSolution.length === 0 && hasScrambled && scrambleCompleted && !solvedState) {
      solvedState = true;
      hideHintVisuals();
      gestureGuide.updateSolved({ moves: userMoves, timeMs: performance.now() - solveStartedAt, optimalMoves: optimalAtStart });
      updateGestureGuideVisibility();
      options.onEvent?.("completion");
      reportStatus();
    }
  }

  // "Play again": lock input, scramble the (already solved) cube, and let
  // onCubeStateChange reopen the game when the scramble queue drains.
  function restartGame() {
    if (!solvedState || !executor.isIdle) return;
    solvedState = false;
    scrambleCompleted = false;
    inputLocked = true;
    pendingSecondHalfOfDoubleMove = null;
    updateGestureGuideVisibility();
    for (const move of generateScramble()) executor.enqueue(move);
  }

  const executor = new MoveExecutor(cubeGroup, meshes, state, onCubeStateChange);

  // bound only when options.devKeyboard is set
  const KEY_TO_FACE: Record<string, MoveName> = { u: "U", d: "D", l: "L", r: "R", f: "F", b: "B" };
  function handleKeydown(event: KeyboardEvent) {
    if (event.repeat) return;
    if (inputLocked || solvedState) return;
    if (event.key === "0") {
      executor.reset();
      return;
    }
    const face = KEY_TO_FACE[event.key.toLowerCase()];
    if (!face) return;
    const name = (event.shiftKey ? `${face}'` : face) as MoveName;
    executor.enqueue(name);
  }
  if (options.devKeyboard) window.addEventListener("keydown", handleKeydown);

  let previousHandPos: THREE.Vector3 | null = null;
  let snapping = false;
  let hasInteracted = false;
  let grabState: GrabState = "idle";
  const positionSmoother = new SmoothedPosition();

  // Layer-turn gesture (cell + direction); inactive until the cube has been moved once.
  const layerTurn = new LayerTurnGesture();
  const idleYawStep = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), IDLE_ROTATION_SPEED);
  const idlePitchStep = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), IDLE_ROTATION_SPEED * 0.6);

  // Idle rotation runs in the render loop (independent of hand tracking); stops on first
  // interaction and during snapping.
  const stopAnimationLoop = startAnimationLoop(sceneContext, () => {
    if (!hasInteracted && !snapping) {
      cubeGroup.quaternion.premultiply(idleYawStep).premultiply(idlePitchStep);
    }
  });

  let destroyed = false;
  let trackingFrameId: number | null = null;
  let closeLandmarker: (() => void) | null = null;
  const perfStats: PerfStats | null = options.perfStats ? createPerfStats(container) : null;
  const orientationGate = createOrientationGate(container, strings.orientationGate);
  const removeWatermark = options.watermark === false ? null : createWatermark(container);
  const playScreenRef: { current: PlayScreen | null } = { current: null };

  let currentState: AppState = { phase: "idle" };

  function ensurePlayScreen(): PlayScreen {
    if (!playScreenRef.current) {
      playScreenRef.current = createPlayScreen(container, strings.playScreen, () => void handlePlayClick());
    }
    return playScreenRef.current;
  }

  // Single place that maps app state to what is on screen.
  function render() {
    updateGestureGuideVisibility();
    switch (currentState.phase) {
      case "idle": {
        const screen = ensurePlayScreen();
        screen.setLoading(false);
        screen.setMessage("");
        break;
      }
      case "loadingModel": {
        const screen = ensurePlayScreen();
        screen.setLoading(true);
        screen.setMessage(strings.playScreen.loadingModelMessage);
        break;
      }
      case "ready": {
        const screen = ensurePlayScreen();
        screen.setLoading(false);
        screen.setMessage(strings.playScreen.readyMessage);
        break;
      }
      case "playing": {
        // overlay removed immediately so the entry animation is visible
        playScreenRef.current?.remove();
        playScreenRef.current = null;
        if (!hasScrambled) {
          hasScrambled = true;
          // slide to REST_POSITION while input stays locked until the scramble ends
          void animatePosition(cubeGroup, CUBE_REST_POSITION, ENTRY_ANIMATION_MS).then(() => {
            if (destroyed) return;
            for (const move of generateScramble()) executor.enqueue(move);
          });
        }
        break;
      }
      default: {
        // compile-time exhaustiveness
        const exhaustive: never = currentState;
        throw new Error(`Unhandled state: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  function transition(next: AppState) {
    currentState = next;
    render();
    reportStatus();
    if (next.phase === "playing") {
      options.onEvent?.("play_start");
      startTracking(next.landmarker);
    }
  }

  async function prepareGame() {
    transition({ phase: "loadingModel" });
    const { landmarker, delegate } = await createHandLandmarker(options.handDelegate ?? "GPU", options.assetPaths);
    if (destroyed) {
      landmarker.close();
      return;
    }
    currentDelegate = delegate;
    reportStatus();
    perfStats?.setDelegate(delegate);
    perfStats?.setSource(video.videoWidth, video.videoHeight);
    closeLandmarker = () => landmarker.close();
    transition({ phase: "ready", landmarker });
  }

  let playClickFired = false;
  function firePlayClick() {
    if (playClickFired) return;
    playClickFired = true;
    options.onPlayClick?.(); // synchronously, inside the user gesture
  }

  function handlePlayClick() {
    if (currentState.phase === "idle") {
      firePlayClick();
      void prepareGame();
      return;
    }
    if (currentState.phase === "ready") {
      firePlayClick();
      transition({ phase: "playing", landmarker: currentState.landmarker });
    }
  }

  function startTracking(landmarker: HandLandmarker) {
    controls.enabled = false; // camera stays fixed in AR mode
    const cameraForward = camera.getWorldDirection(new THREE.Vector3());
    // camera is fixed, compute its axes once
    const { right: cameraRight, up: cameraUp } = cameraAxes(camera);

    function trackingLoop() {
      if (video.readyState >= 2) {
        const now = performance.now();
        const result = detectHands(landmarker, video, now);
        const sampleMs = performance.now() - now;
        perfStats?.addSample(sampleMs);
        statusInferenceMs = statusInferenceMs === null ? sampleMs : statusInferenceMs * 0.9 + sampleMs * 0.1;
        handsVisible = result.landmarks.length;
        reportStatus(true);
        drawLandmarks(overlay, result, mirrored);
        // face currently towards the camera, shared by the grab/release branches
        const preview = nearestSnapOrientation(cubeGroup.quaternion, cameraForward, cameraUp);
        hintOverlay.render({ move: hintMove(), preview, cubeState: executor.getState(), settled: !snapping, cameraRight, cameraUp, now });

        // left fist unlocks + right fist grabs = rotation active
        const leftHand = findHandByLabel(result, "Left");
        const rightHand = findHandByLabel(result, "Right");
        const unlocked = !inputLocked && leftHand !== null && countExtendedFingers(leftHand) === 0;
        grabState = rightHand ? detectGrab(rightHand, grabState).state : "idle";
        const grabbingHand = unlocked && rightHand && grabState === "grabbing" ? rightHand : null;

        // update the HUD every frame; visibility is controlled separately
        gestureGuide.updateHandStatus({
          left: classifyHandFingerState(leftHand),
          // While rotation is active the right hand is reported as "fist" even if grab
          // hysteresis tolerates one finger; otherwise the HUD would contradict the cube.
          right: grabbingHand !== null ? "fist" : classifyHandFingerState(rightHand),
          unlocked,
          rotationActive: grabbingHand !== null,
        });

        if (!hasInteracted && grabbingHand) {
          hasInteracted = true;
          updateGestureGuideVisibility();
          options.onEvent?.("successful_detection");
        }
        // idle rotation itself runs in the render loop; only the transition is handled here

        if (grabbingHand && !snapping) {
          // new grab: previous selection is stale
          layerTurn.reset();
          hideCellMarker(cellMarker);
          const ndc = landmarkToNdc(palmCenter(grabbingHand), mirrored);
          const rawHandPos = screenToWorld(camera, ndc.x, ndc.y);

          if (rawHandPos) {
            // smoothed position absorbs landmark jitter
            const handPos = positionSmoother.update(rawHandPos);
            // Single rotation about one axis built from the camera's real right/up vectors
            // (trackball style). Euler angles on world axes would mix in a vertical skew
            // because the camera is tilted.
            if (previousHandPos) {
              const delta = handPos.clone().sub(previousHandPos);
              // horizontal world distance is scaled by aspect (three.js derives horizontal
              // FOV from vertical × aspect); cancel it so both axes rotate equally
              const screenRight = delta.dot(cameraRight) / camera.aspect;
              const screenUp = delta.dot(cameraUp);
              const angle = Math.sqrt(screenRight * screenRight + screenUp * screenUp) * ROTATION_SENSITIVITY;
              if (angle > 0) {
                const rotationAxis = new THREE.Vector3()
                  .addScaledVector(cameraUp, screenRight)
                  .addScaledVector(cameraRight, -screenUp)
                  .normalize();
                const deltaRotation = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle);
                cubeGroup.quaternion.premultiply(deltaRotation);
              }
            }
            previousHandPos = handPos.clone();
          }
          // live preview: which face lands on screen if released now
          showFaceFrame(faceFrame, preview.axis, preview.layer);
        } else if (!grabbingHand) {
          // released: snap to the nearest face-on orientation
          if (previousHandPos && !snapping) {
            snapping = true;
            hideFaceFrame(faceFrame);
            // preview was computed from this frame's quaternion; reuse it
            void animateToOrientation(cubeGroup, preview.quaternion, SNAP_DURATION_MS).then(() => {
              snapping = false;
            });
          }
          previousHandPos = null;
          positionSmoother.reset();

          // --- layer-turn gesture --- (not while free-rotating or snapping, and only after the
          // first interaction). Must also run while the left hand is a fist: the user selects
          // a cell first, then raises fingers for the direction.
          if (!snapping && hasInteracted && !inputLocked && !solvedState) {
            const cells = computeFaceGrid(preview.axis, preview.layer, executor.getState(), cubeGroup.quaternion, cameraRight, cameraUp);
            const { selectedCell, move } = layerTurn.update({ rightHand, leftHand, cells, hintMove: hintMove(), canEnqueue: executor.isIdle });
            const cubieMesh = selectedCell ? meshes.get(selectedCell.cubieId) : undefined;
            if (cubieMesh) {
              // via world position: during an animation the mesh may be parented to a layer pivot
              showCellMarker(cellMarker, cubeGroup.worldToLocal(cubieMesh.getWorldPosition(new THREE.Vector3())), preview.axis, preview.layer);
            } else {
              hideCellMarker(cellMarker);
            }
            if (move) executor.enqueue(move);
          } else if (!snapping) {
            layerTurn.reset();
            hideCellMarker(cellMarker);
          }
        }
      }
      trackingFrameId = requestAnimationFrame(trackingLoop);
    }
    trackingFrameId = requestAnimationFrame(trackingLoop);
  }

  // If camera permission is revoked mid-game the track ends and the video freezes.
  // Clean up and let the caller handle reconnection.
  const videoTrack = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
  function handleCameraEnded() {
    if (destroyed) return;
    // clean up before notifying so a remount does not collide with this DOM
    destroy();
    options.onCameraEnded?.();
  }
  videoTrack?.addEventListener("ended", handleCameraEnded);

  render();
  if (options.autoLoad) void prepareGame();

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    videoTrack?.removeEventListener("ended", handleCameraEnded);
    window.removeEventListener("keydown", handleKeydown);
    if (trackingFrameId !== null) cancelAnimationFrame(trackingFrameId);
    stopAnimationLoop();
    videoBackground?.dispose();
    closeLandmarker?.();
    perfStats?.remove();
    orientationGate.remove();
    removeWatermark?.();
    playScreenRef.current?.remove();
    cubeScaleObserver.disconnect();
    disposeScene();
    overlay.remove();
    solverDisplay.remove();
    gestureGuide.remove();
  }

  function drawOverlay(ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number) {
    const background = scene.background;
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera); // synchronous: the buffer is valid for drawImage right after
    ctx.drawImage(renderer.domElement, dx, dy, dw, dh);
    // The hand skeleton is already drawn each frame onto its own 2D canvas; copying it in
    // puts the player's tracked hands into captures at zero extra cost.
    if (overlay.width > 0 && overlay.height > 0) ctx.drawImage(overlay, dx, dy, dw, dh);
    scene.background = background;
  }

  function setSpaciousLayout(spacious: boolean) {
    hasSpaciousLayout = spacious;
    updateGestureGuideVisibility();
  }

  return { destroy, setSpaciousLayout, drawOverlay };
}
