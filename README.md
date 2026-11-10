# Deadline Dashboard

A personal calendar dashboard that puts **assignment deadlines and a class
routine in one month calendar**:

- **Two dot colours** — red for assignments/deadlines, blue for classes,
  with a small legend
- **Tap any day** to see that day's classes (time + room) and deadlines
- **Short course labels** (e.g. `CS · Assignment 1`) instead of long codes —
  edit the map in `client/src/App.tsx` for your own courses
- **Done checkboxes** beside every assignment; the tick is stored
  server-side and survives reloads and data re-checks
- **Overdue items are never shown** — dated items drop off automatically
  once they pass, including announced items whose window has ended
- **Coming up deck** — upcoming deadlines as a card stack (Shredder)
- Everything below the calendar stays hidden behind an **Extend** button

## UI effects (React Bits, JS/CSS variants)

CursorGrid background · TiltedCard + BorderGlow on the calendar ·
Shredder "Coming up" deck · BranchedMenu (bottom-left) · StickerPeel logo ·
SplitText title · TextType "last checked" line · ScrollReveal on scroll.
All of them switch off under `prefers-reduced-motion`, and the pointer
effects stay off on touch devices.

## Data

The dashboard is **seeded with sample data only** — see
`SAMPLE_SEED_ROWS` and `SAMPLE_ROUTINE_ROWS` in `server/src/actions.ts`
and replace them with your own deadlines and timetable. A background
re-check task (`refreshDeadlines`) can re-read an LMS and save fresh
rows through `applyRefresh`; customise its prompt for your own LMS and
courses.

> **Privacy note:** this repository is a cleaned template of a personal
> dashboard. It contains no real calendar, schedule, names, or accounts —
> sample data only.

## Stack & running

React 19 + TypeScript client, Bun server actions with Drizzle ORM
(SQLite), built for the Muse spaces runtime (`@hatch/space-sdk`).

```sh
bun install
bun run typecheck
bun run build
```

Times are wall-clock in one timezone: set `KL` in
`client/src/App.tsx` and the `+08:00` offsets in
`server/src/actions.ts` to your own.
