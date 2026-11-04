import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "./schema";
import { drawings, settings, recentFiles } from "./schema";
import { and, eq, desc } from "drizzle-orm";

let db: any = null;
let sqliteInstance: SqlJsDatabase | null = null;
let dbInitPromise: Promise<any> | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

export async function getDb() {
  if (typeof window === "undefined") throw new Error("Database is client-only");
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      let wasmBinary: Uint8Array | undefined;
      if (window.electronAPI) {
        const wasmBuffer = await window.electronAPI.loadWasm();
        if (wasmBuffer) wasmBinary = new Uint8Array(wasmBuffer);
      }

      const SQL = await initSqlJs({
        ...(wasmBinary
          ? { wasmBinary: wasmBinary as any }
          : { locateFile: (file) => `/${file}` }),
      });

      let dbData: Uint8Array | null = null;
      if (window.electronAPI) dbData = await window.electronAPI.loadDb();

      sqliteInstance = dbData ? new SQL.Database(dbData) : new SQL.Database();

      sqliteInstance.run(`
        CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, file_path TEXT, start_time INTEGER NOT NULL, end_time INTEGER, start_page INTEGER NOT NULL, end_page INTEGER, last_page INTEGER, pages_read INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS drawings (id TEXT PRIMARY KEY, session_id TEXT, page_number INTEGER NOT NULL, target TEXT NOT NULL DEFAULT 'margin', data TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS recent_files (id TEXT PRIMARY KEY, name TEXT NOT NULL, file_path TEXT NOT NULL, last_opened INTEGER NOT NULL, completed INTEGER DEFAULT 0);
      `);

      try {
        sqliteInstance.run("SELECT file_path FROM sessions LIMIT 1");
      } catch (e) {
        sqliteInstance.run("ALTER TABLE sessions ADD COLUMN file_path TEXT");
      }

      try {
        sqliteInstance.run("SELECT last_page FROM sessions LIMIT 1");
      } catch (e) {
        sqliteInstance.run("ALTER TABLE sessions ADD COLUMN last_page INTEGER");
      }

      try {
        sqliteInstance.run("SELECT target FROM drawings LIMIT 1");
      } catch (e) {
        sqliteInstance.run(
          "ALTER TABLE drawings ADD COLUMN target TEXT NOT NULL DEFAULT 'margin'",
        );
      }

      try {
        sqliteInstance.run("SELECT completed FROM recent_files LIMIT 1");
      } catch (e) {
        sqliteInstance.run(
          "ALTER TABLE recent_files ADD COLUMN completed INTEGER DEFAULT 0",
        );
      }

      db = drizzle(sqliteInstance, { schema });
      await saveDb(true);
      return db;
    } catch (error) {
      console.error("Failed to initialize DB:", error);
      throw error;
    }
  })();

  return dbInitPromise;
}

export async function saveDb(immediate = false) {
  if (!sqliteInstance) return;

  const performSave = async () => {
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        const data = sqliteInstance!.export();
        await window.electronAPI.saveDb(data);
      }
    } catch (e) {
      console.error("Failed to save DB", e);
    }
  };

  if (immediate) {
    if (saveTimeout) clearTimeout(saveTimeout);
    await performSave();
    return;
  }

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(performSave, 3000);
}

export async function saveDrawing(
  pageNumber: number,
  target: "margin" | "pdf",
  lines: any[],
) {
  try {
    const database = await getDb();
    const existing = await database
      .select()
      .from(drawings)
      .where(
        and(eq(drawings.pageNumber, pageNumber), eq(drawings.target, target)),
      );
    const dataString = JSON.stringify(lines);
    if (existing.length > 0) {
      await database
        .update(drawings)
        .set({ data: dataString })
        .where(
          and(eq(drawings.pageNumber, pageNumber), eq(drawings.target, target)),
        );
    } else {
      const uniqueId =
        Date.now().toString() + Math.random().toString(36).substring(2, 9);
      await database
        .insert(drawings)
        .values({ id: uniqueId, pageNumber, target, data: dataString });
    }
    await saveDb();
  } catch (err) {
    console.error("Save error:", err);
  }
}

export async function loadDrawing(
  pageNumber: number,
  target: "margin" | "pdf",
): Promise<any[]> {
  try {
    const database = await getDb();
    const result = await database
      .select()
      .from(drawings)
      .where(
        and(eq(drawings.pageNumber, pageNumber), eq(drawings.target, target)),
      );

    if (result.length > 0 && result[0].data) {
      try {
        const parsed = JSON.parse(result[0].data);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Corrupted drawing data found, resetting this page.");
        return [];
      }
    }
  } catch (e) {
    console.error("DB load error", e);
  }
  return [];
}

export async function clearPageDrawings(pageNumber: number) {
  const database = await getDb();
  await database.delete(drawings).where(eq(drawings.pageNumber, pageNumber));
  await saveDb(true);
}

export async function clearAllDrawings() {
  const database = await getDb();
  await database.delete(drawings);
  await saveDb(true);
}

export async function getAllDrawings() {
  try {
    const database = await getDb();
    return await database.select().from(drawings);
  } catch (e) {
    return [];
  }
}

export async function restoreDrawings(data: any[]) {
  try {
    const database = await getDb();
    if (!data || data.length === 0) return;
    await database.delete(drawings);
    await database.insert(drawings).values(data);
    await saveDb(true);
  } catch (e) {}
}

export async function getSetting(key: string): Promise<string | null> {
  try {
    const database = await getDb();
    const result = await database
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    return result.length > 0 ? result[0].value : null;
  } catch (e) {
    return null;
  }
}

export async function setSetting(key: string, value: string) {
  try {
    const database = await getDb();
    const existing = await database
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    if (existing.length > 0)
      await database
        .update(settings)
        .set({ value })
        .where(eq(settings.key, key));
    else await database.insert(settings).values({ key, value });
    await saveDb();
  } catch (e) {}
}

export async function resetDatabase() {
  if (!sqliteInstance) return;
  sqliteInstance.run(
    `DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS drawings; DROP TABLE IF EXISTS settings; DROP TABLE IF EXISTS recent_files;`,
  );
  sqliteInstance.run(`
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, file_path TEXT, start_time INTEGER NOT NULL, end_time INTEGER, start_page INTEGER NOT NULL, end_page INTEGER, last_page INTEGER, pages_read INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS drawings (id TEXT PRIMARY KEY, session_id TEXT, page_number INTEGER NOT NULL, target TEXT NOT NULL DEFAULT 'margin', data TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS recent_files (id TEXT PRIMARY KEY, name TEXT NOT NULL, file_path TEXT NOT NULL, last_opened INTEGER NOT NULL, completed INTEGER DEFAULT 0);
  `);
  await saveDb(true);
}

export async function addRecentFile(name: string, filePath: string) {
  try {
    const database = await getDb();
    const existing = await database
      .select()
      .from(recentFiles)
      .where(eq(recentFiles.filePath, filePath));
    if (existing.length > 0) {
      await database
        .update(recentFiles)
        .set({ lastOpened: Date.now() })
        .where(eq(recentFiles.filePath, filePath));
      return existing[0];
    } else {
      const uniqueId =
        Date.now().toString() + Math.random().toString(36).substring(2, 9);
      await database
        .insert(recentFiles)
        .values({
          id: uniqueId,
          name,
          filePath,
          lastOpened: Date.now(),
          completed: 0,
        });
      await saveDb();
      return { id: uniqueId, name, filePath, completed: 0 };
    }
  } catch (e) {
    return null;
  }
}

export async function getRecentFiles() {
  try {
    const database = await getDb();
    return await database
      .select()
      .from(recentFiles)
      .orderBy(desc(recentFiles.lastOpened));
  } catch (e) {
    return [];
  }
}

export async function deleteRecentFile(id: string, filePath: string) {
  try {
    const database = await getDb();
    await database.delete(recentFiles).where(eq(recentFiles.id, id));
    await saveDb(true);
    if (window.electronAPI)
      await window.electronAPI.deleteLibraryFile(filePath);
  } catch (e) {}
}

export async function clearRecentFiles() {
  try {
    const database = await getDb();
    await database.delete(recentFiles);
    await saveDb(true);
    if (window.electronAPI) await window.electronAPI.clearLibraryFolder();
  } catch (e) {}
}

export async function markFileCompleted(filePath: string) {
  try {
    const database = await getDb();
    await database
      .update(recentFiles)
      .set({ completed: 1 })
      .where(eq(recentFiles.filePath, filePath));
    await saveDb(true);
  } catch (e) {}
}
