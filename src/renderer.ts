import "./style.css";

type PetState =
  | "idle"
  | "running-right"
  | "running-left"
  | "waving"
  | "jumping"
  | "failed"
  | "waiting"
  | "running"
  | "review";

type AnimationDef = {
  row: number;
  durations: number[];
};

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 9;

const animations: Record<PetState, AnimationDef> = {
  idle: { row: 0, durations: [280, 110, 110, 140, 140, 320] },
  "running-right": { row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  "running-left": { row: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  waving: { row: 3, durations: [140, 140, 140, 280] },
  jumping: { row: 4, durations: [140, 140, 140, 140, 280] },
  failed: { row: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { row: 6, durations: [150, 150, 150, 150, 150, 260] },
  running: { row: 7, durations: [120, 120, 120, 120, 120, 220] },
  review: { row: 8, durations: [150, 150, 150, 150, 150, 280] }
};

const sprite = requiredElement<HTMLDivElement>("#petSprite");
const petName = requiredElement<HTMLSpanElement>("#petName");
const petState = requiredElement<HTMLSpanElement>("#petState");
const cpuMetric = requiredElement<HTMLSpanElement>("#cpuMetric");
const memoryMetric = requiredElement<HTMLSpanElement>("#memoryMetric");
const networkMetric = requiredElement<HTMLSpanElement>("#networkMetric");

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Pet UI did not mount ${selector}.`);
  }

  return element;
}

let currentState: PetState = "idle";
let overrideState: PetState | undefined;
let lockedUntil = 0;
let frameIndex = 0;
let nextFrameAt = 0;
let lastWaveAt = 0;

function setState(nextState: PetState, now = performance.now()) {
  if (currentState === nextState) {
    return;
  }

  currentState = nextState;
  frameIndex = 0;
  nextFrameAt = now;
  lockedUntil = now + minimumStateDuration(nextState);
  updateStateLabel();
}

function updateStateLabel() {
  petState.textContent = overrideState ? `${currentState} manual` : currentState;
}

function minimumStateDuration(state: PetState) {
  switch (state) {
    case "failed":
      return 5000;
    case "review":
      return 3500;
    case "running":
    case "running-right":
    case "running-left":
      return 2500;
    case "waving":
    case "jumping":
      return 1800;
    case "waiting":
      return 4500;
    case "idle":
      return 2000;
  }
}

function chooseState(metrics: SystemMetrics, now: number): PetState {
  if (metrics.memory >= 90 || metrics.cpu >= 95) {
    return "failed";
  }

  if (metrics.memory >= 82 || metrics.cpu >= 75) {
    return "review";
  }

  if (metrics.diskBytesPerSecond >= 4_000_000 || metrics.networkBytesPerSecond >= 1_500_000) {
    return "running";
  }

  if (metrics.cpu <= 8 && metrics.memory <= 68 && metrics.diskBytesPerSecond < 200_000) {
    return "waiting";
  }

  if (now - lastWaveAt > 45_000 && metrics.cpu < 35 && metrics.memory < 80) {
    lastWaveAt = now;
    return "waving";
  }

  return "idle";
}

function renderFrame(now: number) {
  const animation = animations[currentState];
  if (now >= nextFrameAt) {
    frameIndex = (frameIndex + 1) % animation.durations.length;
    nextFrameAt = now + animation.durations[frameIndex];
  }

  const x = frameIndex * CELL_WIDTH;
  const y = animation.row * CELL_HEIGHT;

  sprite.style.backgroundPosition = `-${x}px -${y}px`;
  requestAnimationFrame(renderFrame);
}

async function boot() {
  const petInfo = await window.petRuntime?.getPetInfo();
  if (!petInfo) {
    throw new Error("Pet runtime API is unavailable.");
  }

  petName.textContent = petInfo.displayName;
  document.querySelector(".pet-shell")?.setAttribute(
    "title",
    "1 idle, 2 run right, 3 run left, 4 wave, 5 jump, 6 failed, 7 waiting, 8 running, 9 review, 0/Esc auto"
  );
  sprite.style.backgroundImage = `url("${petInfo.spritesheetUrl}")`;
  sprite.style.backgroundSize = `${CELL_WIDTH * ATLAS_COLUMNS}px ${CELL_HEIGHT * ATLAS_ROWS}px`;

  window.petRuntime?.onMetrics((metrics) => {
    const now = performance.now();
    cpuMetric.textContent = `CPU ${metrics.cpu.toFixed(0)}%`;
    memoryMetric.textContent = `RAM ${metrics.memory.toFixed(0)}%`;
    networkMetric.textContent = `NET ${formatBytesPerSecond(metrics.networkBytesPerSecond)}`;

    if (overrideState) {
      setState(overrideState, now);
      return;
    }

    if (now >= lockedUntil) {
      setState(chooseState(metrics, now), now);
    }
  });

  window.addEventListener("keydown", (event) => {
    const nextOverride = stateFromShortcut(event.key);
    if (event.key === "0" || event.key === "Escape") {
      overrideState = undefined;
      lockedUntil = 0;
      updateStateLabel();
      return;
    }

    if (!nextOverride) {
      return;
    }

    overrideState = nextOverride;
    setState(nextOverride);
  });

  requestAnimationFrame(renderFrame);
}

function formatBytesPerSecond(bytesPerSecond: number) {
  if (bytesPerSecond >= 1_000_000) {
    return `${(bytesPerSecond / 1_000_000).toFixed(1)}MB/s`;
  }

  if (bytesPerSecond >= 1_000) {
    return `${(bytesPerSecond / 1_000).toFixed(0)}KB/s`;
  }

  return `${bytesPerSecond.toFixed(0)}B/s`;
}

function stateFromShortcut(key: string): PetState | undefined {
  switch (key) {
    case "1":
      return "idle";
    case "2":
      return "running-right";
    case "3":
      return "running-left";
    case "4":
      return "waving";
    case "5":
      return "jumping";
    case "6":
      return "failed";
    case "7":
      return "waiting";
    case "8":
      return "running";
    case "9":
      return "review";
    default:
      return undefined;
  }
}

boot().catch((error: unknown) => {
  petName.textContent = "Pet failed to start";
  petState.textContent = error instanceof Error ? error.message : String(error);
});
