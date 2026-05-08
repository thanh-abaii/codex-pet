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
  listPets(): Promise<PetInfo[]>;
  showMenu(): Promise<void>;
  onPetChanged(callback: () => void): () => void;
  onMetrics(callback: (metrics: SystemMetrics) => void): () => void;
}

interface Window {
  petRuntime?: PetRuntimeApi;
}
