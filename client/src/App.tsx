import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";
import { CursorGrid } from "./CursorGrid";
import { TiltedCard } from "./TiltedCard";
import { BorderGlow } from "./BorderGlow";
import { Shredder, ShredCard } from "./Shredder";
import { BranchedMenu } from "./BranchedMenu";
import { StickerPeel } from "./StickerPeel";
import { SplitText } from "./SplitText";
import { TextType } from "./TextType";
import { ScrollReveal, ScrollRevealList } from "./ScrollReveal";

type Dashboard = ApiResponse<typeof api, "getDashboard">;
type Deadline = Dashboard["deadlines"][number];

const KL = "Asia/Kuala_Lumpur"; // <-- set this to your own timezone

/** dueLocal is an Asia/Kuala_Lumpur wall-clock string like "2027-01-20T09:00". */
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
          {d.done ? (
            <span className="font-display text-[11px] font-bold tracking-wide text-[var(--ok)] uppercase">
              Done
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-start gap-2.5">
          <DoneCheckbox d={d} />
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
    <ShredCard>
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
            {d.done ? (
              <span className="font-display text-[11px] font-bold tracking-wide text-[var(--ok)] uppercase">
                Done
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

/** "2027-01-20" for the given instant, in Asia/Kuala_Lumpur. */
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

/** Calendar dots use exactly two colours: one for assignments/deadlines,
 *  a different one for classes (the class routine). Routine rows (the
 *  imported class timetable) are the class-type items; everything else
 *  is an assignment/deadline. */
const CLASS_KINDS = new Set(["lecture", "class"]);

function dotColor(d: Deadline): string {
  return d.section === "routine" || CLASS_KINDS.has(d.kind)
    ? "var(--dot-class)"
    : "var(--dot-deadline)";
}

const DOT_LEGEND = [
  { color: "var(--dot-deadline)", label: "Assignment / deadline" },
  { color: "var(--dot-class)", label: "Class" },
];

/** Short labels for the calendar: course codes and long names are
 *  replaced by a shortcut. Edit this map for your own courses. */
function courseShortcut(d: Deadline): string {
  const code = d.courseCode.trim();
  const name = d.courseName;
  if (code === "CS101" || name.includes("Computer Science")) return "CS";
  if (code === "MATH201" || name.includes("Calculus")) return "MATH";
  if (code === "PHYS110" || name.includes("Physics")) return "PHYS";
  if (code === "ENG105" || name.includes("Academic Writing")) return "ENG";
  return code;
}

/** Label shown in the calendar's day-detail list. Routine rows store
 *  titles like "Physics I — Lab"; the long course
 *  name is dropped so the entry leads with the shortcut instead:
 *  "PHYS — Lab", "CS — Lecture", "MATH — Tutorial". */
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
      onChange={(e) => toggle.mutate(e.target.checked)}
      aria-label={`Mark “${calendarLabel(d)}” as done`}
      className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ok)]"
    />
  );
}

function Calendar({
  deadlines,
  now,
  todaySignal = 0,
}: {
  deadlines: Deadline[];
  now: Date;
  /** Incremented by the BranchedMenu "Today" item to jump the
   *  calendar back to today from wherever it is being viewed. */
  todaySignal?: number;
}) {
  const todayKey = klDateKey(now);
  const [todayY = 2026, todayM = 11] = todayKey.split("-").map(Number);
  const [view, setView] = useState({ y: todayY, m: todayM });
  const [selected, setSelected] = useState(todayKey);

  useEffect(() => {
    if (todaySignal === 0) return;
    setView({ y: todayY, m: todayM });
    setSelected(todayKey);
    // Only the signal itself is the trigger; the today values are
    // read fresh at the moment it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaySignal]);

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
  const selectedLabel = dayLongFmt.format(new Date(`${selected}T12:00:00+08:00`));

  const shiftMonth = (delta: number) =>
    setView((v) => {
      const total = v.y * 12 + (v.m - 1) + delta;
      return { y: Math.floor(total / 12), m: (total % 12) + 1 };
    });

  const pick = (cell: Cell) => {
    setSelected(cell.key);
    if (!cell.inMonth) setView({ y: cell.y, m: cell.m });
  };

  const navBtn =
    "flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] font-display text-lg leading-none font-bold";

  return (
    <section
      aria-label="Deadline calendar"
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-extrabold tracking-tight">{monthLabel}</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className={navBtn}>
            ‹
          </button>
          <button
            type="button"
            aria-label="Go to today"
            onClick={() => {
              setView({ y: todayY, m: todayM });
              setSelected(todayKey);
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
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selected;
          const isPast = cell.key < todayKey;
          const long = dayLongFmt.format(new Date(`${cell.key}T12:00:00+08:00`));
          return (
            <button
              key={cell.key}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${long}${items.length ? ` — ${items.length} item${items.length > 1 ? "s" : ""}` : ""}`}
              onClick={() => pick(cell)}
              className={`flex h-11 flex-col items-center justify-center rounded-lg border font-display text-sm tabular-nums ${
                isSelected
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
                <span className="mt-0.5 flex gap-0.5" aria-hidden="true">
                  {items.slice(0, 3).map((d) => (
                    <span
                      key={d.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? "var(--bg)" : dotColor(d) }}
                    />
                  ))}
                </span>
              ) : (
                <span className="mt-0.5 h-1.5" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      <ul aria-label="Dot colour key" className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {DOT_LEGEND.map((entry) => (
          <li key={entry.label} className="flex items-center gap-1.5 text-xs text-[var(--dim)]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            {entry.label}
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <p className="font-display text-sm font-bold">
          {selectedLabel}
          {selected === todayKey ? " · Today" : ""}
        </p>
        {selectedItems.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">
            Nothing due this day. Tap a day with a coloured dot to see what's on.
          </p>
        ) : (
          <ScrollRevealList className="mt-2 space-y-2">
            {selectedItems.map((d) => (
              <li key={d.id} className="flex items-start gap-2.5">
                {d.section !== "routine" ? <DoneCheckbox d={d} /> : null}
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
                    {d.done ? (
                      <span className="font-display text-[11px] font-bold tracking-wide text-[var(--ok)] uppercase">
                        Done
                      </span>
                    ) : null}
                  </div>
                  {d.section === "routine" && d.details ? (
                    <p className="mt-0.5 text-xs text-[var(--dim)]">{d.details}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ScrollRevealList>
        )}
      </div>
    </section>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [extended, setExtended] = useState(false);
  const [todaySignal, setTodaySignal] = useState(0);
  const calendarWrapRef = useRef<HTMLDivElement | null>(null);
  const comingUpRef = useRef<HTMLDivElement | null>(null);

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
          "Re-check started — your LMS is being read again. New dates appear here automatically when it finishes.",
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

  const data = dashboard.data;
  const dated = (data?.deadlines ?? []).filter((d) => d.section !== "watch");
  const upcoming = (data?.deadlines ?? []).filter(
    (d) => d.section === "upcoming",
  );
  const needsChecking = (data?.deadlines ?? []).filter((d) => d.section === "needs_checking");

  /** BranchedMenu "Go to → Today": jump the calendar to today and
   *  bring it into view. */
  const goToday = () => {
    setTodaySignal((s) => s + 1);
    requestAnimationFrame(() => {
      calendarWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /** BranchedMenu "Go to → Coming up": reveal the sections hidden
   *  behind Extend, then scroll to them once they have rendered. */
  const goComingUp = () => {
    setExtended(true);
    setTimeout(() => {
      const target = comingUpRef.current ?? calendarWrapRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 90);
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
                      ? `Last checked ${lastChecked}`
                      : "Your classes and deadlines in one calendar"
                  }
                />
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Check again"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
            className="rounded-full bg-[var(--text)] px-4 py-2 font-display text-sm font-bold text-[var(--bg)] disabled:opacity-50"
          >
            {refresh.isPending ? "Starting…" : "Check again"}
          </button>
        </div>

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
              Overdue items are hidden, and nothing else is stored yet. Run a
              check and every upcoming due date it finds will be listed here.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 scroll-mt-6" ref={calendarWrapRef}>
              <TiltedCard>
                <BorderGlow>
                  <Calendar deadlines={dated} now={now} todaySignal={todaySignal} />
                </BorderGlow>
              </TiltedCard>
            </div>

            <button
              type="button"
              aria-expanded={extended}
              aria-label={extended ? "Hide the lists below the calendar" : "Extend to show the lists below the calendar"}
              onClick={() => setExtended((v) => !v)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-display text-sm font-bold"
            >
              {extended ? "Hide" : "Extend"}
              <span aria-hidden="true">{extended ? "▲" : "▼"}</span>
            </button>

            {extended ? (
              <div ref={comingUpRef} className="scroll-mt-6">
            <ScrollReveal>
            <h2 className="mt-8 font-display text-sm font-bold tracking-[0.14em] text-[var(--dim)] uppercase">
              Coming up
            </h2>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--dim)]">
                Nothing coming up right now.
              </p>
            ) : (
              <div className="mt-3">
                <Shredder>
                  {upcoming.map((d) => (
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
                  Needs checking
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                  These appeared in an earlier check but have since vanished from the
                  LMS, so they are kept here rather than dropped.
                </p>
                </ScrollReveal>
                <ScrollRevealList className="mt-1 divide-y divide-[var(--border)]">
                  {needsChecking.map((d) => (
                    <DeadlineRow key={d.id} d={d} now={now} />
                  ))}
                </ScrollRevealList>
              </>
            ) : null}
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
