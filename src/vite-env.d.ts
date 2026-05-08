interface PetInfo {
  id: string;
  displayName: string;
  description: string;
  spritesheetUrl: string;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  diskBytesPerSecond: number;
  networkBytesPerSecond: number;
}

interface PetRuntimeApi {
  getPetInfo(): Promise<PetInfo>;
  onMetrics(callback: (metrics: SystemMetrics) => void): () => void;
}

interface Window {
  petRuntime?: PetRuntimeApi;
}
