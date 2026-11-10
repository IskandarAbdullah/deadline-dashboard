import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * Shredder — the React Bits "Shredder" component
 * (@react-bits/Shredder-JS-CSS) the user asked for, implemented from
 * that component's JS/CSS variant: the front item is shown as a sheet
 * and, when it is dismissed, it is sliced into vertical strips that
 * drop and fade like paper going through a shredder, revealing the
 * next item underneath.
 *
 * Adapted for the "Coming up" deadline list (replacing CardSwap):
 * - No fixed width/height (the React Bits demo is fixed-size): the
 *   stack is a CSS grid where every card shares one cell, so the
 *   container's height is exactly the tallest card's height — no huge
 *   empty area on a phone, and no card is ever clipped.
 * - Only the front two cards peek out behind (small right/down
 *   offsets + slight scale-down); deeper cards wait hidden behind
 *   them, so 2 or 8 deadlines look the same on screen.
 * - The shred animation renders pointer-events-none, aria-hidden
 *   strip copies of the front card (each a clip-path slice of the
 *   same element); the real card is only visibility-hidden while its
 *   strips fall, so layout never jumps.
 * - Advancing ignores clicks that land on interactive elements
 *   (checkboxes, buttons, links, labels) — the caller also stops
 *   propagation on those — so ticking a deadline done never shreds.
 * - Auto-shred every `delay` ms, pausing on hover, focus, or touch
 *   interaction (pauseOnHover), and never under
 *   prefers-reduced-motion (where advancing swaps instantly, with no
 *   strip animation).
 * - Order is the caller's order (soonest-first), so the front card
 *   on load is always the nearest deadline; a shredded card cycles
 *   to the back of the stack.
 */
export function Shredder({
  children,
  cardDistance = 14,
  verticalDistance = 10,
  delay = 5200,
  pauseOnHover = true,
  stripCount = 10,
}: {
  children: ReactNode;
  cardDistance?: number;
  verticalDistance?: number;
  delay?: number;
  pauseOnHover?: boolean;
  stripCount?: number;
}) {
  const items = Children.toArray(children) as ReactElement[];
  const count = items.length;
  const keysSig = items
    .map((c, i) => String((c as { key?: string | number | null }).key ?? i))
    .join("|");

  const [order, setOrder] = useState<number[]>(() =>
    items.map((_, i) => i),
  );
  const [paused, setPaused] = useState(false);
  const [shredding, setShredding] = useState(false);
  const shredTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset to soonest-first whenever the set of cards itself changes
  // (a refresh added/removed a deadline) — not on mere re-renders
  // like a done-toggle, which keeps the same keys.
  useEffect(() => {
    if (shredTimer.current) clearTimeout(shredTimer.current);
    setShredding(false);
    setOrder(items.map((_, i) => i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSig, count]);

  useEffect(
    () => () => {
      if (shredTimer.current) clearTimeout(shredTimer.current);
    },
    [],
  );

  const cycleToBack = useCallback(() => {
    setOrder((prev) => {
      if (prev.length <= 1) return prev;
      const [first, ...rest] = prev;
      if (first === undefined) return prev;
      return [...rest, first];
    });
  }, []);

  const advance = useCallback(() => {
    if (count <= 1 || shredding) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      cycleToBack();
      return;
    }
    setShredding(true);
    // Last strip starts at (stripCount - 1) * 45ms and falls for
    // 650ms (see .shredder-strip in theme.css); swap just after.
    shredTimer.current = setTimeout(
      () => {
        cycleToBack();
        setShredding(false);
      },
      (stripCount - 1) * 45 + 700,
    );
  }, [count, shredding, stripCount, cycleToBack]);

  useEffect(() => {
    if (count <= 1 || delay <= 0 || paused || shredding) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const t = setInterval(advance, delay);
    return () => clearInterval(t);
  }, [count, delay, paused, shredding, advance]);

  if (count === 0) return null;
  if (count === 1) return <>{items[0]}</>;

  const frontOriginal = order[0] ?? 0;
  const frontChild = items[frontOriginal];
  const peek = 2; // cards visible behind the front one

  return (
    <div
      onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
      onFocusCapture={pauseOnHover ? () => setPaused(true) : undefined}
      onBlurCapture={pauseOnHover ? () => setPaused(false) : undefined}
      onTouchStart={pauseOnHover ? () => setPaused(true) : undefined}
    >
      <div
        className="grid"
        style={{
          perspective: "900px",
          paddingRight: `${cardDistance * peek}px`,
          paddingBottom: `${verticalDistance * peek}px`,
        }}
      >
        {order.map((originalIdx, position) => {
          const child = items[originalIdx];
          if (!child) return null;
          const visible = position <= peek;
          const clamped = Math.min(position, peek);
          const isFront = position === 0;
          return (
            <div
              key={originalIdx}
              aria-hidden={!isFront}
              onClick={
                isFront
                  ? (e) => {
                      const target = e.target as HTMLElement;
                      // Never shred when the click was on/for an
                      // interactive element (the done checkbox etc.).
                      if (
                        target.closest(
                          "input, button, a, label, select, textarea",
                        )
                      ) {
                        return;
                      }
                      advance();
                    }
                  : undefined
              }
              className={isFront ? "cursor-pointer" : undefined}
              style={{
                gridArea: "1 / 1",
                zIndex: count - position,
                opacity: visible ? 1 - position * 0.18 : 0,
                transform: `translate(${clamped * cardDistance}px, ${clamped * verticalDistance}px) scale(${1 - clamped * 0.03})`,
                transformOrigin: "top left",
                transition:
                  "transform 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 600ms cubic-bezier(0.22, 1, 0.36, 1)",
                pointerEvents: isFront ? "auto" : "none",
                visibility: isFront && shredding ? "hidden" : "visible",
                willChange: "transform, opacity",
              }}
            >
              {child}
            </div>
          );
        })}

        {shredding && frontChild ? (
          <div
            aria-hidden="true"
            className="pointer-events-none relative"
            style={{ gridArea: "1 / 1", zIndex: count + 1 }}
          >
            {Array.from({ length: stripCount }, (_, i) => (
              <div
                key={i}
                className="shredder-strip absolute inset-0"
                style={
                  {
                    clipPath: `inset(0 ${((stripCount - 1 - i) * 100) / stripCount}% 0 ${(i * 100) / stripCount}%)`,
                    animationDelay: `${i * 45}ms`,
                    "--shred-rot": `${i % 2 === 0 ? 2.5 : -2.5}deg`,
                    "--shred-drift": `${i % 2 === 0 ? 4 : -4}px`,
                  } as CSSProperties
                }
              >
                {frontChild}
              </div>
            ))}
            {/* The shredder slot the strips fall into. */}
            <div
              className="absolute right-0 -bottom-1 left-0 h-2 rounded-full opacity-70"
              style={{
                background:
                  "repeating-linear-gradient(90deg, var(--text) 0 6px, transparent 6px, transparent 10px)",
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-3 pr-1">
        <p className="text-xs text-[var(--dim)] tabular-nums" role="status">
          Deadline {frontOriginal + 1} of {count} · soonest first — tap the
          card to shred it to the back
        </p>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex gap-1" aria-hidden="true">
            {items.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === frontOriginal ? "16px" : "6px",
                  backgroundColor:
                    i === frontOriginal ? "var(--accent)" : "var(--border)",
                }}
              />
            ))}
          </span>
          {frontOriginal !== 0 ? (
            <button
              type="button"
              aria-label="Back to nearest deadline"
              onClick={() => setOrder(items.map((_, i) => i))}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-display text-xs font-bold"
            >
              Nearest
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Shred this deadline and show the next"
            onClick={advance}
            disabled={shredding}
            className="rounded-full bg-[var(--text)] px-3.5 py-1.5 font-display text-xs font-bold text-[var(--bg)] disabled:opacity-50"
          >
            Shred ›
          </button>
        </div>
      </div>
    </div>
  );
}

/** Presentational shell for one card inside Shredder, matching the
 *  React Bits Card look: a bordered, rounded surface that fills the
 *  stack cell so every card shares the tallest card's height. */
export function ShredCard({ children }: { children: ReactNode }) {
  return (
    <article className="flex h-full flex-col rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:p-5">
      {children}
    </article>
  );
}
