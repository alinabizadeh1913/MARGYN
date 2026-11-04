declare global {
  interface Window {
    electronAPI?: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      platform: string;
      loadDb: () => Promise<Uint8Array | null>;
      saveDb: (data: Uint8Array) => Promise<boolean>;
      loadWasm: () => Promise<Uint8Array>;
      openPdf: () => Promise<Uint8Array | null>;
    };
  }
}
export {};