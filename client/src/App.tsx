import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";
import { celebrateFrom } from "./Confetti";
import { CursorGrid } from "./CursorGrid";
import { TiltedCard } from "./TiltedCard";
import { BorderGlow } from "./BorderGlow";
import { Shredder, ShredCard } from "./Shredder";
import { BranchedMenu } from "./BranchedMenu";
import { StickerPeel } from "./StickerPeel";
import { SplitText } from "./SplitText";
import { TextType } from "./TextType";
import { ScrollReveal, ScrollRevealList } from "./ScrollReveal";
import { CountUp } from "./CountUp";
import { Magnet } from "./Magnet";
import { BlurText } from "./BlurText";
import { GlareHover } from "./GlareHover";
import { AnimatedList } from "./AnimatedList";
import {
  STICKERS,
  PHOTO_STICKER,
  StickerArt,
  stickerDef,
  stickerLabel,
} from "./Stickers";

const FIELDS = actionFields<typeof Actions>();

type Dashboard = ApiResponse<typeof api, "getDashboard">;
type Deadline = Dashboard["deadlines"][number];
type StickerPlacement = Dashboard["stickers"][number];
type DayNote = Dashboard["notes"][number];

const KL = "Asia/Kuala_Lumpur";

/** dueLocal is an Asia/Kuala_Lumpur wall-clock string like "2026-11-13T17:30". */
function dueInstant(d: Deadline, end = false): Date {
  const raw = end && d.dueEndLocal ? d.dueEndLocal : d.dueLocal;
  return new Date(`${raw}:00+08:00`);
}

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: KL,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const dayLongFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: KL,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: KL,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function timeRange(d: Deadline): string {
  const start = timeFmt.format(dueInstant(d));
  if (d.dueEndLocal) return `${start} – ${timeFmt.format(dueInstant(d, true))}`;
  return start;
}

function countdown(d: Deadline, now: Date): { text: string; hot: boolean; past: boolean } {
  const ms = dueInstant(d).getTime() - now.getTime();
  if (ms <= 0) return { text: "Passed", hot: false, past: true };
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const hot = ms <= 72 * 3600 * 1000;
  if (days >= 1) return { text: `${days}d ${hours}h left`, hot, past: false };
  if (hours >= 1) return { text: `${hours}h ${mins % 60}m left`, hot, past: false };
  return { text: `${mins}m left`, hot, past: false };
}

/** Whole calendar days between today (Asia/Kuala_Lumpur) and the
 *  item's due date: 0 = due today, 1 = tomorrow, negative = past. */
function dayDiff(d: Deadline, now: Date): number {
  const due = d.dueLocal.slice(0, 10).split("-").map(Number);
  const today = klDateKey(now).split("-").map(Number);
  const a = Date.UTC(due[0] ?? 2026, (due[1] ?? 1) - 1, due[2] ?? 1);
  const b = Date.UTC(today[0] ?? 2026, (today[1] ?? 1) - 1, today[2] ?? 1);
  return Math.round((a - b) / 86400000);
}

/** Precise remaining time for the next-up hero: "in 2d 4h 12m". */
function detailedCountdown(d: Deadline, now: Date): string {
  const ms = dueInstant(d).getTime() - now.getTime();
  if (ms <= 0) return "Due now";
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (days > 0) return `in ${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

/** Small relative-due chip shown wherever a deadline is listed:
 *  "Today" (strong red — urgent), "Tomorrow" (amber), "in 3 days",
 *  "in 2 weeks"; a done item shows a green "Done" chip instead. */
function CountdownChip({ d, now }: { d: Deadline; now: Date }) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 font-display text-[11px] font-bold tracking-wide uppercase whitespace-nowrap";
  if (d.done) {
    return <span className={`${base} bg-[var(--ok)] text-white`}>✓ Done</span>;
  }
  const diff = dayDiff(d, now);
  if (diff <= 0) {
    return <span className={`${base} bg-[var(--hot)] text-white`}>Today</span>;
  }
  if (diff === 1) {
    return (
      <span className={`${base} border border-[var(--warn)] text-[var(--warn)]`}>
        Tomorrow
      </span>
    );
  }
  const label = diff < 14 ? `in ${diff} days` : `in ${Math.floor(diff / 7)} weeks`;
  return (
    <span className={`${base} border border-[var(--border)] text-[var(--dim)]`}>
      {label}
    </span>
  );
}

/** "2026-11-20T20:00" (KL wall clock) as an ICS timestamp. */
function icsStamp(local: string): string {
  return `${local.replace(/[-:]/g, "")}00`;
}

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** An instant rendered back as a KL wall-clock string. */
function klWallString(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: KL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "00";
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}

/** Builds a VCALENDAR for the given deadlines: timed events in
 *  Asia/Kuala_Lumpur (with a VTIMEZONE so importers keep the zone),
 *  all-day events for the rare midnight/no-end placeholder rows. */
function buildIcs(items: Deadline[]): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ULearn Deadline Dashboard//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Kuala_Lumpur",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:MYT",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  for (const d of items) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${d.itemKey}@ulearn-deadline-dashboard`,
      `DTSTAMP:${stamp}`,
    );
    if (d.dueLocal.endsWith("T00:00") && !d.dueEndLocal) {
      const day = d.dueLocal.slice(0, 10).replace(/-/g, "");
      const nextDay = klWallString(
        new Date(dueInstant(d).getTime() + 86400000),
      )
        .slice(0, 10)
        .replace(/-/g, "");
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay}`);
    } else {
      const endLocal =
        d.dueEndLocal ??
        klWallString(new Date(dueInstant(d).getTime() + 3600000));
      lines.push(
        `DTSTART;TZID=Asia/Kuala_Lumpur:${icsStamp(d.dueLocal)}`,
        `DTEND;TZID=Asia/Kuala_Lumpur:${icsStamp(endLocal)}`,
      );
    }
    lines.push(`SUMMARY:${icsEscape(`${courseShortcut(d)} · ${d.title}`)}`);
    const desc = [
      d.details,
      d.sourceLabel ? `Source: ${d.sourceLabel}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ok)] px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-white uppercase">
        ✓ Confirmed
      </span>
    );
  }
  if (status === "group_dependent") {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--warn)] px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-[var(--warn)] uppercase">
        Depends on your group
      </span>
    );
  }
  if (status === "date_tba") {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--border)] px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-[var(--dim)] uppercase">
        Date not published yet
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--warn)] px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-[var(--warn)] uppercase">
      Unconfirmed
    </span>
  );
}

function DeadlineRow({ d, now }: { d: Deadline; now: Date }) {
  const cd = countdown(d, now);
  const instant = dueInstant(d);
  return (
    <li className="flex gap-4 py-4">
      <div className="w-14 shrink-0 text-center">
        <p className="font-display text-2xl leading-none font-extrabold tabular-nums">
          {new Intl.DateTimeFormat("en-GB", { timeZone: KL, day: "numeric" }).format(instant)}
        </p>
        <p className="mt-1 font-display text-[11px] font-bold tracking-wider text-[var(--dim)] uppercase">
          {new Intl.DateTimeFormat("en-GB", { timeZone: KL, weekday: "short", month: "short" }).format(instant)}
        </p>
      </div>
      <div className="min-w-0 flex-1 border-l-2 border-[var(--border)] pl-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-display text-xs font-bold tracking-wider text-[var(--dim)] uppercase">
            {d.courseCode} · {d.courseName}
          </p>
          <StatusBadge status={d.status} />
          <CountdownChip d={d} now={now} />
        </div>
        <div className="mt-1 flex items-start gap-2.5">
          <DoneCheckbox d={d} />
          <PriorityStar d={d} />
          <h3
            className={`font-display text-lg leading-snug font-bold ${d.done ? "text-[var(--dim)] line-through" : ""}`}
          >
            {d.title}
          </h3>
        </div>
        <p className="mt-0.5 text-sm text-[var(--dim)]">
          {dayFmt.format(instant)} · {timeRange(d)}
          <span
            className={`ml-2 font-display font-bold tabular-nums ${cd.hot ? "text-[var(--hot)]" : cd.past ? "text-[var(--dim)]" : "text-[var(--text)]"}`}
          >
            {cd.text}
          </span>
        </p>
        {d.details ? <p className="mt-1.5 text-sm leading-relaxed">{d.details}</p> : null}
        {d.sourceLabel ? (
          <p className="mt-1 text-xs text-[var(--dim)]">Source: {d.sourceLabel}</p>
        ) : null}
      </div>
    </li>
  );
}

/** One "Coming up" deadline as a Shredder card. Keeps the full info
 *  the list row carried — shortcut + title, date and time, countdown,
 *  details and source — and the same stored done-checkbox: ticking it
 *  stops propagation in DoneCheckbox (and Shredder ignores clicks on
 *  interactive elements), so a tick never triggers a shred. */
function ComingUpCard({ d, now }: { d: Deadline; now: Date }) {
  const cd = countdown(d, now);
  const instant = dueInstant(d);
  const shortcut = courseShortcut(d);
  return (
    <ShredCard highlight={d.priority}>
      <div className="flex items-start gap-4">
        <div className="w-14 shrink-0 text-center">
          <p className="font-display text-3xl leading-none font-extrabold tabular-nums">
            {new Intl.DateTimeFormat("en-GB", { timeZone: KL, day: "numeric" }).format(instant)}
          </p>
          <p className="mt-1 font-display text-[11px] font-bold tracking-wider text-[var(--dim)] uppercase">
            {new Intl.DateTimeFormat("en-GB", { timeZone: KL, weekday: "short", month: "short" }).format(instant)}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-display text-xs font-bold tracking-wider text-[var(--dim)] uppercase">
              {shortcut} · {d.courseName}
            </p>
            <StatusBadge status={d.status} />
            <CountdownChip d={d} now={now} />
            {d.origin === "custom" ? (
              <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-white uppercase">
                Added by you
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-start gap-2.5">
            <span
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex"
            >
              <DoneCheckbox d={d} />
            </span>
            <span
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex"
            >
              <PriorityStar d={d} />
            </span>
            <h3
              className={`font-display text-lg leading-snug font-bold ${d.done ? "text-[var(--dim)] line-through" : ""}`}
            >
              {shortcut} · {d.title}
            </h3>
          </div>
          <p className="mt-1 text-sm text-[var(--dim)]">
            {dayFmt.format(instant)} · {timeRange(d)}
            <span
              className={`ml-2 font-display font-bold tabular-nums ${cd.hot ? "text-[var(--hot)]" : cd.past ? "text-[var(--dim)]" : "text-[var(--text)]"}`}
            >
              {cd.text}
            </span>
          </p>
        </div>
      </div>
      {d.details ? <p className="mt-3 text-sm leading-relaxed">{d.details}</p> : null}
      {d.sourceLabel ? (
        <p className="mt-auto pt-3 text-xs text-[var(--dim)]">Source: {d.sourceLabel}</p>
      ) : null}
    </ShredCard>
  );
}

/** The single next not-done deadline, shown as a dark hero panel
 *  directly under the calendar card. The countdown is precise
 *  ("in 2d 4h 12m") and re-renders with the page's clock tick;
 *  due-today and tomorrow items lead with TODAY / TOMORROW and
 *  their due time instead. Tapping jumps the calendar to that
 *  item's day, where its detail is already open. With nothing
 *  upcoming it shows a calm all-clear state. */
function NextUpHero({
  d,
  now,
  onJump,
}: {
  d: Deadline | null;
  now: Date;
  onJump: (key: string) => void;
}) {
  if (!d) {
    return (
      <section
        aria-label="Next deadline"
        className="mt-4 rounded-[var(--radius)] bg-[var(--panel)] px-5 py-5 text-center text-[var(--panel-text)]"
      >
        <p className="font-display text-lg font-extrabold">
          Nothing due — you&rsquo;re clear
        </p>
        <p className="mt-1 text-sm text-[var(--panel-dim)]">
          No upcoming deadlines left on the dashboard.
        </p>
      </section>
    );
  }
  const diff = dayDiff(d, now);
  const instant = dueInstant(d);
  const when =
    diff <= 0 ? "TODAY" : diff === 1 ? "TOMORROW" : detailedCountdown(d, now);
  const urgent = diff <= 0;
  return (
    <button
      type="button"
      onClick={() => onJump(d.dueLocal.slice(0, 10))}
      aria-label={`Next up: ${courseShortcut(d)}, ${d.title}, ${dayLongFmt.format(instant)}, ${timeRange(d)}. Show this day in the calendar.`}
      className="mt-4 block w-full rounded-[var(--radius)] bg-[var(--panel)] px-5 py-4 text-left text-[var(--panel-text)] transition-transform duration-150 active:scale-[0.99]"
    >
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-display text-[11px] font-bold tracking-[0.18em] text-[var(--panel-dim)] uppercase">
          Next up
        </span>
        <span
          className="font-display text-xl leading-none font-extrabold tabular-nums"
          style={{ color: urgent ? "#ff8a7a" : "#3ecf8e" }}
        >
          {when}
        </span>
        {diff <= 1 ? (
          <span className="text-sm text-[var(--panel-dim)] tabular-nums">
            due {timeRange(d)} · {detailedCountdown(d, now)}
          </span>
        ) : null}
      </span>
      <span className="mt-2 block font-display text-2xl leading-snug font-extrabold">
        {courseShortcut(d)} · {d.title}
      </span>
      <span className="mt-1 block text-sm text-[var(--panel-dim)]">
        {dayLongFmt.format(instant)} · {timeRange(d)} — tap to see it in the
        calendar
      </span>
    </button>
  );
}

/** "2026-11-13" for the given instant, in Asia/Kuala_Lumpur. */
function klDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: KL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "01";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function keyOf(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Calendar dots use three colours: red for assignments/deadlines,
 *  blue for classes (the class routine), and green for a deadline
 *  the user has ticked done — the same stored `done` state the
 *  checkbox writes, so ticking/unticking flips the dot red ↔ green
 *  everywhere at once. Routine rows (the TimeEdit class timetable)
 *  are the class-type items and never carry a done state; everything
 *  else is an assignment/deadline. */
const CLASS_KINDS = new Set(["lecture", "class"]);

function dotColor(d: Deadline): string {
  if (d.section === "routine" || CLASS_KINDS.has(d.kind))
    return "var(--dot-class)";
  if (d.done) return "var(--dot-done)";
  return "var(--dot-deadline)";
}

const DOT_LEGEND = [
  { color: "var(--dot-deadline)", label: "Assignment / deadline" },
  { color: "var(--dot-class)", label: "Class" },
  { color: "var(--dot-done)", label: "Done" },
];

/** Short labels for the calendar, as the user asked (10 Nov 2026):
 *  course codes and long names are replaced by a shortcut —
 *  EM, HSE, FIS, OOP, DE. */
function courseShortcut(d: Deadline): string {
  const code = d.courseCode.trim();
  const name = d.courseName;
  if (code === "EM" || name.includes("Mathematical Methods")) return "EM";
  if (code === "HSE101" || name.includes("Health and Safety")) return "HSE";
  if (code === "PHI101" || name.includes("Philosophy and Current Issues") || name.includes("(FIS)")) return "FIS";
  if (code === "OOP" || name.includes("Object-Oriented Programming")) return "OOP";
  if (code === "EE201" || name.includes("Digital Electronics")) return "DE";
  if (code === "Eng Maths II" || name.includes("Engineering Mathematics II")) return "EM II";
  return code;
}

/** Label shown in the calendar's day-detail list. Routine rows store
 *  titles like "Digital Electronics — Lab or Tutorial"; the long course
 *  name is dropped so the entry leads with the shortcut instead:
 *  "DE — Lab or Tutorial", "OOP — Lecture", "EM — Lecture". */
function calendarLabel(d: Deadline): string {
  if (d.kind === "holiday") return d.title;
  const shortcut = courseShortcut(d);
  if (d.section === "routine") {
    const parts = d.title.split(" — ");
    const sessionType = parts.length > 1 ? parts.slice(1).join(" — ") : d.title;
    return `${shortcut} — ${sessionType}`;
  }
  return `${shortcut} · ${d.title}`;
}

/** Dots under a calendar day number. Up to three items fit as static
 *  dots; with more than three (e.g. 23 Nov: three classes + the red
 *  Tutorial 3 deadline) a window of three slides every second,
 *  cycling through every item so the hidden dots — including the
 *  red deadline dot — come into view instead of being cut off. */
function CalendarDots({
  items,
  isSelected,
  filter,
}: {
  items: Deadline[];
  isSelected: boolean;
  /** Active course filter: dots for other courses render at low
   *  opacity (never removed) so the month's shape stays readable. */
  filter: string | null;
}) {
  const [start, setStart] = useState(0);
  const overflow = items.length > 3;

  useEffect(() => {
    if (!overflow) return;
    const t = setInterval(() => {
      setStart((s) => (s + 1) % items.length);
    }, 1000);
    return () => clearInterval(t);
  }, [overflow, items.length]);

  const dot = (d: Deadline, key: string) => (
    <span
      key={key}
      className="h-1.5 w-1.5 shrink-0 rounded-full"
      style={{
        backgroundColor: isSelected ? "var(--bg)" : dotColor(d),
        opacity: filter && courseShortcut(d) !== filter ? 0.15 : 1,
        // Important items carry a gold halo around their dot.
        boxShadow: d.priority
          ? "0 0 0 1.5px var(--surface), 0 0 0 3px #f6b73c"
          : undefined,
      }}
    />
  );

  if (!overflow) {
    return (
      <span className="mt-0.5 flex gap-0.5" aria-hidden="true">
        {items.map((d) => dot(d, String(d.id)))}
      </span>
    );
  }

  const visible = [0, 1, 2]
    .map((i) => items[(start + i) % items.length])
    .filter((d): d is Deadline => d != null);

  return (
    <span className="mt-0.5 block h-1.5 w-[22px] overflow-hidden" aria-hidden="true">
      <span key={start} className="calendar-dots-slide flex gap-0.5">
        {visible.map((d, i) => dot(d, `${d.id}-${i}`))}
      </span>
    </span>
  );
}

/** Checkbox beside an assignment/deadline so the user can tick it off.
 *  The done state lives on the stored row (setDeadlineDone), so the
 *  calendar day list and the "Coming up" stack — both views of the
 *  same row — stay in sync. Classes (routine rows) never get one. */
function DoneCheckbox({ d }: { d: Deadline }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: async (done: boolean) =>
      api.setDeadlineDone({ itemKey: d.itemKey, done }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  return (
    <input
      type="checkbox"
      checked={d.done}
      disabled={toggle.isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        // Ticking done celebrates with a confetti burst from the
        // checkbox (a green pulse under reduced motion); unticking
        // never does.
        if (e.target.checked) celebrateFrom(e.currentTarget);
        toggle.mutate(e.target.checked);
      }}
      aria-label={`Mark “${calendarLabel(d)}” as done`}
      className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ok)] transition-transform duration-150 active:scale-90"
    />
  );
}

/** Star toggle marking a deadline as important. The state lives on
 *  the stored row (setDeadlinePriority), keyed exactly like the done
 *  tick, so it survives reloads and ULearn re-checks and works for
 *  ULearn and custom items alike. Important items get a gold ring
 *  around their calendar dot, sort to the top of Coming up, and a
 *  highlighted day-detail row. */
function PriorityStar({ d }: { d: Deadline }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: async (priority: boolean) =>
      api.setDeadlinePriority({ itemKey: d.itemKey, priority }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  return (
    <button
      type="button"
      disabled={toggle.isPending}
      aria-pressed={d.priority}
      aria-label={
        d.priority
          ? `Remove the important star from “${calendarLabel(d)}”`
          : `Mark “${calendarLabel(d)}” as important`
      }
      title={d.priority ? "Important — tap to unstar" : "Mark as important"}
      onClick={(e) => {
        e.stopPropagation();
        toggle.mutate(!d.priority);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="mt-0.5 shrink-0 transition-transform duration-150 active:scale-90"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        aria-hidden="true"
        fill={d.priority ? "#f6b73c" : "none"}
        stroke={d.priority ? "#d99a17" : "var(--dim)"}
        strokeWidth="1.7"
        strokeLinejoin="round"
      >
        <path d="M12 2.6l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.7l-6 3.3 1.3-6.7-5-4.7 6.8-.8z" />
      </svg>
    </button>
  );
}

/** Slight rotations so tray stickers and stuck clusters look
 *  hand-placed rather than stamped in a grid. */
const STICKER_ROTS = [-6, 4, -3, 7, -5, 3, -7, 5, -4, 6, -3, 4, -6, 3];
const CELL_ROTS = [-8, 6, -4, 9];

type StickerDrag = {
  type: string;
  x: number;
  y: number;
  source: "tray" | "cell";
  placementId?: number;
};

/** The user's note for the selected day: one free-text note per
 *  day, stored server-side keyed by date (setDayNote/deleteDayNote),
 *  so it survives reloads and ULearn re-checks. Rendered with
 *  key={selected day} by the caller so its draft state resets when
 *  a different day is tapped. There is no "+ Add note" row any more:
 *  the day panel's round "+" menu opens this editor by bumping
 *  `openSignal`; with no note and the editor closed it renders
 *  nothing, and an existing note still shows its card (with its own
 *  Edit/Delete) under the day's items. */
function DayNoteEditor({
  dateKey,
  note,
  openSignal,
  onSave,
  onDelete,
}: {
  dateKey: string;
  note: DayNote | null;
  /** Incremented by the day panel's "+" menu ("Add note" / "Edit
   *  note") to open the editor from outside. */
  openSignal: number;
  onSave: (dateKey: string, text: string) => void;
  onDelete: (dateKey: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal === lastSignal.current) return;
    lastSignal.current = openSignal;
    setDraft(note?.text ?? "");
    setError(null);
    setConfirmingDelete(false);
    setEditing(true);
  }, [openSignal, note]);

  if (!editing) {
    if (!note) return null;
    return (
      <div className="mt-3 border-t border-[var(--border)] pt-3">
        {note ? (
          <div className="rounded-lg bg-[var(--bg)] px-3 py-2.5">
            <p className="flex items-center gap-1.5 font-display text-[11px] font-bold tracking-wider text-[var(--dim)] uppercase">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
              </svg>
              Your note
            </p>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{note.text}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                aria-label="Edit the note for this day"
                onClick={() => {
                  setDraft(note.text);
                  setError(null);
                  setEditing(true);
                }}
                className="rounded-full border border-[var(--border)] px-3 py-1 font-display text-xs font-bold"
              >
                Edit
              </button>
              {confirmingDelete ? (
                <>
                  <button
                    type="button"
                    aria-label="Confirm deleting the note for this day"
                    onClick={() => onDelete(dateKey)}
                    className="rounded-full bg-[var(--hot)] px-3 py-1 font-display text-xs font-bold text-white"
                  >
                    Delete it
                  </button>
                  <button
                    type="button"
                    aria-label="Keep the note"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-full border border-[var(--border)] px-3 py-1 font-display text-xs font-bold"
                  >
                    Keep
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  aria-label="Delete the note for this day"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-full border border-[var(--border)] px-3 py-1 font-display text-xs font-bold text-[var(--hot)]"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <label
        htmlFor={`day-note-${dateKey}`}
        className="font-display text-[11px] font-bold tracking-wider text-[var(--dim)] uppercase"
      >
        Note for this day
      </label>
      <textarea
        id={`day-note-${dateKey}`}
        {...FIELDS.setDayNote.text}
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="e.g. Bring 2B pencils · meet the group at the library"
        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
      />
      {error ? (
        <p role="alert" className="mt-1 text-xs font-bold text-[var(--hot)]">
          {error}
        </p>
      ) : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          aria-label="Save the note for this day"
          onClick={() => {
            if (!draft.trim()) {
              setError("Write something first — or Cancel to leave this day without a note.");
              return;
            }
            onSave(dateKey, draft.trim());
            setEditing(false);
          }}
          className="rounded-full bg-[var(--text)] px-3.5 py-1.5 font-display text-xs font-bold text-[var(--bg)]"
        >
          Save note
        </button>
        <button
          type="button"
          aria-label="Cancel editing the note"
          onClick={() => setEditing(false)}
          className="rounded-full border border-[var(--border)] px-3.5 py-1.5 font-display text-xs font-bold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Edit / delete controls shown only on the user's own custom
 *  events in the day detail (ULearn rows never get them — the
 *  server refuses to edit those too). Delete is two-tap. */
function CustomEventActions({
  d,
  onEdit,
  onDelete,
}: {
  d: Deadline;
  onEdit: (d: Deadline) => void;
  onDelete: (d: Deadline) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Edit your event “${d.title}”`}
        onClick={() => onEdit(d)}
        className="rounded-full border border-[var(--border)] px-2.5 py-0.5 font-display text-[11px] font-bold"
      >
        Edit
      </button>
      {confirming ? (
        <>
          <button
            type="button"
            aria-label={`Confirm deleting your event “${d.title}”`}
            onClick={() => onDelete(d)}
            className="rounded-full bg-[var(--hot)] px-2.5 py-0.5 font-display text-[11px] font-bold text-white"
          >
            Delete it
          </button>
          <button
            type="button"
            aria-label="Keep the event"
            onClick={() => setConfirming(false)}
            className="rounded-full border border-[var(--border)] px-2.5 py-0.5 font-display text-[11px] font-bold"
          >
            Keep
          </button>
        </>
      ) : (
        <button
          type="button"
          aria-label={`Delete your event “${d.title}”`}
          onClick={() => setConfirming(true)}
          className="rounded-full border border-[var(--border)] px-2.5 py-0.5 font-display text-[11px] font-bold text-[var(--hot)]"
        >
          Delete
        </button>
      )}
    </span>
  );
}

type EventCourse = "EM" | "EM II" | "HSE" | "FIS" | "OOP" | "DE" | "Personal";
const EVENT_COURSES: EventCourse[] = [
  "EM",
  "EM II",
  "HSE",
  "FIS",
  "OOP",
  "DE",
  "Personal",
];

export type EventFormValues = {
  title: string;
  dateKey: string;
  time: string | null;
  course: EventCourse;
  note: string;
};

/** Add/edit form for the user's own events, as a bottom sheet
 *  (same pattern as the sticker tray: portalled to <body> because
 *  the page sits inside TiltedCard's transform). Field limits come
 *  from the addCustomEvent request schema via FIELDS. */
function EventFormSheet({
  heading,
  initial,
  submitting,
  submitError,
  onClose,
  onSubmit,
}: {
  heading: string;
  initial: EventFormValues;
  submitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onSubmit: (values: EventFormValues) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [dateKey, setDateKey] = useState(initial.dateKey);
  const [time, setTime] = useState(initial.time ?? "");
  const [course, setCourse] = useState<EventCourse>(initial.course);
  const [note, setNote] = useState(initial.note);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shownError = error ?? submitError;

  return createPortal(
    <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true" aria-label={heading}>
      <div
        className="sticker-backdrop absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="sticker-sheet absolute right-0 bottom-0 left-0 max-h-[88vh] overflow-y-auto border-t border-[var(--border)] bg-[var(--surface)] px-4 pt-3 text-[var(--text)] shadow-[0_-12px_32px_rgba(0,0,0,0.28)]"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-extrabold">{heading}</h2>
            <button
              type="button"
              aria-label="Close the event form"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] font-display text-sm leading-none font-bold"
            >
              ✕
            </button>
          </div>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) {
                setError("Give your event a title first.");
                return;
              }
              if (!dateKey) {
                setError("Pick a date for your event.");
                return;
              }
              setError(null);
              onSubmit({
                title: title.trim(),
                dateKey,
                time: time ? time : null,
                course,
                note: note.trim(),
              });
            }}
          >
            <div>
              <label htmlFor="event-title" className="font-display text-[11px] font-bold tracking-wider text-[var(--dim)] uppercase">
                Title
              </label>
              <input
                id="event-title"
                {...FIELDS.addCustomEvent.title}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Submit Lab 3 report at the pigeon hole"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="event-date" className="font-display text-[11px] font-bold tracking-wider text-[var(--dim)] uppercase">
                  Date
                </label>
                <input
                  id="event-date"
                  type="date"
                  required
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="event-time" className="font-display text-[11px] font-bold tracking-wider text-[var(--dim)] uppercase">
                  Time (optional)
                </label>
                <input
                  id="event-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="event-course" className="font-display text-[11px] font-bold tracking-wider text-[var(--dim)] uppercase">
                Course
              </label>
              <select
                id="event-course"
                value={course}
                onChange={(e) => setCourse(e.target.value as EventCourse)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              >
                {EVENT_COURSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="event-note" className="font-display text-[11px] font-bold tracking-wider text-[var(--dim)] uppercase">
                Note (optional)
              </label>
              <textarea
                id="event-note"
                {...FIELDS.addCustomEvent.note}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything to remember about it"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              />
            </div>
            {shownError ? (
              <p role="alert" className="text-sm font-bold text-[var(--hot)]">
                {shownError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              aria-label={heading === "Add your own event" ? "Save the new event" : "Save the event changes"}
              className="w-full rounded-full bg-[var(--text)] px-4 py-2.5 font-display text-sm font-bold text-[var(--bg)] disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save event"}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Calendar({
  deadlines,
  stickers,
  notes,
  photoSticker,
  now,
  view,
  selected,
  onViewChange,
  onSelect,
  filter,
  onAddSticker,
  onRemoveSticker,
  onSaveNote,
  onDeleteNote,
  onAddEventForDay,
  onEditEvent,
  onDeleteEvent,
  onPhotoFile,
  onPhotoRemove,
}: {
  deadlines: Deadline[];
  /** Stored sticker placements (the user's own marks). They are
   *  never dimmed by the course filter and never touched by the
   *  ULearn refresh. */
  stickers: StickerPlacement[];
  /** The user's day notes (one per day), keyed by date. */
  notes: DayNote[];
  /** The user's photo sticker data URL, or null when none is set. */
  photoSticker: string | null;
  now: Date;
  /** Displayed month and selected day are owned by App so the
   *  next-up hero, the due-soon banner and the month-progress bar
   *  can drive and follow the calendar. */
  view: { y: number; m: number };
  selected: string;
  onViewChange: (v: { y: number; m: number }) => void;
  onSelect: (key: string) => void;
  filter: string | null;
  onAddSticker: (dateKey: string, stickerType: string) => void;
  onRemoveSticker: (id: number) => void;
  onSaveNote: (dateKey: string, text: string) => void;
  onDeleteNote: (dateKey: string) => void;
  onAddEventForDay: (dateKey: string) => void;
  onEditEvent: (d: Deadline) => void;
  onDeleteEvent: (d: Deadline) => void;
  onPhotoFile: (file: File) => void;
  onPhotoRemove: () => void;
}) {
  const todayKey = klDateKey(now);
  const [todayY = 2026, todayM = 11] = todayKey.split("-").map(Number);

  const byDate = new Map<string, Deadline[]>();
  for (const d of deadlines) {
    const key = d.dueLocal.slice(0, 10);
    const list = byDate.get(key);
    if (list) list.push(d);
    else byDate.set(key, [d]);
  }

  const startOffset = (new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const prevY = view.m === 1 ? view.y - 1 : view.y;
  const prevM = view.m === 1 ? 12 : view.m - 1;
  const nextY = view.m === 12 ? view.y + 1 : view.y;
  const nextM = view.m === 12 ? 1 : view.m + 1;
  const daysInPrev = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();

  type Cell = { key: string; day: number; y: number; m: number; inMonth: boolean };
  const cells: Cell[] = [];
  for (let i = startOffset; i > 0; i--) {
    const day = daysInPrev - i + 1;
    cells.push({ key: keyOf(prevY, prevM, day), day, y: prevY, m: prevM, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ key: keyOf(view.y, view.m, day), day, y: view.y, m: view.m, inMonth: true });
  }
  for (let day = 1; cells.length % 7 !== 0; day++) {
    cells.push({ key: keyOf(nextY, nextM, day), day, y: nextY, m: nextM, inMonth: false });
  }

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(view.y, view.m - 1, 1)));
  const selectedItems = byDate.get(selected) ?? [];
  const visibleItems = filter
    ? selectedItems.filter((d) => courseShortcut(d) === filter)
    : selectedItems;
  const selectedLabel = dayLongFmt.format(new Date(`${selected}T12:00:00+08:00`));

  const shiftMonth = (delta: number) => {
    const total = view.y * 12 + (view.m - 1) + delta;
    onViewChange({ y: Math.floor(total / 12), m: (total % 12) + 1 });
  };

  const pick = (cell: Cell) => {
    // Tap-to-place: with a sticker picked up from the tray, tapping
    // a day sticks it there instead of selecting the day.
    if (armed) {
      onAddSticker(cell.key, armed);
      setArmed(null);
      return;
    }
    onSelect(cell.key);
    if (!cell.inMonth) onViewChange({ y: cell.y, m: cell.m });
  };

  /* ---- Stickers: tray, drag-and-drop, tap-to-place, peel-off ----
   * Placements themselves live server-side (App owns the mutations);
   * everything here is transient interaction state. A press becomes
   * a drag after ~7px of movement; a press released before that is
   * a tap (pick up / put back in the tray, peel off on a day). */
  const [trayOpen, setTrayOpen] = useState(false);
  /** Day-panel "+" menu: one round plus button in the day-detail
   *  header opens a small menu ("Add note" / "Edit note" and "Add
   *  event") instead of the old stacked text rows. `noteEditSignal`
   *  is bumped to open the DayNoteEditor from here. */
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [noteEditSignal, setNoteEditSignal] = useState(0);
  const dayMenuRef = useRef<HTMLDivElement | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [drag, setDrag] = useState<StickerDrag | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [peeling, setPeeling] = useState<ReadonlySet<number>>(new Set());
  const dragStart = useRef<{
    x: number;
    y: number;
    type: string;
    source: "tray" | "cell";
    placementId?: number;
    active: boolean;
  } | null>(null);
  /** Set by a pointer-driven tap so the click that follows it (and
   *  keyboard clicks, which have no pointer press) stay distinct. */
  const suppressClick = useRef(false);

  const stickersByDate = new Map<string, StickerPlacement[]>();
  for (const p of stickers) {
    const list = stickersByDate.get(p.dateKey);
    if (list) list.push(p);
    else stickersByDate.set(p.dateKey, [p]);
  }

  const notesByDate = new Map<string, DayNote>();
  for (const n of notes) notesByDate.set(n.dateKey, n);

  /** The tray shows the full catalog plus the user's photo sticker
   *  (when one is set) at the end. */
  const trayStickers = photoSticker ? [...STICKERS, PHOTO_STICKER] : STICKERS;

  const dayKeyAtPoint = (x: number, y: number): string | null =>
    document
      .elementFromPoint(x, y)
      ?.closest?.("[data-day-key]")
      ?.getAttribute("data-day-key") ?? null;

  const peelOff = (id: number) => {
    setPeeling((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      onRemoveSticker(id);
      setPeeling((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 480);
  };

  const beginStickerPress = (
    e: ReactPointerEvent,
    info: { type: string; source: "tray" | "cell"; placementId?: number },
  ) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      type: info.type,
      source: info.source,
      placementId: info.placementId,
      active: false,
    };
  };

  const moveStickerPress = (e: ReactPointerEvent) => {
    const s = dragStart.current;
    if (!s) return;
    e.stopPropagation();
    if (!s.active && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 7) {
      s.active = true;
    }
    if (s.active) {
      setDrag({
        type: s.type,
        x: e.clientX,
        y: e.clientY,
        source: s.source,
        placementId: s.placementId,
      });
      setDropTarget(dayKeyAtPoint(e.clientX, e.clientY));
    }
  };

  const endStickerPress = (e: ReactPointerEvent) => {
    const s = dragStart.current;
    dragStart.current = null;
    if (!s) return;
    e.stopPropagation();
    if (s.source === "tray") suppressClick.current = true;
    if (!s.active) {
      // A tap: pick the sticker up (or put it back) in the tray —
      // picking one up closes the bottom sheet so the calendar is
      // clear for the tap that sticks it; peel a stuck sticker off
      // its day.
      if (s.source === "tray") {
        const wasArmed = armed === s.type;
        setArmed(wasArmed ? null : s.type);
        if (!wasArmed) setTrayOpen(false);
      } else if (s.placementId != null) {
        peelOff(s.placementId);
      }
      return;
    }
    setDrag(null);
    setDropTarget(null);
    const target = dayKeyAtPoint(e.clientX, e.clientY);
    if (s.source === "tray") {
      if (target) {
        onAddSticker(target, s.type);
        setArmed(null);
        setTrayOpen(false);
      }
    } else if (s.placementId != null) {
      if (!target) {
        // Dragged off the calendar entirely: peel it off.
        onRemoveSticker(s.placementId);
      } else {
        const from = stickers.find((p) => p.id === s.placementId)?.dateKey;
        if (target !== from) {
          onRemoveSticker(s.placementId);
          onAddSticker(target, s.type);
        }
      }
    }
  };

  const cancelStickerPress = () => {
    dragStart.current = null;
    setDrag(null);
    setDropTarget(null);
  };

  useEffect(() => {
    if (!armed) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setArmed(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed]);

  useEffect(() => {
    if (!trayOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setTrayOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trayOpen]);

  /* The day "+" menu closes on Escape or any press outside it. */
  useEffect(() => {
    if (!dayMenuOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setDayMenuOpen(false);
    };
    const onPress = (e: globalThis.PointerEvent) => {
      if (!dayMenuRef.current?.contains(e.target as Node)) {
        setDayMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [dayMenuOpen]);

  const navBtn =
    "flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] font-display text-lg leading-none font-bold";

  return (
    <section
      aria-label="Deadline calendar"
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-extrabold tracking-tight">{monthLabel}</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className={navBtn}>
            ‹
          </button>
          <button
            type="button"
            aria-label="Go to today"
            onClick={() => {
              onViewChange({ y: todayY, m: todayM });
              onSelect(todayKey);
            }}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 font-display text-xs font-bold"
          >
            Today
          </button>
          <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className={navBtn}>
            ›
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <p
            key={w}
            className="pb-1 text-center font-display text-[11px] font-bold tracking-wider text-[var(--dim)] uppercase"
          >
            {w}
          </p>
        ))}
        {cells.map((cell) => {
          const items = byDate.get(cell.key) ?? [];
          const cellStickers = stickersByDate.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selected;
          const isPast = cell.key < todayKey;
          const isDropTarget = dropTarget === cell.key;
          const long = dayLongFmt.format(new Date(`${cell.key}T12:00:00+08:00`));
          return (
            <div key={cell.key} className="relative" data-day-key={cell.key}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`${long}${items.length ? ` — ${items.length} item${items.length > 1 ? "s" : ""}` : ""}${cellStickers.length ? ` — ${cellStickers.length} sticker${cellStickers.length > 1 ? "s" : ""}` : ""}${notesByDate.has(cell.key) ? " — has a note" : ""}`}
                onClick={() => pick(cell)}
                className={`flex h-11 w-full flex-col items-center justify-center rounded-lg border font-display text-sm tabular-nums transition-transform duration-150 active:scale-90 ${
                  isDropTarget
                    ? "border-[var(--accent)] bg-[var(--accent)]/15 ring-2 ring-[var(--accent)]"
                    : isSelected
                      ? "border-transparent bg-[var(--text)] font-extrabold text-[var(--bg)]"
                      : isToday
                        ? "border-[var(--accent)] font-extrabold text-[var(--text)]"
                        : "border-transparent"
                } ${!cell.inMonth && !isSelected ? "text-[var(--dim)] opacity-50" : ""} ${
                  isPast && !isSelected ? "opacity-45" : ""
                }`}
              >
                <span>{cell.day}</span>
                {items.length > 0 ? (
                  <CalendarDots items={items} isSelected={isSelected} filter={filter} />
                ) : (
                  <span className="mt-0.5 h-1.5" aria-hidden="true" />
                )}
              </button>
              {notesByDate.has(cell.key) ? (
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 left-0.5 z-10 text-[var(--accent)]"
                >
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </span>
              ) : null}
              {cellStickers.length > 0 ? (
                <span className="absolute top-0 right-0 z-10 flex items-start pt-0.5 pr-0.5">
                  {cellStickers.slice(0, 4).map((p, i) => (
                    <span
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Peel the ${stickerLabel(p.stickerType)} sticker off ${long}`}
                      className="block cursor-grab active:cursor-grabbing"
                      style={{
                        transform: `rotate(${CELL_ROTS[i % CELL_ROTS.length]}deg)`,
                        marginLeft: i > 0 ? -5 : 0,
                        opacity: drag?.placementId === p.id ? 0.25 : 1,
                        touchAction: "none",
                      }}
                      onPointerDown={(e) =>
                        beginStickerPress(e, {
                          type: p.stickerType,
                          source: "cell",
                          placementId: p.id,
                        })
                      }
                      onPointerMove={moveStickerPress}
                      onPointerUp={endStickerPress}
                      onPointerCancel={cancelStickerPress}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          peelOff(p.id);
                        }
                      }}
                    >
                      <span
                        className={`pointer-events-none block ${peeling.has(p.id) ? "sticker-peeling" : ""}`}
                      >
                        <StickerArt type={p.stickerType} size={14} photoUrl={photoSticker} />
                      </span>
                    </span>
                  ))}
                  {cellStickers.length > 4 ? (
                    <span
                      aria-hidden="true"
                      className="ml-0.5 rounded-full bg-[var(--text)] px-1 font-display text-[9px] font-bold text-[var(--bg)]"
                    >
                      +{cellStickers.length - 4}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-nowrap items-center gap-x-2">
        <ul aria-label="Dot colour key" className="flex flex-nowrap items-center gap-x-2.5">
          {DOT_LEGEND.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1 whitespace-nowrap text-[11px] text-[var(--dim)]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              {entry.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          aria-expanded={trayOpen}
          aria-label="Stickers"
          onClick={() => {
            setTrayOpen((v) => !v);
            if (trayOpen) setArmed(null);
          }}
          className={`flex shrink-0 items-center justify-center rounded-full px-3 py-2 ${
            trayOpen || armed
              ? "bg-[var(--text)] text-[var(--bg)]"
              : "border border-[var(--border)]"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M12 2.6l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.7l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"
              fill="#f6b73c"
              stroke="#ffffff"
              strokeWidth="1.5"
              paintOrder="stroke"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Sticker tray as a bottom popup sheet: fixed to the bottom
          of the screen over a dimmed backdrop, so opening it never
          pushes the page around. Portalled to <body> because the
          calendar sits inside TiltedCard's 3D transform, which
          would offset a plain fixed element. The stickers live in
          one horizontally slidable row (snap + faded edges as the
          scroll hint); on wide screens it may wrap to two rows. */}
      {trayOpen
        ? createPortal(
            <div
              className={`fixed inset-0 z-[80] ${drag?.source === "tray" ? "pointer-events-none" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-label="Sticker tray"
            >
              <div
                className="sticker-backdrop absolute inset-0 bg-black/50"
                onClick={() => setTrayOpen(false)}
                aria-hidden="true"
              />
              <div
                className="sticker-sheet absolute right-0 bottom-0 left-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 pt-3 text-[var(--text)] shadow-[0_-12px_32px_rgba(0,0,0,0.28)]"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                <div className="mx-auto max-w-2xl">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-xs font-bold tracking-wider text-[var(--dim)] uppercase">
                      Sticker tray
                    </p>
                    <button
                      type="button"
                      aria-label="Close sticker tray"
                      onClick={() => {
                        setTrayOpen(false);
                        setArmed(null);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] font-display text-sm leading-none font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]" role="status">
                    {armed
                      ? `You've picked up the ${stickerLabel(armed)} sticker — tap any day to stick it there.`
                      : "Slide sideways for more stickers. Tap one to pick it up, then tap a day — or drag it straight onto a day. Tap a stuck sticker to peel it off."}
                  </p>
                  <div className="relative mt-2">
                    <div
                      className="sticker-row flex snap-x snap-mandatory items-end gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-x-visible"
                      role="group"
                      aria-label="Stickers — slide sideways for more"
                    >
                      {trayStickers.map((def, i) => (
                        <button
                          key={def.type}
                          type="button"
                          aria-pressed={armed === def.type}
                          aria-label={`Pick up the ${def.label} sticker`}
                          style={{ touchAction: "pan-x" }}
                          className={`flex shrink-0 snap-start flex-col items-center gap-1 rounded-lg p-2 ${
                            armed === def.type
                              ? "bg-[var(--bg)] ring-2 ring-[var(--accent)]"
                              : ""
                          }`}
                          onPointerDown={(e) =>
                            beginStickerPress(e, { type: def.type, source: "tray" })
                          }
                          onPointerMove={moveStickerPress}
                          onPointerUp={endStickerPress}
                          onPointerCancel={cancelStickerPress}
                          onClick={() => {
                            // Keyboard activation only — pointer taps are
                            // handled in endStickerPress and suppress this.
                            if (suppressClick.current) {
                              suppressClick.current = false;
                              return;
                            }
                            if (armed === def.type) {
                              setArmed(null);
                            } else {
                              setArmed(def.type);
                              setTrayOpen(false);
                            }
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="pointer-events-none block"
                            style={{
                              transform: `rotate(${STICKER_ROTS[i % STICKER_ROTS.length]}deg)`,
                            }}
                          >
                            <StickerArt type={def.type} size={def.text ? 26 : 38} photoUrl={photoSticker} />
                          </span>
                          <span className="font-display text-[10px] font-bold whitespace-nowrap text-[var(--dim)]">
                            {def.label}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--surface)] to-transparent sm:hidden"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[var(--surface)] to-transparent sm:hidden"
                    />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2.5">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5 font-display text-xs font-bold">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        aria-label="Upload your photo as a sticker"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) onPhotoFile(file);
                        }}
                      />
                      {photoSticker ? "Replace your photo" : "＋ Your photo"}
                    </label>
                    {photoSticker ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--dim)]">
                          <StickerArt type="photo" size={22} photoUrl={photoSticker} />
                          Your photo sticker is in the tray above.
                        </span>
                        <button
                          type="button"
                          aria-label="Remove your photo sticker"
                          onClick={onPhotoRemove}
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 font-display text-xs font-bold text-[var(--hot)]"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--dim)]">
                        One photo, kept as a round sticker you can stick anywhere.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <GlareHover className="mt-3 overflow-hidden rounded-md border-t border-[var(--border)] pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-sm font-bold">
            {selectedLabel}
            {selected === todayKey ? " · Today" : ""}
          </p>
          <div className="relative shrink-0" ref={dayMenuRef}>
            <button
              type="button"
              aria-label="Add to this day"
              aria-haspopup="menu"
              aria-expanded={dayMenuOpen}
              onClick={() => setDayMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--text)] text-[var(--bg)] transition-transform duration-150 active:scale-90"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4.5 w-4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            {dayMenuOpen ? (
              <div
                role="menu"
                aria-label="Add to this day"
                className="absolute top-full right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_28px_rgba(0,0,0,0.25)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  aria-label={
                    notesByDate.get(selected)
                      ? "Edit the note for this day"
                      : "Add a note for this day"
                  }
                  onClick={() => {
                    setDayMenuOpen(false);
                    setNoteEditSignal((s) => s + 1);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left font-display text-sm font-bold"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 text-[var(--accent)]"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                  {notesByDate.get(selected) ? "Edit note" : "Add note"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  aria-label="Add your own event on this day"
                  onClick={() => {
                    setDayMenuOpen(false);
                    onAddEventForDay(selected);
                  }}
                  className="flex w-full items-center gap-2.5 border-t border-[var(--border)] px-3.5 py-2.5 text-left font-display text-sm font-bold"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 text-[var(--accent)]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
                  </svg>
                  Add event
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {selectedItems.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">
            Nothing due this day. Tap a day with a coloured dot to see what's on.
          </p>
        ) : visibleItems.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">
            Everything this day is hidden by the {filter} filter — tap All above
            the calendar to show it.
          </p>
        ) : (
          <AnimatedList listKey={`${selected}|${filter ?? "all"}`} className="mt-2 space-y-2">
            {visibleItems.map((d) => (
              <li
                key={d.id}
                className={`flex items-start gap-2.5 ${d.priority ? "-mx-2 rounded-lg bg-[var(--glare)] px-2 py-1.5" : ""}`}
              >
                {d.section !== "routine" ? <DoneCheckbox d={d} /> : null}
                {d.section !== "routine" ? <PriorityStar d={d} /> : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className="font-display text-sm font-extrabold whitespace-nowrap tabular-nums"
                      style={{ color: dotColor(d) }}
                    >
                      {d.kind === "holiday" ? "All day" : timeRange(d)}
                    </span>
                    <span
                      className={`font-display text-sm font-bold ${d.done ? "text-[var(--dim)] line-through" : ""}`}
                    >
                      {calendarLabel(d)}
                    </span>
                    {d.section !== "routine" ? <StatusBadge status={d.status} /> : null}
                    {d.section !== "routine" ? <CountdownChip d={d} now={now} /> : null}
                    {d.origin === "custom" ? (
                      <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-white uppercase">
                        Added by you
                      </span>
                    ) : null}
                  </div>
                  {d.section === "routine" && d.details ? (
                    <p className="mt-0.5 text-xs text-[var(--dim)]">{d.details}</p>
                  ) : null}
                  {d.origin === "custom" && d.details ? (
                    <p className="mt-0.5 text-xs text-[var(--dim)]">{d.details}</p>
                  ) : null}
                  {d.origin === "custom" ? (
                    <div className="mt-1.5">
                      <CustomEventActions d={d} onEdit={onEditEvent} onDelete={onDeleteEvent} />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </AnimatedList>
        )}
        <DayNoteEditor
          key={selected}
          dateKey={selected}
          note={notesByDate.get(selected) ?? null}
          openSignal={noteEditSignal}
          onSave={onSaveNote}
          onDelete={onDeleteNote}
        />
      </GlareHover>

      {/* The sticker being dragged, following the pointer. Portalled
          to <body> because the calendar sits inside TiltedCard's 3D
          transform, which would offset a plain fixed element. */}
      {drag
        ? createPortal(
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-[90]"
              style={{
                left: drag.x,
                top: drag.y,
                transform: "translate(-50%, -62%) rotate(-6deg) scale(1.15)",
                filter: "drop-shadow(0 10px 14px rgba(15, 20, 40, 0.4))",
              }}
            >
              <StickerArt
                type={drag.type}
                size={stickerDef(drag.type).text ? 34 : 52}
                photoUrl={photoSticker}
              />
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [extended, setExtended] = useState(false);
  /** Calendar month + selected day live here so the next-up hero,
   *  the due-soon banner and the month-progress bar can drive and
   *  follow the calendar. */
  const [view, setView] = useState(() => {
    const key = klDateKey(new Date());
    const [y = 2026, m = 11] = key.split("-").map(Number);
    return { y, m };
  });
  const [selected, setSelected] = useState(() => klDateKey(new Date()));
  /** Course filter (a courseShortcut label, or null for All).
   *  Client-side only — it never touches stored rows. */
  const [filter, setFilter] = useState<string | null>(null);
  const calendarWrapRef = useRef<HTMLDivElement | null>(null);
  const comingUpRef = useRef<HTMLDivElement | null>(null);
  const myWeekRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.getDashboard({}),
    refetchInterval: 60000,
  });

  const refresh = useMutation({
    mutationFn: () => api.refreshDeadlines({}),
    onSuccess: (res) => {
      if (res.ok) {
        setRefreshNote(
          "Re-check started — ULearn is being read again (Dashboard and all six course pages). New dates appear here automatically when it finishes.",
        );
      } else {
        setRefreshNote(`The re-check could not start${res.error ? `: ${res.error}` : ""}. The dates below are from the last successful check.`);
      }
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      setRefreshNote("The re-check could not start. The dates below are from the last successful check.");
    },
  });

  /** Sticker placements: stored server-side like the done ticks.
   *  Mutations patch the cached dashboard optimistically so a
   *  sticker lands (or peels) the instant it's dropped, then
   *  reconcile with the server copy. Temp ids are negative and
   *  replaced on the refetch. */
  const tempStickerId = useRef(-1);
  const patchStickers = (fn: (s: StickerPlacement[]) => StickerPlacement[]) => {
    queryClient.setQueryData<Dashboard>(["dashboard"], (old) =>
      old ? { ...old, stickers: fn(old.stickers) } : old,
    );
  };
  const addStickerMut = useMutation({
    mutationFn: async (a: { dateKey: string; stickerType: string }) =>
      api.addSticker(a),
    onMutate: (a) => {
      const id = tempStickerId.current--;
      patchStickers((s) => [
        ...s,
        { id, dateKey: a.dateKey, stickerType: a.stickerType },
      ]);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const removeStickerMut = useMutation({
    mutationFn: async (a: { id: number }) => api.removeSticker(a),
    onMutate: (a) => {
      patchStickers((s) => s.filter((p) => p.id !== a.id));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  /** Day notes, custom events and the photo sticker: all
   *  user-owned data in their own tables/rows, following the same
   *  invalidate-on-success pattern as the done ticks. */
  const saveNoteMut = useMutation({
    mutationFn: async (a: { dateKey: string; text: string }) =>
      api.setDayNote(a),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const deleteNoteMut = useMutation({
    mutationFn: async (a: { dateKey: string }) => api.deleteDayNote(a),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const deleteEventMut = useMutation({
    mutationFn: async (a: { itemKey: string }) => api.deleteCustomEvent(a),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const photoMut = useMutation({
    mutationFn: async (a: { dataUrl: string | null }) =>
      api.setPhotoSticker(a),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  /** The add/edit event form: which mode, and (for edit) which row.
   *  Errors from the save are shown inside the sheet. */
  const [eventForm, setEventForm] = useState<
    | { mode: "add"; dateKey: string }
    | { mode: "edit"; item: Deadline }
    | null
  >(null);
  const [eventFormError, setEventFormError] = useState<string | null>(null);
  const saveEventMut = useMutation({
    mutationFn: async (a: {
      mode: "add" | "edit";
      itemKey?: string;
      values: EventFormValues;
    }) =>
      a.mode === "edit" && a.itemKey
        ? await api.updateCustomEvent({ itemKey: a.itemKey, ...a.values })
        : await api.addCustomEvent(a.values),
    onSuccess: (_res, a) => {
      setEventForm(null);
      setEventFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      jumpToDay(a.values.dateKey);
    },
    onError: (err) => {
      setEventFormError(
        err instanceof Error ? err.message : "The event could not be saved.",
      );
    },
  });

  /** Downscale a picked photo to a ~160px square JPEG data URL and
   *  save it as the user's photo sticker (centre-cropped, since the
   *  sticker renders round). */
  const handlePhotoFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      if (!side) return;
      const out = Math.min(160, side);
      const canvas = document.createElement("canvas");
      canvas.width = out;
      canvas.height = out;
      const g = canvas.getContext("2d");
      if (!g) return;
      g.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        out,
        out,
      );
      photoMut.mutate({ dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
    };
    img.src = url;
  };

  /** Search box text (filters deadlines by title/course as typed).
   *  The box itself now lives in a popup opened from the header's
   *  magnifier icon button; `searchOpen` controls that popup and
   *  closing it (✕, backdrop, Escape, or picking a result) resets
   *  the text. */
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = () => {
    setSearchOpen(false);
    setSearch("");
  };

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // closeSearch only resets state; safe to re-subscribe per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  const data = dashboard.data;
  const dated = (data?.deadlines ?? []).filter((d) => d.section !== "watch");
  const upcoming = (data?.deadlines ?? []).filter(
    (d) => d.section === "upcoming",
  );
  const needsChecking = (data?.deadlines ?? []).filter((d) => d.section === "needs_checking");

  /** Stats strip numbers (CountUp), all from the real stored rows:
   *  deadlines due in the next 7 days and not yet done, everything
   *  coming up, and how many are already ticked done. Classes
   *  (routine) and dateless watch rows never count. */
  const statRows = (data?.deadlines ?? []).filter(
    (d) => d.section !== "routine" && d.section !== "watch",
  );
  const weekAheadMs = now.getTime() + 7 * 24 * 3600 * 1000;
  const stats = [
    {
      label: "Due in next 7 days",
      value: statRows.filter(
        (d) =>
          !d.done &&
          dueInstant(d).getTime() >= now.getTime() &&
          dueInstant(d).getTime() <= weekAheadMs,
      ).length,
    },
    { label: "Coming up", value: upcoming.length },
    { label: "Done", value: statRows.filter((d) => d.done).length },
  ];

  /** Dated, user-facing deadlines (never classes, never dateless
   *  watch rows) — the pool the hero, banner and .ics export draw
   *  from. Rows arrive sorted by due date from the server. */
  const datedItems = (data?.deadlines ?? []).filter(
    (d) => d.section === "upcoming" || d.section === "needs_checking",
  );

  /** The single next not-done deadline whose slot hasn't ended. */
  const nextUp =
    datedItems
      .filter((d) => !d.done && dueInstant(d, true).getTime() > now.getTime())
      .sort((a, b) => dueInstant(a).getTime() - dueInstant(b).getTime())[0] ??
    null;

  /** Due-soon window: anything not done due before the end of
   *  tomorrow (Asia/Kuala_Lumpur) whose slot hasn't ended. */
  const startOfTodayMs = new Date(
    `${klDateKey(now)}T00:00:00+08:00`,
  ).getTime();
  const soonItems = datedItems.filter(
    (d) =>
      !d.done &&
      dueInstant(d).getTime() < startOfTodayMs + 2 * 86400000 &&
      dueInstant(d, true).getTime() > now.getTime(),
  );

  /** Course filter chips: the shortcuts actually present in the
   *  data, in the dashboard's usual course order. */
  const COURSE_ORDER = ["EM", "EM II", "HSE", "FIS", "OOP", "DE"];
  const courses = [...new Set((data?.deadlines ?? []).map(courseShortcut))]
    .filter((c) => c !== "Holiday")
    .sort((a, b) => {
      const ia = COURSE_ORDER.indexOf(a);
      const ib = COURSE_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
  const matchesFilter = (d: Deadline) =>
    !filter || courseShortcut(d) === filter;
  const upcomingFiltered = upcoming.filter(matchesFilter);
  const needsCheckingFiltered = needsChecking.filter(matchesFilter);

  /** Coming up order: starred (important) items first, then by due
   *  date — the Shredder keeps the caller's order, so the front
   *  card is the most important, then the nearest. */
  const upcomingSorted = [...upcomingFiltered].sort(
    (a, b) =>
      Number(b.priority) - Number(a.priority) ||
      dueInstant(a).getTime() - dueInstant(b).getTime(),
  );

  /** Upcoming final exams for the countdown cards: dated exam rows
   *  (never the date_tba watch placeholders, whose dueLocal is not a
   *  real date) whose slot hasn't ended. */
  const examCards = datedItems
    .filter(
      (d) =>
        d.kind === "exam" &&
        d.title.includes("Final Exam") &&
        dueInstant(d, true).getTime() > now.getTime(),
    )
    .sort((a, b) => dueInstant(a).getTime() - dueInstant(b).getTime());

  /** Search matches across everything listed (deadlines + classes,
   *  never dateless watch rows), by title or course. Upcoming
   *  matches come first (today onwards, soonest first), past ones
   *  after — otherwise old October classes bury the live results. */
  const searchQuery = search.trim().toLowerCase();
  const todaySearchKey = klDateKey(now);
  const searchResults = searchQuery
    ? (data?.deadlines ?? [])
        .filter((d) => d.section !== "watch")
        .filter((d) =>
          `${d.title} ${d.courseName} ${d.courseCode} ${courseShortcut(d)}`
            .toLowerCase()
            .includes(searchQuery),
        )
        .sort((a, b) => {
          const aPast = a.dueLocal.slice(0, 10) < todaySearchKey ? 1 : 0;
          const bPast = b.dueLocal.slice(0, 10) < todaySearchKey ? 1 : 0;
          return aPast - bPast || (a.dueLocal < b.dueLocal ? -1 : 1);
        })
        .slice(0, 8)
    : [];

  /** My Week: the real current week (Mon–Sun, Asia/Kuala_Lumpur),
   *  anchored to today no matter which month the calendar is
   *  showing. Classes come from the stored routine rows. */
  const todayKeyForWeek = klDateKey(now);
  const [wy = 2026, wm = 11, wd = 18] = todayKeyForWeek.split("-").map(Number);
  const weekMonday = new Date(Date.UTC(wy, wm - 1, wd));
  weekMonday.setUTCDate(
    weekMonday.getUTCDate() - ((weekMonday.getUTCDay() + 6) % 7),
  );
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekMonday);
    day.setUTCDate(day.getUTCDate() + i);
    const key = keyOf(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate());
    return {
      key,
      label: dayLongFmt.format(new Date(`${key}T12:00:00+08:00`)),
      items: (data?.deadlines ?? [])
        .filter(
          (d) => d.section === "routine" && d.dueLocal.slice(0, 10) === key,
        )
        .sort((a, b) => (a.dueLocal < b.dueLocal ? -1 : 1)),
    };
  });
  const weekHasClasses = weekDays.some((d) => d.items.length > 0);

  /** Month progress for the calendar's displayed month: dated
   *  deadlines only (the same pool as the stats strip). */
  const monthKey = `${view.y}-${String(view.m).padStart(2, "0")}`;
  const monthItems = statRows.filter((d) => d.dueLocal.startsWith(monthKey));
  const monthDone = monthItems.filter((d) => d.done).length;
  const monthPct = monthItems.length
    ? Math.round((monthDone / monthItems.length) * 100)
    : 0;
  const monthName = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(view.y, view.m - 1, 1)));

  /** .ics export: every currently listed not-done deadline (the
   *  course filter applies, since it defines what's listed). */
  const exportItems = datedItems.filter((d) => !d.done && matchesFilter(d));
  const downloadIcs = () => {
    const blob = new Blob([buildIcs(exportItems)], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ulearn-deadlines.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  /** Jump the calendar to a "YYYY-MM-DD" day (hero, banner and the
   *  BranchedMenu "Today" item all land here) and bring it into view. */
  const jumpToDay = (key: string) => {
    const [y = 2026, m = 11] = key.split("-").map(Number);
    setView({ y, m });
    setSelected(key);
    requestAnimationFrame(() => {
      calendarWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /** BranchedMenu "Go to → Today": jump the calendar to today and
   *  bring it into view. */
  const goToday = () => jumpToDay(klDateKey(new Date()));

  /** BranchedMenu "Go to → Coming up": reveal the sections hidden
   *  behind Extend, then scroll to them once they have rendered. */
  const goComingUp = () => {
    setExtended(true);
    setTimeout(() => {
      const target = comingUpRef.current ?? calendarWrapRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 90);
  };

  /** BranchedMenu "Go to → My week": reveal the extended sections
   *  and scroll to the My Week list. */
  const goMyWeek = () => {
    setExtended(true);
    setTimeout(() => {
      const target = myWeekRef.current ?? comingUpRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 90);
  };

  /** BranchedMenu "Add event": open the form for the selected day. */
  const openAddEvent = () => {
    setEventFormError(null);
    setEventForm({ mode: "add", dateKey: selected });
  };
  const lastChecked = data?.lastCheckedAt
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: KL,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(data.lastCheckedAt))
    : null;

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <CursorGrid />
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <BranchedMenu
        onGoToday={goToday}
        onGoComingUp={goComingUp}
        onGoMyWeek={goMyWeek}
        onAddEvent={openAddEvent}
        onCheck={() => refresh.mutate()}
        checkPending={refresh.isPending}
      />
      <main className="relative z-10 mx-auto w-full max-w-2xl px-4 pt-6 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <StickerPeel />
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight"><SplitText text="What's due" /></h1>
              <p className="mt-0.5 text-xs whitespace-nowrap text-[var(--dim)] min-[420px]:text-[13px] sm:text-sm">
                <TextType
                  text={
                    lastChecked
                      ? `ULearn last checked ${lastChecked}`
                      : "ULearn deadlines, September 2026 semester"
                  }
                />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Magnet>
              <button
                type="button"
                aria-label="Check ULearn again"
                disabled={refresh.isPending}
                onClick={() => refresh.mutate()}
                className="rounded-full bg-[var(--text)] px-4 py-2 font-display text-sm font-bold text-[var(--bg)] disabled:opacity-50"
              >
                {refresh.isPending ? "Starting…" : "Check ULearn again"}
              </button>
            </Magnet>
            <button
              type="button"
              aria-label="Search deadlines"
              aria-haspopup="dialog"
              onClick={() => setSearchOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] transition-transform duration-150 active:scale-90"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.8-3.8" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search popup: opened from the header's magnifier icon.
            A top sheet over a dimmed backdrop (portalled to <body>
            so nothing clips it), input autofocused so the keyboard
            opens on mobile. Picking a result closes the popup and
            jumps the calendar to that day; ✕, backdrop tap and
            Escape close it and reset the text. */}
        {searchOpen
          ? createPortal(
              <div
                className="fixed inset-0 z-[85]"
                role="dialog"
                aria-modal="true"
                aria-label="Search deadlines"
              >
                <div
                  className="sticker-backdrop absolute inset-0 bg-black/50"
                  onClick={closeSearch}
                  aria-hidden="true"
                />
                <div
                  className="search-pop absolute top-0 right-0 left-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 pt-4 text-[var(--text)] shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
                  style={{
                    paddingTop: "max(1rem, env(safe-area-inset-top))",
                  }}
                >
                  <div className="mx-auto max-w-2xl pb-4">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="search"
                          autoFocus
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search deadlines and classes — try “lab” or “quiz”"
                          aria-label="Search deadlines and classes by title or course"
                          className="w-full rounded-full border border-[var(--border)] bg-[var(--bg)] py-2.5 pr-11 pl-4 text-sm"
                        />
                        {search ? (
                          <button
                            type="button"
                            aria-label="Clear the search"
                            onClick={() => setSearch("")}
                            className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] font-display text-xs font-bold"
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        aria-label="Close search"
                        onClick={closeSearch}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] font-display text-sm leading-none font-bold"
                      >
                        ✕
                      </button>
                    </div>
                    {searchQuery ? (
                      searchResults.length === 0 ? (
                        <p className="mt-3 px-1 text-sm text-[var(--dim)]">
                          Nothing matches “{search.trim()}”.
                        </p>
                      ) : (
                        <ul
                          aria-label="Search results"
                          className="mt-3 max-h-[55vh] divide-y divide-[var(--border)] overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)]"
                        >
                          {searchResults.map((d) => (
                            <li key={d.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  jumpToDay(d.dueLocal.slice(0, 10));
                                  closeSearch();
                                }}
                                aria-label={`Show ${courseShortcut(d)}, ${d.title} in the calendar`}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                              >
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={`block truncate font-display text-sm font-bold ${d.done ? "text-[var(--dim)] line-through" : ""}`}
                                  >
                                    {courseShortcut(d)} · {d.title}
                                  </span>
                                  <span className="block text-xs text-[var(--dim)]">
                                    {dayFmt.format(dueInstant(d))} ·{" "}
                                    {d.kind === "holiday"
                                      ? "All day"
                                      : timeRange(d)}
                                  </span>
                                </span>
                                {d.section !== "routine" ? (
                                  <CountdownChip d={d} now={now} />
                                ) : null}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : (
                      <p className="mt-3 px-1 text-sm text-[var(--dim)]">
                        Type to search your deadlines and classes.
                      </p>
                    )}
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        {data && soonItems.length > 0 ? (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[var(--radius)] border border-[var(--hot)] bg-[var(--surface)] px-3.5 py-2.5 text-sm leading-relaxed"
          >
            <span className="font-display font-bold text-[var(--hot)]">
              ⚠ {soonItems.length} deadline{soonItems.length > 1 ? "s" : ""} due
              by end of tomorrow:
            </span>
            {soonItems.map((d, i) => (
              <span key={d.id} className="flex items-center gap-2">
                {i > 0 ? (
                  <span aria-hidden="true" className="text-[var(--dim)]">
                    ·
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => jumpToDay(d.dueLocal.slice(0, 10))}
                  aria-label={`Show ${courseShortcut(d)}, ${d.title} in the calendar`}
                  className="font-display font-bold underline decoration-[var(--hot)] decoration-2 underline-offset-2"
                >
                  {courseShortcut(d)} · {d.title} (
                  {dayFmt.format(dueInstant(d))} · {timeRange(d)})
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {refreshNote ? (
          <p role="status" className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-relaxed">
            {refreshNote}
          </p>
        ) : null}

        {dashboard.isPending ? (
          <p className="py-16 text-center text-sm text-[var(--dim)]">Loading your deadlines…</p>
        ) : dashboard.isError ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[var(--dim)]">The dashboard could not load.</p>
            <button
              type="button"
              aria-label="Retry loading deadlines"
              onClick={() => void dashboard.refetch()}
              className="mt-3 rounded-full border border-[var(--border)] px-4 py-2 font-display text-sm font-bold"
            >
              Retry
            </button>
          </div>
        ) : !data || data.deadlines.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display text-lg font-bold">Nothing upcoming</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--dim)]">
              Overdue items are hidden, and nothing else is stored yet. Run a ULearn
              check and every upcoming due date it finds will be listed here.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 scroll-mt-6" ref={calendarWrapRef}>
              <TiltedCard>
                <BorderGlow>
                  <Calendar
                    deadlines={dated}
                    stickers={data?.stickers ?? []}
                    notes={data?.notes ?? []}
                    photoSticker={data?.photoSticker ?? null}
                    now={now}
                    view={view}
                    selected={selected}
                    onViewChange={setView}
                    onSelect={setSelected}
                    filter={filter}
                    onAddSticker={(dateKey, stickerType) =>
                      addStickerMut.mutate({ dateKey, stickerType })
                    }
                    onRemoveSticker={(id) => removeStickerMut.mutate({ id })}
                    onSaveNote={(dateKey, text) =>
                      saveNoteMut.mutate({ dateKey, text })
                    }
                    onDeleteNote={(dateKey) =>
                      deleteNoteMut.mutate({ dateKey })
                    }
                    onAddEventForDay={(dateKey) => {
                      setEventFormError(null);
                      setEventForm({ mode: "add", dateKey });
                    }}
                    onEditEvent={(item) => {
                      setEventFormError(null);
                      setEventForm({ mode: "edit", item });
                    }}
                    onDeleteEvent={(item) =>
                      deleteEventMut.mutate({ itemKey: item.itemKey })
                    }
                    onPhotoFile={handlePhotoFile}
                    onPhotoRemove={() => photoMut.mutate({ dataUrl: null })}
                  />
                </BorderGlow>
              </TiltedCard>
            </div>

            <section
              aria-label="Deadline summary"
              className="mt-5 flex items-stretch gap-3"
            >
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-center"
                >
                  <p className="font-display text-2xl leading-none font-extrabold">
                    <CountUp value={s.value} />
                  </p>
                  <p className="mt-1.5 font-display text-[11px] font-bold tracking-wider text-[var(--dim)] uppercase">
                    {s.label}
                  </p>
                </div>
              ))}
            </section>

            <section
              aria-label="Month progress"
              className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-sm font-bold">
                  {monthItems.length > 0
                    ? `${monthName}: ${monthDone} of ${monthItems.length} deadline${monthItems.length > 1 ? "s" : ""} done`
                    : `${monthName}: no deadlines this month`}
                </p>
                <button
                  type="button"
                  onClick={downloadIcs}
                  disabled={exportItems.length === 0}
                  aria-label="Download an iCalendar (.ics) file of your upcoming deadlines"
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 font-display text-xs font-bold disabled:opacity-50"
                >
                  Add to calendar (.ics)
                </button>
              </div>
              <div
                className="mt-2.5 h-2 overflow-hidden rounded-full bg-[var(--border)]"
                role="progressbar"
                aria-valuenow={monthPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${monthName} deadline progress: ${monthDone} of ${monthItems.length} done`}
              >
                <div
                  className="h-full rounded-full bg-[var(--ok)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${monthPct}%` }}
                />
              </div>
            </section>

            <div
              className="mt-4 flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Filter deadlines by course"
            >
              {["All", ...courses].map((c) => {
                const active = c === "All" ? filter === null : filter === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    aria-label={
                      c === "All"
                        ? "Show deadlines for all courses"
                        : `Show only ${c} deadlines`
                    }
                    onClick={() => setFilter(c === "All" ? null : c)}
                    className={`rounded-full px-3.5 py-1.5 font-display text-xs font-bold transition-transform duration-150 active:scale-90 ${
                      active
                        ? "bg-[var(--text)] text-[var(--bg)]"
                        : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
              {filter ? (
                <span className="text-xs text-[var(--dim)]">
                  Showing {filter} only — other courses&rsquo; dots are dimmed.
                </span>
              ) : null}
            </div>

            <NextUpHero d={nextUp} now={now} onJump={jumpToDay} />

            {examCards.length > 0 ? (
              <section aria-label="Final exam countdowns" className="mt-4">
                <div className="flex flex-wrap gap-3">
                  {examCards.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => jumpToDay(d.dueLocal.slice(0, 10))}
                      aria-label={`Final exam: ${courseShortcut(d)}, ${d.title}, ${dayLongFmt.format(dueInstant(d))}, ${timeRange(d)}. Show this day in the calendar.`}
                      className="min-w-[150px] flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition-transform duration-150 active:scale-[0.99]"
                    >
                      <span className="font-display text-[11px] font-bold tracking-[0.16em] text-[var(--hot)] uppercase">
                        Final exam
                      </span>
                      <span className="mt-1 block font-display text-base leading-snug font-extrabold">
                        {courseShortcut(d)} · {d.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--dim)]">
                        {dayFmt.format(dueInstant(d))} · {timeRange(d)}
                      </span>
                      <span className="mt-1.5 block font-display text-lg leading-none font-extrabold text-[var(--accent)] tabular-nums">
                        {detailedCountdown(d, now)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <Magnet className="mt-4 block w-full">
              <button
                type="button"
                aria-expanded={extended}
                aria-label={extended ? "Hide the lists below the calendar" : "Extend to show the lists below the calendar"}
                onClick={() => setExtended((v) => !v)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-display text-sm font-bold"
              >
                {extended ? "Hide" : "Extend"}
                <span aria-hidden="true">{extended ? "▲" : "▼"}</span>
              </button>
            </Magnet>

            {extended ? (
              <div ref={comingUpRef} className="scroll-mt-6">
            <ScrollReveal>
            <h2 className="mt-8 font-display text-sm font-bold tracking-[0.14em] text-[var(--dim)] uppercase">
              <BlurText text="Coming up" />
            </h2>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--dim)]">
                Nothing coming up right now.
              </p>
            ) : upcomingFiltered.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--dim)]">
                No {filter} deadlines coming up — tap All below the calendar to
                see everything.
              </p>
            ) : (
              <div className="mt-3">
                <Shredder>
                  {upcomingSorted.map((d) => (
                    <ComingUpCard key={d.id} d={d} now={now} />
                  ))}
                </Shredder>
              </div>
            )}
            </ScrollReveal>

            {needsChecking.length > 0 ? (
              <>
                <ScrollReveal delay={60}>
                <h2 className="mt-8 font-display text-sm font-bold tracking-[0.14em] text-[var(--warn)] uppercase">
                  <BlurText text="Needs checking" />
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                  These appeared in an earlier ULearn check but have since vanished from the
                  Dashboard, so they are kept here rather than dropped.
                </p>
                </ScrollReveal>
                {needsCheckingFiltered.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--dim)]">
                    No {filter} items here — tap All below the calendar to see
                    everything.
                  </p>
                ) : (
                  <ScrollRevealList className="mt-1 divide-y divide-[var(--border)]">
                    {needsCheckingFiltered.map((d) => (
                      <DeadlineRow key={d.id} d={d} now={now} />
                    ))}
                  </ScrollRevealList>
                )}
              </>
            ) : null}

            <div ref={myWeekRef} className="scroll-mt-6">
              <ScrollReveal delay={60}>
              <h2 className="mt-8 font-display text-sm font-bold tracking-[0.14em] text-[var(--dim)] uppercase">
                <BlurText text="My week" />
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                This week (Mon–Sun) — your classes from the TimeEdit routine.
              </p>
              </ScrollReveal>
              {!weekHasClasses ? (
                <p className="mt-2 text-sm text-[var(--dim)]">
                  No classes in the routine this week.
                </p>
              ) : (
                <div className="mt-3 space-y-4">
                  {weekDays
                    .filter((day) => day.items.length > 0)
                    .map((day) => (
                      <div key={day.key}>
                        <p
                          className={`font-display text-sm font-extrabold ${day.key === todayKeyForWeek ? "text-[var(--accent)]" : ""}`}
                        >
                          {day.label}
                          {day.key === todayKeyForWeek ? " · Today" : ""}
                        </p>
                        <ul className="mt-1.5 space-y-1.5">
                          {day.items.map((d) => (
                            <li
                              key={d.id}
                              className={`rounded-lg border px-3 py-2 ${
                                day.key === todayKeyForWeek
                                  ? "border-[var(--accent)] bg-[var(--glare)]"
                                  : "border-[var(--border)] bg-[var(--surface)]"
                              }`}
                            >
                              <span className="flex flex-wrap items-baseline gap-x-2">
                                <span className="font-display text-sm font-extrabold whitespace-nowrap text-[var(--dot-class)] tabular-nums">
                                  {d.kind === "holiday" ? "All day" : timeRange(d)}
                                </span>
                                <span className="font-display text-sm font-bold">
                                  {calendarLabel(d)}
                                </span>
                              </span>
                              {d.details ? (
                                <span className="mt-0.5 block text-xs text-[var(--dim)]">
                                  {d.details}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <ScrollReveal delay={60}>
            <h2 className="mt-8 font-display text-sm font-bold tracking-[0.14em] text-[var(--dim)] uppercase">
              <BlurText text="Done history" />
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
              Total done: {data?.doneItems.length ?? 0}. Untick any item to
              move it back to your lists.
            </p>
            </ScrollReveal>
            {(data?.doneItems.length ?? 0) === 0 ? (
              <p className="mt-2 text-sm text-[var(--dim)]">
                Nothing ticked off yet — your finished deadlines will collect here.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--border)]">
                {(data?.doneItems ?? []).map((d) => (
                  <li key={d.id} className="flex items-start gap-2.5 py-3">
                    <DoneCheckbox d={d} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-bold">
                        {courseShortcut(d)} · {d.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--dim)]">
                        {dayFmt.format(dueInstant(d))} · {timeRange(d)}
                        {d.origin === "custom" ? " · Added by you" : ""}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[var(--ok)] px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-white uppercase">
                      ✓ Done
                    </span>
                  </li>
                ))}
              </ul>
            )}
              </div>
            ) : null}
          </>
        )}
      </main>

      {eventForm ? (
        <EventFormSheet
          key={eventForm.mode === "edit" ? eventForm.item.itemKey : `add-${eventForm.dateKey}`}
          heading={eventForm.mode === "edit" ? "Edit your event" : "Add your own event"}
          initial={
            eventForm.mode === "edit"
              ? {
                  title: eventForm.item.title,
                  dateKey: eventForm.item.dueLocal.slice(0, 10),
                  time:
                    eventForm.item.dueLocal.slice(11) === "23:59"
                      ? null
                      : eventForm.item.dueLocal.slice(11),
                  course: (EVENT_COURSES as string[]).includes(
                    courseShortcut(eventForm.item),
                  )
                    ? (courseShortcut(eventForm.item) as EventCourse)
                    : "Personal",
                  note: eventForm.item.details,
                }
              : {
                  title: "",
                  dateKey: eventForm.dateKey,
                  time: null,
                  course: "Personal",
                  note: "",
                }
          }
          submitting={saveEventMut.isPending}
          submitError={eventFormError}
          onClose={() => setEventForm(null)}
          onSubmit={(values) =>
            saveEventMut.mutate({
              mode: eventForm.mode,
              itemKey: eventForm.mode === "edit" ? eventForm.item.itemKey : undefined,
              values,
            })
          }
        />
      ) : null}
    </div>
  );
}
