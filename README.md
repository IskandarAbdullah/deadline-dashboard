# Deadline Dashboard

A personal calendar dashboard that puts **assignment deadlines and a class
routine in one month calendar**:

- **Colour dots** — red for assignments/deadlines, blue for classes,
  **green once ticked done**; days with more than 3 items cycle their dots
  every second so nothing hides, with a small legend
- **Tap any day** to see that day's classes (time + room) and deadlines
- **Short course labels** (e.g. `CS · Assignment 1`) instead of long codes —
  edit the map in `client/src/App.tsx` for your own courses
- **Done checkboxes** beside every assignment; the tick is stored
  server-side and survives reloads and data re-checks, with a confetti
  burst when you tick one off
- **Overdue items are never shown** — dated items drop off automatically
  once they pass, including announced items whose window has ended
- **Next-up hero** with a live countdown to the nearest deadline, plus
  countdown chips on every item and a due-soon alert banner
- **Exam countdown cards** for upcoming final exams
- **Coming up deck** — upcoming deadlines as a card stack (Shredder)
- **Course filter chips**, a **month progress bar**, **done history**,
  and an **Add to calendar (.ics)** export of everything not yet done
- **My Week** — this week's classes with times and rooms
- **Search** — a magnifier icon opens a search popup; tap a result to
  jump straight to that day
- **Add your own events and day notes** — the ＋ button in the day panel;
  your events and notes are stored server-side and are never touched by
  the LMS re-check
- **Priority star** — pin an important deadline: gold ring on its
  calendar dot and first place in Coming up
- **Stickers** — tap the star in the legend to open the sticker tray
  (a bottom sheet on phones): drag or tap to stick stars, flags, EXAM
  pills and more onto any day, tap a stuck sticker to peel it off, and
  even turn your own photo into a sticker. Placements are stored
  server-side
- Everything below the calendar stays hidden behind an **Extend** button

## UI effects (React Bits, JS/CSS variants)

CursorGrid background · TiltedCard + BorderGlow on the calendar ·
Shredder "Coming up" deck · BranchedMenu (bottom-left) · StickerPeel logo ·
SplitText title · TextType "last checked" line · ScrollReveal on scroll ·
CountUp stats · Magnet buttons · BlurText headings · GlareHover panels ·
AnimatedList day details. All of them switch off under
`prefers-reduced-motion`, and the pointer effects stay off on touch
devices.

## Data

The dashboard is **seeded with sample data only** — see
`SAMPLE_SEED_ROWS` and `SAMPLE_ROUTINE_ROWS` in `server/src/actions.ts`
and replace them with your own deadlines and timetable. A background
re-check of your LMS (the `refreshDeadlines` action) can refresh the
deadline rows; customise its task message with your own LMS address and
courses. Your own data — custom events, day notes, done ticks, priority
stars, sticker placements and your photo sticker — lives in separate
tables/columns the re-check never touches.
