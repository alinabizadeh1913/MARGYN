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

      // ✅ NEW: اضافه شدن توابع PDF
      readPdfPath: (path: string) => Promise<{
        data: Uint8Array;
        name: string;
        libraryPath: string;
      } | null>;
      onOpenPdfFile: (callback: (filePath: string) => void) => () => void;

      loadLibraryFile: (filePath: string) => Promise<Uint8Array | null>;
      deleteLibraryFile: (filePath: string) => Promise<boolean>;
      clearLibraryFolder: () => Promise<boolean>;

      selectDirectory: () => Promise<string | null>;
      exportProject: (
        data: any,
        defaultDir: string | null,
      ) => Promise<string | null>;
      saveProject: (
        data: any,
        filePath: string | null,
      ) => Promise<string | null>;
      importProject: () => Promise<{ data: any; filePath: string } | null>;
      readProjectFromPath: (
        filePath: string,
      ) => Promise<{ data: any; filePath: string } | null>;

      onAppCloseRequest: (callback: () => void) => () => void;
      forceCloseApp: () => void;

      onOpenMargynFile: (callback: (filePath: string) => void) => () => void;
    };
  }
}
export {};
