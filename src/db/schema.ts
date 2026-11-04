import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  filePath: text("file_path"),
  startTime: integer("start_time").notNull(),
  endTime: integer("end_time"),
  startPage: integer("start_page").notNull(),
  endPage: integer("end_page"),
  lastPage: integer("last_page"),
  pagesRead: integer("pages_read"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const drawings = sqliteTable("drawings", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id),
  pageNumber: integer("page_number").notNull(),
  target: text("target").notNull().default("margin"),
  data: text("data").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const recentFiles = sqliteTable("recent_files", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  filePath: text("file_path").notNull(),
  lastOpened: integer("last_opened").notNull(),
  completed: integer("completed").default(0),
  projectPath: text("project_path"), // NEW
});
