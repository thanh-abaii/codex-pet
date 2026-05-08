import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import si from "systeminformation";

type PetManifest = {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
};

type PetInfo = Omit<PetManifest, "spritesheetPath"> & {
  spritesheetUrl: string;
};

type SystemMetrics = {
  cpu: number;
  memory: number;
  diskBytesPerSecond: number;
  networkBytesPerSecond: number;
};

const petDir = path.join(app.getPath("home"), ".codex", "pets", "ngoan-dong");
const petManifestPath = path.join(petDir, "pet.json");
const logPath = path.join(app.getPath("userData"), "codex-pet.log");
const builtInPets = [
  {
    id: "codex",
    displayName: "Codex",
    description: "The original Codex companion.",
    spritesheetPath: path.join(__dirname, "..", "assets", "built-in-pets", "codex-spritesheet-v4-Bl6P89d_.webp")
  },
  {
    id: "dewey",
    displayName: "Dewey",
    description: "A tidy duck for calm workspace days.",
    spritesheetPath: path.join(__dirname, "..", "assets", "built-in-pets", "dewey-spritesheet-v4-gAYk_M9g.webp")
  },
  {
    id: "fireball",
    displayName: "Fireball",
    description: "Hot path energy for fast iteration.",
    spritesheetPath: path.join(__dirname, "..", "assets", "built-in-pets", "fireball-spritesheet-v4-BtU8R9Qp.webp")
  },
  {
    id: "rocky",
    displayName: "Rocky",
    description: "A steady rock when the diff gets large.",
    spritesheetPath: path.join(__dirname, "..", "assets", "built-in-pets", "rocky-spritesheet-v4-3RlTi26B.webp")
  },
  {
    id: "seedy",
    displayName: "Seedy",
    description: "Small green shoots for new ideas.",
    spritesheetPath: path.join(__dirname, "..", "assets", "built-in-pets", "seedy-spritesheet-v4-CdlE_fn9.webp")
  },
  {
    id: "stacky",
    displayName: "Stacky",
    description: "A balanced stack for deep work.",
    spritesheetPath: path.join(__dirname, "..", "assets", "built-in-pets", "stacky-spritesheet-v4-CaUJd4fY.webp")
  },
  {
    id: "bsod",
    displayName: "BSOD",
    description: "A tiny blue-screen companion.",
    spritesheetPath: path.join(__dirname, "..", "assets", "built-in-pets", "bsod-spritesheet-v4-BRrRVy1T.webp")
  },
  {
    id: "null-signal",
    displayName: "Null Signal",
    description: "Quiet signal from the void.",
    spritesheetPath: path.join(__dirname, "..", "assets", "built-in-pets", "null-signal-spritesheet-v4-CCoTR-8t.webp")
  }
] satisfies PetManifest[];

let mainWindow: BrowserWindow | undefined;
let selectedPetId = "ngoan-dong";
let previousNetworkSample:
  | {
      bytes: number;
      sampledAt: number;
    }
  | undefined;

function log(message: string, error?: unknown) {
  const detail = error instanceof Error ? `${error.stack ?? error.message}` : error ? String(error) : "";
  fsSync.mkdirSync(path.dirname(logPath), { recursive: true });
  fsSync.appendFileSync(logPath, `${new Date().toISOString()} ${message}${detail ? `\n${detail}` : ""}\n`);
}

async function loadPetInfo(): Promise<PetInfo> {
  const builtInPet = builtInPets.find((pet) => pet.id === selectedPetId);
  if (builtInPet) {
    return {
      id: builtInPet.id,
      displayName: builtInPet.displayName,
      description: builtInPet.description,
      spritesheetUrl: pathToFileURL(builtInPet.spritesheetPath).toString()
    };
  }

  const raw = await fs.readFile(petManifestPath, "utf8");
  const manifest = JSON.parse(raw) as PetManifest;
  const spritesheetPath = path.isAbsolute(manifest.spritesheetPath)
    ? manifest.spritesheetPath
    : path.join(petDir, manifest.spritesheetPath);

  return {
    id: manifest.id,
    displayName: manifest.displayName,
    description: manifest.description,
    spritesheetUrl: pathToFileURL(spritesheetPath).toString()
  };
}

async function allPets(): Promise<PetInfo[]> {
  const pets: PetInfo[] = [];
  try {
    const customPet = await loadCustomPetInfo();
    pets.push(customPet);
  } catch (error) {
    log("custom-pet:failed-to-load", error);
  }

  pets.push(
    ...builtInPets.map((pet) => ({
      id: pet.id,
      displayName: pet.displayName,
      description: pet.description,
      spritesheetUrl: pathToFileURL(pet.spritesheetPath).toString()
    }))
  );

  return pets;
}

async function loadCustomPetInfo(): Promise<PetInfo> {
  const raw = await fs.readFile(petManifestPath, "utf8");
  const manifest = JSON.parse(raw) as PetManifest;
  const spritesheetPath = path.isAbsolute(manifest.spritesheetPath)
    ? manifest.spritesheetPath
    : path.join(petDir, manifest.spritesheetPath);

  return {
    id: manifest.id,
    displayName: manifest.displayName,
    description: manifest.description,
    spritesheetUrl: pathToFileURL(spritesheetPath).toString()
  };
}

async function readMetrics(): Promise<SystemMetrics> {
  const [load, memory, fsStats, networkStats] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsStats(),
    si.networkStats()
  ]);

  const networkBytesPerSecond = networkStats.reduce(
    (total, adapter) =>
      total + Math.max(0, adapter?.rx_bytes ?? 0) + Math.max(0, adapter?.tx_bytes ?? 0),
    0
  );
  const sampledAt = Date.now();
  const networkThroughput =
    previousNetworkSample && sampledAt > previousNetworkSample.sampledAt
      ? Math.max(
          0,
          ((networkBytesPerSecond - previousNetworkSample.bytes) * 1000) /
            (sampledAt - previousNetworkSample.sampledAt)
        )
      : 0;
  previousNetworkSample = {
    bytes: networkBytesPerSecond,
    sampledAt
  };

  return {
    cpu: clamp(numberOrZero(load?.currentLoad), 0, 100),
    memory: clamp((numberOrZero(memory?.active) / Math.max(1, numberOrZero(memory?.total))) * 100, 0, 100),
    diskBytesPerSecond: Math.max(0, fsStats?.rx_sec ?? 0) + Math.max(0, fsStats?.wx_sec ?? 0),
    networkBytesPerSecond: networkThroughput
  };
}

function numberOrZero(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function createWindow() {
  log("createWindow:start");
  mainWindow = new BrowserWindow({
    width: 210,
    height: 250,
    x: 160,
    y: 160,
    show: true,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    title: "Codex Pet",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.moveTop();
  log("createWindow:shown");

  mainWindow.on("closed", () => {
    log("window:closed");
    mainWindow = undefined;
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    log(`webContents:did-fail-load ${errorCode} ${errorDescription}`);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    log("webContents:did-finish-load");
  });
  mainWindow.webContents.on("context-menu", () => {
    showPetMenu();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
  log("createWindow:loaded");
}

function startMetricsLoop() {
  const publish = async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    try {
      mainWindow.webContents.send("system:metrics", await readMetrics());
    } catch (error) {
      log("metrics:failed", error);
      console.error("Failed to read system metrics", error);
    }
  };

  void publish();
  setInterval(publish, 1500);
}

ipcMain.handle("pet:getInfo", loadPetInfo);
ipcMain.handle("pet:list", allPets);
ipcMain.handle("menu:show", showPetMenu);

function showPetMenu() {
  const petMenu = [
    { id: "ngoan-dong", label: "Ngoan Dong" },
    ...builtInPets.map((pet) => ({ id: pet.id, label: pet.displayName }))
  ].map((pet) => ({
    label: pet.label,
    type: "radio" as const,
    checked: pet.id === selectedPetId,
    click: () => {
      selectedPetId = pet.id;
      mainWindow?.webContents.send("pet:changed", selectedPetId);
    }
  }));

  Menu.buildFromTemplate([
    { label: "Pet", submenu: petMenu },
    { label: "Reload", click: () => mainWindow?.reload() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]).popup({ window: mainWindow });
}

app.whenReady().then(async () => {
  try {
    log("app:ready");
    await createWindow();
    startMetricsLoop();
  } catch (error) {
    log("app:startup-failed", error);
  }
});

app.on("window-all-closed", () => {
  log("app:window-all-closed");
});
