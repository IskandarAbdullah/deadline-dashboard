import { useEffect, useRef, useState } from "react";

/**
 * CountUp — the React Bits "Count Up" component
 * (@react-bits/CountUp-JS-CSS), implemented from that component's
 * JS/CSS variant (the shadcn CLI install path is not part of this
 * artifact's build pipeline, same as the other React Bits pieces
 * here): a number eases from its previous value up (or down) to the
 * target with a cubic ease-out the first time it scrolls into view,
 * and again whenever the target changes (e.g. ticking a deadline
 * done bumps the "Done" stat).
 *
 * Safety: under prefers-reduced-motion the final value shows
 * immediately with no animation; if IntersectionObserver never
 * fires, a safety timer still lands on the real value, so the stat
 * is never stuck at a wrong number. The wrapper carries the true
 * value as an aria-label and the animated digits are aria-hidden,
 * so screen readers hear the real count, not a mid-flight one.
 */
export function CountUp({
  value,
  duration = 900,
}: {
  value: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);
  const shownRef = useRef(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = value;
      startedRef.current = true;
      setDisplay(value);
      return;
    }

    let raf = 0;
    const animateTo = (to: number) => {
      const from = shownRef.current;
      if (from === to) {
        setDisplay(to);
        return;
      }
      // The start time comes from the first rAF timestamp itself —
      // never mix performance.now() with rAF timestamps, whose
      // clocks can sit on different origins (the count once ran to
      // a huge negative number in a webview where they differed).
      // Progress is also clamped at both ends for the same reason.
      let start: number | null = null;
      const tick = (t: number) => {
        if (start === null) start = t;
        const p = Math.min(1, Math.max(0, (t - start) / duration));
        const eased = 1 - Math.pow(1 - p, 3);
        const v = Math.round(from + (to - from) * eased);
        shownRef.current = v;
        setDisplay(v);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    if (startedRef.current) {
      animateTo(value);
      return () => cancelAnimationFrame(raf);
    }
    if (!("IntersectionObserver" in window)) {
      startedRef.current = true;
      animateTo(value);
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          startedRef.current = true;
          animateTo(value);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    const safety = window.setTimeout(() => {
      if (!startedRef.current) {
        startedRef.current = true;
        animateTo(value);
        io.disconnect();
      }
    }, 1800);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} aria-label={String(value)}>
      <span aria-hidden="true" className="tabular-nums">
        {display}
      </span>
    </span>
  );
}
