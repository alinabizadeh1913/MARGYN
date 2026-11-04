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
      loadActivePdf: () => Promise<Uint8Array | null>;
      saveActivePdf: (data: Uint8Array) => Promise<boolean>;
      clearActivePdf: () => Promise<boolean>;
      openPdf: () => Promise<{
        data: Uint8Array;
        name: string;
        libraryPath: string;
      } | null>;

      loadLibraryFile: (filePath: string) => Promise<Uint8Array | null>;
      deleteLibraryFile: (filePath: string) => Promise<boolean>;
      clearLibraryFolder: () => Promise<boolean>;
    };
  }
}
export {};
