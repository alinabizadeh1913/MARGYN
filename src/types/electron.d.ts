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

      getCryptoKey: () => Promise<string>;

      loadActivePdf: () => Promise<Uint8Array | null>;
      saveActivePdf: (data: Uint8Array) => Promise<boolean>;
      clearActivePdf: () => Promise<boolean>;

      // ✅ خروجی به صورت آرایه
      openPdf: () => Promise<Array<{
        data: Uint8Array;
        name: string;
        libraryPath: string;
      }> | null>;

      readPdfPath: (path: string) => Promise<{
        data: Uint8Array;
        name: string;
        libraryPath: string;
      } | null>;

      getPathForFile: (file: File) => string;

      onOpenPdfFile: (callback: (filePath: string) => void) => () => void;

      loadLibraryFile: (filePath: string) => Promise<Uint8Array | null>;
      deleteLibraryFile: (filePath: string) => Promise<boolean>;
      clearLibraryFolder: () => Promise<boolean>;

      saveLibraryFile: (
        data: Uint8Array,
        name: string,
      ) => Promise<string | null>;

      selectDirectory: () => Promise<string | null>;
      exportProject: (
        data: any,
        defaultDir: string | null,
      ) => Promise<string | null>;

      saveProject: (
        data: any,
        filePath: string | null,
        defaultDir: string | null,
      ) => Promise<string | null>;

      importProject: (
        defaultDir?: string | null,
      ) => Promise<{ data: any; filePath: string } | null>;

      readProjectFromPath: (
        filePath: string,
      ) => Promise<{ data: any; filePath: string } | null>;

      onAppCloseRequest: (callback: () => void) => () => void;
      forceCloseApp: () => void;

      // ✅ اطلاع‌دادن به Main که React آماده است
      notifyRendererReady: () => void;

      onOpenMargynFile: (callback: (filePath: string) => void) => () => void;

      setRecordingShortcut: (isRecording: boolean) => void;
      onShortcutTriggered: (callback: (shortcut: string) => void) => () => void;

      savePdf: (
        data: Uint8Array,
        defaultName: string,
      ) => Promise<string | null>;
    };
  }
}
export {};
