import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "./schema";
import { drawings } from "./schema";
import { eq } from "drizzle-orm";

let db: any = null;
let sqliteInstance: SqlJsDatabase | null = null;

export async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
  });

  let dbData: Uint8Array | null = null;
  if (typeof window !== "undefined" && window.electronAPI) {
    dbData = await window.electronAPI.loadDb();
  }

  sqliteInstance = dbData ? new SQL.Database(dbData) : new SQL.Database();

  sqliteInstance.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      start_page INTEGER NOT NULL,
      end_page INTEGER,
      pages_read INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS drawings (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      page_number INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db = drizzle(sqliteInstance, { schema });
  await saveDb();
  return db;
}

export async function saveDb() {
  if (!sqliteInstance) return;
  if (typeof window !== "undefined" && window.electronAPI) {
    const data = sqliteInstance.export();
    await window.electronAPI.saveDb(data);
  }
}

export async function saveDrawingForPage(pageNumber: number, lines: any[]) {
  const database = await getDb();
  const existing = await database.select().from(drawings).where(eq(drawings.pageNumber, pageNumber));
  
  const dataString = JSON.stringify(lines);

  if (existing.length > 0) {
    await database.update(drawings)
      .set({ data: dataString })
      .where(eq(drawings.pageNumber, pageNumber));
  } else {
    const { v4: uuidv4 } = await import("uuid");
    await database.insert(drawings).values({
      id: uuidv4(),
      pageNumber: pageNumber,
      data: dataString,
    });
  }
  await saveDb();
}

export async function loadDrawingForPage(pageNumber: number): Promise<any[]> {
  const database = await getDb();
  const result = await database.select().from(drawings).where(eq(drawings.pageNumber, pageNumber));
  
  if (result.length > 0) {
    try {
      return JSON.parse(result[0].data);
    } catch (e) {
      return [];
    }
  }
  return [];
}

// =========================================================
// Destructive Actions
// =========================================================

export async function resetDatabase() {
  if (!sqliteInstance) return;
  
  // Drop tables
  sqliteInstance.run(`
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS drawings;
  `);

  // Recreate empty tables
  sqliteInstance.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      start_page INTEGER NOT NULL,
      end_page INTEGER,
      pages_read INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS drawings (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      page_number INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await saveDb();
}