import { contextBridge, ipcRenderer } from "electron";

type SystemMetrics = {
  cpu: number;
  memory: number;
  diskBytesPerSecond: number;
  networkBytesPerSecond: number;
};

contextBridge.exposeInMainWorld("petRuntime", {
  getPetInfo: () => ipcRenderer.invoke("pet:getInfo"),
  onMetrics: (callback: (metrics: SystemMetrics) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, metrics: SystemMetrics) => {
      callback(metrics);
    };

    ipcRenderer.on("system:metrics", listener);
    return () => ipcRenderer.off("system:metrics", listener);
  }
});
