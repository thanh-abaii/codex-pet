import { contextBridge, ipcRenderer } from "electron";

type SystemMetrics = {
  cpu: number;
  memory: number;
  diskBytesPerSecond: number;
  networkBytesPerSecond: number;
};

contextBridge.exposeInMainWorld("petRuntime", {
  getPetInfo: () => ipcRenderer.invoke("pet:getInfo"),
  listPets: () => ipcRenderer.invoke("pet:list"),
  showMenu: () => ipcRenderer.invoke("menu:show"),
  onPetChanged: (callback: () => void) => {
    const listener = () => {
      callback();
    };

    ipcRenderer.on("pet:changed", listener);
    return () => ipcRenderer.off("pet:changed", listener);
  },
  onMetrics: (callback: (metrics: SystemMetrics) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, metrics: SystemMetrics) => {
      callback(metrics);
    };

    ipcRenderer.on("system:metrics", listener);
    return () => ipcRenderer.off("system:metrics", listener);
  }
});
