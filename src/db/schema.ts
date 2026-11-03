import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/* =========================================================
   MARGYN — Database Schema
   ---------------------------------------------------------
   Tracks sessions and margins without exposing numbers 
   to the user interface.
========================================================= */

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  startTime: integer("start_time").notNull(),
  endTime: integer("end_time"),
  startPage: integer("start_page").notNull(),
  endPage: integer("end_page"),
  pagesRead: integer("pages_read"), // Calculated only on end
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const drawings = sqliteTable("drawings", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id),
  pageNumber: integer("page_number").notNull(),
  data: text("data").notNull(), // JSON stringified stroke data
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
