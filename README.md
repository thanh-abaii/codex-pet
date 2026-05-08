# Codex Pet Telemetry Companion

An experimental standalone desktop pet inspired by the small animated pets in the Codex desktop app.

![Ngoan Dong desktop pet preview](assets/readme-preview.png)

This project reuses a Codex-compatible pet package, renders the pet as a floating Windows companion, and changes its animation state based on live system telemetry such as CPU, RAM, disk, and network activity.

## Concept

Codex pets are tiny animated companions built from a fixed spritesheet atlas. In Codex, they sit inside the product experience. This project explores what happens when that same idea becomes independent from Codex: a small desktop companion that reacts to the health and workload of the machine itself.

The pet is not just decorative. It acts like an ambient status indicator:

- When the system is calm, it waits or idles.
- When RAM or CPU pressure rises, it looks focused or concerned.
- When the machine is under heavy pressure, it falls into an error state.
- When disk or network activity spikes, it runs.

## Current Pet

The current build reads the existing local Codex pet:

```text
C:\Users\DELL\.codex\pets\ngoan-dong
```

Expected files:

```text
pet.json
spritesheet.webp
```

Example manifest:

```json
{
  "id": "ngoan-dong",
  "displayName": "Ngoan Dong",
  "description": "A playful trickster coding companion inspired by Chau Ngoan Dong temperament.",
  "spritesheetPath": "spritesheet.webp"
}
```

## Pet Atlas

The app uses the Codex pet atlas layout:

```text
Atlas: 1536x1872
Grid: 8 columns x 9 rows
Cell: 192x208
```

Animation rows:

| Key | State | Row | Meaning |
| --- | --- | ---: | --- |
| `1` | `idle` | 0 | Neutral breathing or blinking. |
| `2` | `running-right` | 1 | Directional run to the right. |
| `3` | `running-left` | 2 | Directional run to the left. |
| `4` | `waving` | 3 | Greeting or attention gesture. |
| `5` | `jumping` | 4 | Jump or celebratory movement. |
| `6` | `failed` | 5 | Error, pressure, or exhausted reaction. |
| `7` | `waiting` | 6 | Calm waiting state. |
| `8` | `running` | 7 | Generic running or busy state. |
| `9` | `review` | 8 | Focused, inspecting, thinking state. |

## Telemetry Behavior

The Electron main process samples system metrics with `systeminformation`. The renderer receives those metrics and chooses the pet state.

CPU, RAM, and disk are read directly from `systeminformation`. Network activity is calculated manually from adapter byte counters because on Windows `rx_sec` and `tx_sec` can be `null` even when `rx_bytes` and `tx_bytes` are valid. The app stores the previous network sample and computes:

```text
bytes per second = (current rx_bytes + tx_bytes - previous rx_bytes + tx_bytes) / elapsed time
```

Current rule mapping:

| Condition | State |
| --- | --- |
| RAM >= 90% or CPU >= 95% | `failed` |
| RAM >= 82% or CPU >= 75% | `review` |
| Disk throughput is high | `running` |
| Network throughput is high | `running` |
| CPU/RAM/disk are quiet | `waiting` |
| Calm for a while | `waving` |
| Fallback | `idle` |

The thresholds are intentionally simple. They make the pet feel alive without pretending to be a full monitoring dashboard.

The visible metric strip currently shows:

```text
CPU 29%  RAM 87%  NET 42KB/s
```

## Manual State Testing

Click the pet window so it has focus, then press:

```text
1 = idle
2 = running-right
3 = running-left
4 = waving
5 = jumping
6 = failed
7 = waiting
8 = running
9 = review
0 = return to automatic telemetry mode
Esc = return to automatic telemetry mode
```

When a manual state is active, the label shows `manual`.

## Run

Install dependencies:

```powershell
npm install
```

Start the app:

```powershell
npm run start
```

Development mode:

```powershell
npm run dev
```

Build only:

```powershell
npm run build
```

Typecheck:

```powershell
npm run typecheck
```

## Window Behavior

The current window is designed to behave like a desktop pet:

- Always on top.
- Transparent background.
- Frameless window.
- Drag the pet area to move it.
- Right click for `Reload` and `Quit`.

## Architecture

```text
Electron main process
  -> reads pet.json
  -> resolves spritesheet.webp
  -> samples CPU/RAM/disk/network telemetry
  -> sends metrics to renderer over IPC

Renderer
  -> draws spritesheet frames with CSS background-position
  -> maps telemetry to pet states
  -> supports manual state override keys
```

Important files:

```text
electron/main.ts      Electron window, pet loading, system telemetry
electron/preload.ts   Safe IPC bridge
src/renderer.ts       animation loop, state machine, keyboard shortcuts
src/style.css         transparent desktop pet presentation
vite.config.ts        Vite build config for file:// loading
```

## Future Ideas

- Configurable pet folder instead of hardcoding `ngoan-dong`.
- Tray menu for choosing pets and states.
- Save window position.
- Hide telemetry labels by default.
- Add temperature and battery telemetry.
- Port the shell to Tauri once Rust is installed.
- Package as a Windows installer.
