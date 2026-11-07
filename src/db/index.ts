import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "./schema";
import { sessions, drawings, settings, recentFiles, notes } from "./schema";
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
        CREATE TABLE IF NOT EXISTS drawings (id TEXT PRIMARY KEY, session_id TEXT, file_path TEXT, page_number INTEGER NOT NULL, target TEXT NOT NULL DEFAULT 'margin', data TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS recent_files (id TEXT PRIMARY KEY, name TEXT NOT NULL, file_path TEXT NOT NULL, last_opened INTEGER NOT NULL, completed INTEGER DEFAULT 0, project_path TEXT, last_page INTEGER DEFAULT 1, scale REAL DEFAULT 1.3, canvas_bg TEXT DEFAULT '#ffffff');
        CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, file_path TEXT NOT NULL, page_number INTEGER NOT NULL, content TEXT NOT NULL, updated_at INTEGER NOT NULL);
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
        sqliteInstance.run("SELECT file_path FROM drawings LIMIT 1");
      } catch (e) {
        sqliteInstance.run("ALTER TABLE drawings ADD COLUMN file_path TEXT");
      }
      try {
        sqliteInstance.run("SELECT completed FROM recent_files LIMIT 1");
      } catch (e) {
        sqliteInstance.run(
          "ALTER TABLE recent_files ADD COLUMN completed INTEGER DEFAULT 0",
        );
      }
      try {
        sqliteInstance.run("SELECT project_path FROM recent_files LIMIT 1");
      } catch (e) {
        sqliteInstance.run(
          "ALTER TABLE recent_files ADD COLUMN project_path TEXT",
        );
      }
      try {
        sqliteInstance.run("SELECT last_page FROM recent_files LIMIT 1");
      } catch (e) {
        sqliteInstance.run(
          "ALTER TABLE recent_files ADD COLUMN last_page INTEGER DEFAULT 1",
        );
      }
      try {
        sqliteInstance.run("SELECT scale FROM recent_files LIMIT 1");
      } catch (e) {
        sqliteInstance.run(
          "ALTER TABLE recent_files ADD COLUMN scale REAL DEFAULT 1.3",
        );
      }
      try {
        sqliteInstance.run("SELECT canvas_bg FROM recent_files LIMIT 1");
      } catch (e) {
        sqliteInstance.run(
          "ALTER TABLE recent_files ADD COLUMN canvas_bg TEXT DEFAULT '#ffffff'",
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
  filePath: string,
  pageNumber: number,
  target: "margin" | "pdf",
  lines: any[],
  retries = 3,
): Promise<boolean> {
  if (!filePath) return false;
  try {
    const database = await getDb();
    const existing = await database
      .select()
      .from(drawings)
      .where(
        and(
          eq(drawings.filePath, filePath),
          eq(drawings.pageNumber, pageNumber),
          eq(drawings.target, target),
        ),
      );
    const dataString = JSON.stringify(lines);
    if (existing.length > 0) {
      await database
        .update(drawings)
        .set({ data: dataString })
        .where(
          and(
            eq(drawings.filePath, filePath),
            eq(drawings.pageNumber, pageNumber),
            eq(drawings.target, target),
          ),
        );
    } else {
      const uniqueId =
        Date.now().toString() + Math.random().toString(36).substring(2, 9);
      await database.insert(drawings).values({
        id: uniqueId,
        filePath,
        pageNumber,
        target,
        data: dataString,
      });
    }
    await saveDb();
    return true;
  } catch (err) {
    console.error(`Save error (${retries} retries left):`, err);
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 500));
      return saveDrawing(filePath, pageNumber, target, lines, retries - 1);
    }
    return false;
  }
}

export async function loadDrawing(
  filePath: string,
  pageNumber: number,
  target: "margin" | "pdf",
): Promise<any[]> {
  if (!filePath) return [];
  try {
    const database = await getDb();
    const result = await database
      .select()
      .from(drawings)
      .where(
        and(
          eq(drawings.filePath, filePath),
          eq(drawings.pageNumber, pageNumber),
          eq(drawings.target, target),
        ),
      );

    if (result.length > 0 && result[0].data) {
      try {
        const parsed = JSON.parse(result[0].data);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return [];
      }
    }
  } catch (e) {}
  return [];
}

export async function clearPageDrawings(filePath: string, pageNumber: number) {
  if (!filePath) return;
  const database = await getDb();
  await database
    .delete(drawings)
    .where(
      and(eq(drawings.filePath, filePath), eq(drawings.pageNumber, pageNumber)),
    );
  await saveDb(true);
}

export async function clearAllDrawings(filePath: string) {
  if (!filePath) return;
  const database = await getDb();
  await database.delete(drawings).where(eq(drawings.filePath, filePath));
  await saveDb(true);
}

export async function getAllDrawings(filePath: string) {
  if (!filePath) return [];
  try {
    const database = await getDb();
    return await database
      .select()
      .from(drawings)
      .where(eq(drawings.filePath, filePath));
  } catch (e) {
    return [];
  }
}

export async function restoreDrawings(data: any[], filePath: string) {
  try {
    const database = await getDb();
    if (!data || data.length === 0 || !filePath) return;
    await database.delete(drawings).where(eq(drawings.filePath, filePath));
    const newData = data.map((d) => ({ ...d, filePath }));
    await database.insert(drawings).values(newData);
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

    // ✅ تغییر مهم: true را پاس می‌دهیم تا تنظیمات بلافاصله روی دیسک ذخیره شوند
    await saveDb(true);
  } catch (e) {}
}

export async function resetDatabase() {
  if (!sqliteInstance) return;
  sqliteInstance.run(
    `DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS drawings; DROP TABLE IF EXISTS settings; DROP TABLE IF EXISTS recent_files; DROP TABLE IF EXISTS notes;`,
  );
  sqliteInstance.run(`
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, file_path TEXT, start_time INTEGER NOT NULL, end_time INTEGER, start_page INTEGER NOT NULL, end_page INTEGER, last_page INTEGER, pages_read INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS drawings (id TEXT PRIMARY KEY, session_id TEXT, file_path TEXT, page_number INTEGER NOT NULL, target TEXT NOT NULL DEFAULT 'margin', data TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS recent_files (id TEXT PRIMARY KEY, name TEXT NOT NULL, file_path TEXT NOT NULL, last_opened INTEGER NOT NULL, completed INTEGER DEFAULT 0, project_path TEXT, last_page INTEGER DEFAULT 1, scale REAL DEFAULT 1.3, canvas_bg TEXT DEFAULT '#ffffff');
    CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, file_path TEXT NOT NULL, page_number INTEGER NOT NULL, content TEXT NOT NULL, updated_at INTEGER NOT NULL);
  `);
  await saveDb(true);
}

export async function addRecentFile(
  name: string,
  filePath: string,
  projectPath: string | null = null,
) {
  try {
    const database = await getDb();
    if (projectPath) {
      const existingProject = await database
        .select()
        .from(recentFiles)
        .where(eq(recentFiles.projectPath, projectPath));
      if (existingProject.length > 0) {
        await database
          .update(recentFiles)
          .set({
            lastOpened: Date.now(),
            name: name || existingProject[0].name,
          })
          .where(eq(recentFiles.id, existingProject[0].id));
        await saveDb();
        return existingProject[0];
      }
    }
    if (!projectPath) {
      const existingName = await database
        .select()
        .from(recentFiles)
        .where(eq(recentFiles.name, name));
      if (existingName.length > 0) {
        await database
          .update(recentFiles)
          .set({ lastOpened: Date.now(), filePath })
          .where(eq(recentFiles.id, existingName[0].id));
        await saveDb();
        return { ...existingName[0], filePath };
      }
    }
    const existing = await database
      .select()
      .from(recentFiles)
      .where(eq(recentFiles.filePath, filePath));
    if (existing.length > 0) {
      await database
        .update(recentFiles)
        .set({ lastOpened: Date.now(), name: name || existing[0].name })
        .where(eq(recentFiles.id, existing[0].id));
      await saveDb();
      return existing[0];
    } else {
      const uniqueId =
        Date.now().toString() + Math.random().toString(36).substring(2, 9);
      await database.insert(recentFiles).values({
        id: uniqueId,
        name: name || "Untitled Project",
        filePath,
        lastOpened: Date.now(),
        completed: 0,
        projectPath: projectPath,
        lastPage: 1,
        scale: 1.3,
        canvasBg: "#ffffff",
      });
      await saveDb();
      return {
        id: uniqueId,
        name: name || "Untitled Project",
        filePath,
        completed: 0,
        projectPath: projectPath,
        lastPage: 1,
        scale: 1.3,
        canvasBg: "#ffffff",
      };
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

export async function updateRecentFileProjectPath(
  filePath: string,
  projectPath: string | null,
) {
  try {
    const database = await getDb();
    await database
      .update(recentFiles)
      .set({ projectPath })
      .where(eq(recentFiles.filePath, filePath));
    await saveDb();
  } catch (e) {}
}

export async function deleteSessionById(id: string) {
  try {
    const database = await getDb();
    await database.delete(sessions).where(eq(sessions.id, id));
    await saveDb(true);
  } catch (e) {
    console.error("Failed to delete session:", e);
  }
}

export async function updateRecentFileCanvasBg(
  filePath: string,
  canvasBg: string,
) {
  try {
    const database = await getDb();
    await database
      .update(recentFiles)
      .set({ canvasBg })
      .where(eq(recentFiles.filePath, filePath));
    await saveDb();
  } catch (e) {}
}

export async function getNote(filePath: string, pageNumber: number) {
  if (!filePath) return "";
  try {
    const db = await getDb();
    const res = await db
      .select()
      .from(notes)
      .where(
        and(eq(notes.filePath, filePath), eq(notes.pageNumber, pageNumber)),
      );
    return res.length > 0 ? res[0].content : "";
  } catch (e) {
    return "";
  }
}

export async function saveNote(
  filePath: string,
  pageNumber: number,
  content: string,
) {
  if (!filePath) return;
  try {
    const db = await getDb();
    const existing = await db
      .select()
      .from(notes)
      .where(
        and(eq(notes.filePath, filePath), eq(notes.pageNumber, pageNumber)),
      );

    if (existing.length > 0) {
      await db
        .update(notes)
        .set({ content, updatedAt: Date.now() })
        .where(eq(notes.id, existing[0].id));
    } else {
      await db.insert(notes).values({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        filePath,
        pageNumber,
        content,
        updatedAt: Date.now(),
      });
    }
    await saveDb(true);
  } catch (e) {
    console.error("Failed to save note", e);
  }
}

export async function resetDocumentProgress(filePath: string) {
  if (!filePath) return false;
  try {
    const database = await getDb();
    await database.delete(sessions).where(eq(sessions.filePath, filePath));
    await database
      .update(recentFiles)
      .set({ completed: 0 })
      .where(eq(recentFiles.filePath, filePath));
    await saveDb(true);
    return true;
  } catch (e) {
    console.error("Failed to reset document progress:", e);
    return false;
  }
}
