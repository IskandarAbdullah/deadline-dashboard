import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const deadlines = sqliteTable("deadlines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemKey: text("item_key").notNull().unique(),
  courseCode: text("course_code").notNull(),
  courseName: text("course_name").notNull(),
  title: text("title").notNull(),
  /** test | project | poster | submission | lecture | quiz | exam | prelab */
  kind: text("kind").notNull(),
  /** Asia/Kuala_Lumpur wall-clock ISO, e.g. "2026-11-13T17:30".
   *  For date_tba rows this is only the announced window's start (or a
   *  placeholder); the UI never renders it as a real date. */
  dueLocal: text("due_local").notNull(),
  /** End of the item (or, for date_tba watch rows, the end of the
   *  announced window — once that passes, the row is thrown away). */
  dueEndLocal: text("due_end_local"),
  /** confirmed | unconfirmed | group_dependent | date_tba */
  status: text("status").notNull(),
  details: text("details").notNull().default(""),
  sourceLabel: text("source_label").notNull().default(""),
  /** upcoming | needs_checking | watch | routine (TimeEdit class
   *  timetable rows: calendar-only, never overdue, never in the
   *  deadlines list) */
  section: text("section").notNull().default("upcoming"),
  /** 1 when the user has ticked the item off as done in the calendar.
   *  User-owned state: refresh upserts must never overwrite it. */
  done: integer("done").notNull().default(0),
  /** 'ulearn' for rows the refresh maintains, 'custom' for events the
   *  user added themselves. Custom rows are user-owned: the refresh
   *  task never reports them, and applyRefresh must never rewrite
   *  them (it only upserts the keys it is handed). */
  origin: text("origin").notNull().default("ulearn"),
  /** 1 when the user has starred the item as important. User-owned
   *  state like `done`: refresh upserts must never overwrite it. */
  priority: integer("priority").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Stickers the user has stuck on calendar days. User-owned marks,
 *  keyed by calendar date ("YYYY-MM-DD", Asia/Kuala_Lumpur) rather
 *  than by deadline row, so they survive the daily ULearn refresh
 *  (which only ever rewrites `deadlines`) and can sit on any day.
 *  The tray is an infinite supply: the same stickerType can appear
 *  in many rows, and one day can hold many stickers. */
export const stickerPlacements = sqliteTable("sticker_placements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dateKey: text("date_key").notNull(),
  stickerType: text("sticker_type").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** One free-text note per calendar day, written by the user in the
 *  day-detail panel ("bring 2B pencils"). Keyed by calendar date
 *  ("YYYY-MM-DD", Asia/Kuala_Lumpur) like sticker placements, so the
 *  daily ULearn refresh — which only ever rewrites `deadlines` —
 *  can never wipe them. */
export const dayNotes = sqliteTable("day_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dateKey: text("date_key").notNull().unique(),
  text: text("text").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Small user-owned key/value store for one-off personal data that
 *  is not a list of rows — currently the user's custom photo sticker
 *  (key 'photo_sticker', a downscaled JPEG data URL). The ULearn
 *  refresh never touches this table. */
export const userData = sqliteTable("user_data", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
