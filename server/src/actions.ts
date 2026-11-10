// Actions for the Deadline Dashboard.
//
// Data contract: every deadline row carries its own status (confirmed /
// unconfirmed / group_dependent / date_tba) and a source label naming
// where the date was seen. Rows are seeded once from the sample data
// below (replace it with your own) and afterwards only changed by
// applyRefresh, which a re-check task calls — never rewritten from code
// on read.

import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { asc, eq } from "drizzle-orm";
import * as schema from "./schema";

const deadlineShape = z.object({
  id: z.number(),
  itemKey: z.string(),
  courseCode: z.string(),
  courseName: z.string(),
  title: z.string(),
  kind: z.string(),
  dueLocal: z.string(),
  dueEndLocal: z.string().nullable(),
  status: z.string(),
  details: z.string(),
  sourceLabel: z.string(),
  section: z.string(),
  done: z.boolean(),
});

const dashboardResponse = z.object({
  deadlines: z.array(deadlineShape),
  lastCheckedAt: z.string().nullable(),
});

type DeadlineRow = typeof schema.deadlines.$inferSelect;

/** Overdue items are never shown: a dated row is overdue once its end
 *  time (or start, when no end is stored) has passed. Watch rows carry
 *  no exact date, but when an item was announced with a window, the
 *  window's end is stored in dueEndLocal and the row is overdue once
 *  that window has fully passed; a windowless TBA row (dueEndLocal
 *  null) is never overdue. dueLocal strings are wall-clock in the
 *  TIMEZONE below — set it to your own timezone offset. */
function isOverdueRow(row: DeadlineRow, now: Date): boolean {
  // Routine rows (imported class timetable) are never overdue: the
  // calendar month view shows past sessions when browsing back, and a
  // re-check must never delete them.
  if (row.section === "routine") return false;
  if (row.section === "watch") {
    if (!row.dueEndLocal) return false;
    return new Date(`${row.dueEndLocal}:00+08:00`).getTime() <= now.getTime();
  }
  const raw = row.dueEndLocal ?? row.dueLocal;
  return new Date(`${raw}:00+08:00`).getTime() <= now.getTime();
}

function toShape(row: DeadlineRow): z.infer<typeof deadlineShape> {
  return {
    id: row.id,
    itemKey: row.itemKey,
    courseCode: row.courseCode,
    courseName: row.courseName,
    title: row.title,
    kind: row.kind,
    dueLocal: row.dueLocal,
    dueEndLocal: row.dueEndLocal ?? null,
    status: row.status,
    details: row.details,
    sourceLabel: row.sourceLabel,
    section: row.section,
    done: row.done === 1,
  };
}

// SAMPLE seed data — replace these rows with your own deadlines.
// Statuses: "confirmed" for exact dated items, "date_tba" (section
// "watch") for announced items with no exact date yet; date_tba rows
// carry only an announced window, never an invented exact date.
const SAMPLE_SEED_ROWS: Array<{
  itemKey: string;
  courseCode: string;
  courseName: string;
  title: string;
  kind: string;
  dueLocal: string;
  dueEndLocal?: string;
  status: string;
  details: string;
  sourceLabel: string;
  section: string;
}> = [
  {
    itemKey: "sample-cs-assignment",
    courseCode: "CS101",
    courseName: "Introduction to Computer Science",
    title: "Assignment 1",
    kind: "assignment",
    dueLocal: "2027-01-15T23:59",
    status: "confirmed",
    details: "Sample row — edit SAMPLE_SEED_ROWS in server/src/actions.ts.",
    sourceLabel: "Sample data",
    section: "upcoming",
  },
  {
    itemKey: "sample-math-test",
    courseCode: "MATH201",
    courseName: "Calculus II",
    title: "Test 1",
    kind: "test",
    dueLocal: "2027-01-20T09:00",
    dueEndLocal: "2027-01-20T10:00",
    status: "confirmed",
    details: "Sample row — 60 minutes, in person.",
    sourceLabel: "Sample data",
    section: "upcoming",
  },
  {
    itemKey: "sample-phys-lab",
    courseCode: "PHYS110",
    courseName: "Physics I",
    title: "Lab Report 2",
    kind: "lab",
    dueLocal: "2027-01-22T17:00",
    status: "confirmed",
    details: "Sample row — submit the report with the signed lab sheet.",
    sourceLabel: "Sample data",
    section: "upcoming",
  },
  {
    itemKey: "sample-eng-exam-tba",
    courseCode: "ENG105",
    courseName: "Academic Writing",
    title: "Final Exam",
    kind: "exam",
    dueLocal: "2027-03-01T00:00",
    status: "date_tba",
    details: "Announced in the course outline; exact date not published yet (sample).",
    sourceLabel: "Sample data",
    section: "watch",
  },
];

// SAMPLE class routine rows (section "routine"): calendar-only items
// shown as the blue "class" dots, never in the deadlines list. Replace
// with your own timetable (for example parsed from an .ics export).
const SAMPLE_ROUTINE_ROWS: typeof SAMPLE_SEED_ROWS = [
  { itemKey: "routine-sample-cs-lec", courseCode: "CS101", courseName: "Introduction to Computer Science", title: "Introduction to Computer Science — Lecture", kind: "class", dueLocal: "2027-01-11T09:00", dueEndLocal: "2027-01-11T11:00", status: "confirmed", details: "Room: LT-1 (sample)", sourceLabel: "Sample data", section: "routine" },
  { itemKey: "routine-sample-math-tut", courseCode: "MATH201", courseName: "Calculus II", title: "Calculus II — Tutorial", kind: "class", dueLocal: "2027-01-12T14:00", dueEndLocal: "2027-01-12T15:00", status: "confirmed", details: "Room: T-2 (sample)", sourceLabel: "Sample data", section: "routine" },
  { itemKey: "routine-sample-phys-lab", courseCode: "PHYS110", courseName: "Physics I", title: "Physics I — Lab", kind: "class", dueLocal: "2027-01-13T10:00", dueEndLocal: "2027-01-13T12:00", status: "confirmed", details: "Room: Lab 3 (sample)", sourceLabel: "Sample data", section: "routine" },
  { itemKey: "routine-sample-holiday", courseCode: "Holiday", courseName: "Public holiday", title: "Sample Public Holiday", kind: "holiday", dueLocal: "2027-01-01T00:00", dueEndLocal: "2027-01-01T23:59", status: "confirmed", details: "All day — no classes.", sourceLabel: "Sample data", section: "routine" },
];

const refreshResponse = z.object({
  ok: z.boolean(),
  taskId: z.string().nullable(),
  error: z.string().nullable(),
});

const applyRow = z.object({
  itemKey: z.string().min(1),
  courseCode: z.string().min(1),
  courseName: z.string().min(1),
  title: z.string().min(1),
  kind: z.string().min(1),
  dueLocal: z.string().min(1),
  dueEndLocal: z.string().nullable().optional(),
  status: z.enum(["confirmed", "unconfirmed", "group_dependent", "date_tba"]),
  details: z.string().default(""),
  sourceLabel: z.string().default(""),
  section: z.enum(["upcoming", "needs_checking", "watch"]).default("upcoming"),
});

export const Actions = {
  getDashboard: defineAction({
    description:
      "Returns stored deadlines sorted by due date, with overdue dated items left out, plus when the data was last checked.",
    request: z.object({}),
    response: dashboardResponse,
    async handler(ctx): Promise<z.infer<typeof dashboardResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.deadlines)
        .orderBy(asc(schema.deadlines.dueLocal));
      const metaRows = await db
        .select()
        .from(schema.meta)
        .where(eq(schema.meta.key, "lastCheckedAt"))
        .limit(1);
      const now = new Date();
      return {
        deadlines: rows.filter((row) => !isOverdueRow(row, now)).map(toShape),
        lastCheckedAt: metaRows[0]?.value ?? null,
      };
    },
  }),

  seedInitialData: defineAction({
    description:
      "Seeds the dashboard once with the sample deadline rows; a no-op when rows exist.",
    request: z.object({}),
    response: z.object({ seeded: z.number() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select({ id: schema.deadlines.id })
        .from(schema.deadlines)
        .limit(1);
      if (existing.length > 0) return { seeded: 0 };
      const now = new Date();
      await db.insert(schema.deadlines).values(
        SAMPLE_SEED_ROWS.map((row) => ({ ...row, dueEndLocal: row.dueEndLocal ?? null, updatedAt: now })),
      );
      await db
        .insert(schema.meta)
        .values({ key: "lastCheckedAt", value: now.toISOString() })
        .onConflictDoNothing();
      ctx.invalidateQueries();
      return { seeded: SAMPLE_SEED_ROWS.length };
    },
  }),

  importRoutine: defineAction({
    description:
      "Imports the sample class routine rows (section 'routine'): calendar-only items shown as blue class dots, never in the deadlines list. Idempotent. Adapt SAMPLE_ROUTINE_ROWS to your own timetable.",
    request: z.object({}),
    response: z.object({ imported: z.number() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      for (const row of SAMPLE_ROUTINE_ROWS) {
        const values = { ...row, dueEndLocal: row.dueEndLocal ?? null, updatedAt: now };
        await db
          .insert(schema.deadlines)
          .values(values)
          .onConflictDoUpdate({
            target: schema.deadlines.itemKey,
            set: {
              courseCode: values.courseCode,
              courseName: values.courseName,
              title: values.title,
              kind: values.kind,
              dueLocal: values.dueLocal,
              dueEndLocal: values.dueEndLocal,
              status: values.status,
              details: values.details,
              sourceLabel: values.sourceLabel,
              section: values.section,
              updatedAt: now,
            },
          });
      }
      ctx.invalidateQueries();
      return { imported: SAMPLE_ROUTINE_ROWS.length };
    },
  }),

  setDeadlineDone: defineAction({
    description:
      "Marks a deadline as done (or back to not done) when the user ticks its checkbox in the calendar; the state is stored on the row so it survives reloads and re-checks.",
    request: z.object({
      itemKey: z.string().min(1),
      done: z.boolean(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.deadlines)
        .set({ done: args.done ? 1 : 0, updatedAt: new Date() })
        .where(eq(schema.deadlines.itemKey, args.itemKey));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  refreshDeadlines: defineAction({
    description:
      "Starts a background re-check of your course LMS pages and saves what it finds via applyRefresh. Customise the task message below for your own LMS and courses.",
    request: z.object({}),
    response: refreshResponse,
    async handler(ctx): Promise<z.infer<typeof refreshResponse>> {
      const message = [
        "Re-check the student's course LMS and refresh the Deadline Dashboard artifact (slug: deadline-dashboard).",
        "Check the LMS dashboard/calendar AND every course page for the courses the student is taking this semester — course pages announce assessments the dashboard misses. Customise this list in server/src/actions.ts (refreshDeadlines) with your own LMS address and courses.",
        "Report each deadline exactly as found: course code and name, title, due date and time (format YYYY-MM-DDTHH:mm), and status — 'confirmed' only when the item is plainly listed with an exact date, 'group_dependent' when the date depends on the student's group, 'unconfirmed' when an item appeared before but is no longer listed, and 'date_tba' (section 'watch') when an assessment is announced but no exact date is published yet — for those, set dueLocal to the start of the announced window and dueEndLocal to the END of the announced window (null when no window is given), and state the window or TBA plainly in details. Never invent a date, time, venue, or topic that the page does not show.",
        "Leave every item whose date/time has already passed out of the items array entirely — overdue items are never shown, and any past rows still stored are deleted on save.",
        "Class routine rows (itemKeys starting with 'routine-', section 'routine') are managed separately — never include them in the items array.",
        "Save everything by calling the artifact's applyRefresh action once with the full items array and checkedAt set to the current time.",
      ].join("\n");
      const result = await ctx.agent.spawnTask(message, {
        expectsAction: "applyRefresh",
        dedupeKey: "dashboard-refresh",
      });
      if (!result.ok) {
        return { ok: false, taskId: null, error: result.error };
      }
      return { ok: true, taskId: result.taskId, error: null };
    },
  }),

  applyRefresh: defineAction({
    description:
      "Saves the results of a re-check: upserts each deadline by its stable item key and stamps the last-checked time.",
    request: z.object({
      items: z.array(applyRow),
      checkedAt: z.string().min(1),
    }),
    response: z.object({ saved: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      let saved = 0;
      for (const item of args.items) {
        await db
          .insert(schema.deadlines)
          .values({
            itemKey: item.itemKey,
            courseCode: item.courseCode,
            courseName: item.courseName,
            title: item.title,
            kind: item.kind,
            dueLocal: item.dueLocal,
            dueEndLocal: item.dueEndLocal ?? null,
            status: item.status,
            details: item.details,
            sourceLabel: item.sourceLabel,
            section: item.section,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.deadlines.itemKey,
            // Note: `done` is deliberately NOT in this set — a re-check
            // must never untick an item the user marked done.
            set: {
              courseCode: item.courseCode,
              courseName: item.courseName,
              title: item.title,
              kind: item.kind,
              dueLocal: item.dueLocal,
              dueEndLocal: item.dueEndLocal ?? null,
              status: item.status,
              details: item.details,
              sourceLabel: item.sourceLabel,
              section: item.section,
              updatedAt: now,
            },
          });
        saved += 1;
      }
      await db
        .insert(schema.meta)
        .values({ key: "lastCheckedAt", value: args.checkedAt })
        .onConflictDoUpdate({
          target: schema.meta.key,
          set: { value: args.checkedAt },
        });
      // Throw away rows that have gone overdue — they are never shown.
      // Watch rows are kept unless their announced window
      // (stored as dueEndLocal) has fully passed.
      const stored = await db.select().from(schema.deadlines);
      for (const row of stored) {
        if (isOverdueRow(row, now)) {
          await db
            .delete(schema.deadlines)
            .where(eq(schema.deadlines.itemKey, row.itemKey));
        }
      }
      ctx.invalidateQueries();
      return { saved };
    },
  }),
} satisfies ActionsModule;
