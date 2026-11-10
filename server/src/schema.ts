import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const deadlines = sqliteTable("deadlines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemKey: text("item_key").notNull().unique(),
  courseCode: text("course_code").notNull(),
  courseName: text("course_name").notNull(),
  title: text("title").notNull(),
  /** test | project | poster | submission | lecture | quiz | exam | prelab */
  kind: text("kind").notNull(),
  /** Asia/Kuala_Lumpur wall-clock ISO, e.g. "2027-01-20T09:00".
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
  /** upcoming | needs_checking | watch | routine (imported class
   *  timetable rows: calendar-only, never overdue, never in the
   *  deadlines list) */
  section: text("section").notNull().default("upcoming"),
  /** 1 when the user has ticked the item off as done in the calendar.
   *  User-owned state: refresh upserts must never overwrite it. */
  done: integer("done").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
