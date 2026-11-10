import {
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

/**
 * ScrollReveal — the React Bits "ScrollReveal" component
 * (@react-bits/ScrollReveal-JS-CSS) the user asked for, implemented
 * from that component's JS/CSS variant (the shadcn CLI install path
 * is not part of this artifact's build pipeline, same as the other
 * React Bits pieces here): a block starts slightly lowered, faded
 * and blurred, and as it scrolls into view it rises, sharpens and
 * fades in — once — with a gentle stagger across list children
 * where a block has several.
 *
 * Placement/UX for this dashboard:
 * - Applied ONLY below the top calendar: the "Coming up" (Shredder)
 *   block and the "Needs checking" section that Extend reveals,
 *   plus the calendar's own day-detail list. The calendar card
 *   itself is untouched — TiltedCard/BorderGlow own it.
 * - Quick and subtle so the dashboard still feels instant: ~500ms
 *   rise of 16px with a 5px blur-to-sharp, stagger step ~60ms.
 * - Safety first — content can never stay hidden:
 *   · Under prefers-reduced-motion nothing is armed at all; the
 *     content renders statically from the first paint.
 *   · If IntersectionObserver is unavailable, same — static.
 *   · Arming happens in a layout effect, before paint, so there
 *     is no flash of visible-then-hidden content.
 *   · A safety timer reveals any armed element that is on screen
 *     if the observer somehow never fires for it.
 * - Once revealed, every inline style the effect set is cleared
 *   (after the transition ends), so no lingering transform/filter
 *   containing block can interfere with the Shredder's own card
 *   transforms, the checkboxes, or anything else. The fixed
 *   bottom-left BranchedMenu button lives outside these wrappers
 *   and is never touched.
 */

const REVEAL_MS = 500;
const RISE_PX = 16;
const BLUR_PX = 5;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return false;
  return "IntersectionObserver" in window;
}

function hideEl(el: HTMLElement) {
  el.style.opacity = "0";
  el.style.transform = `translateY(${RISE_PX}px)`;
  el.style.filter = `blur(${BLUR_PX}px)`;
  el.style.willChange = "opacity, transform, filter";
}

/** Reveal one armed element; returns the cleanup-timer id so the
 *  caller can cancel it on unmount. After the transition the inline
 *  styles are removed entirely, returning the element to its natural
 *  rendering (no leftover transform or filter). */
function revealEl(el: HTMLElement, delay: number): number {
  el.dataset.scrollRevealed = "1";
  el.style.transition =
    `opacity ${REVEAL_MS}ms ${EASE} ${delay}ms, ` +
    `transform ${REVEAL_MS}ms ${EASE} ${delay}ms, ` +
    `filter ${REVEAL_MS}ms ${EASE} ${delay}ms`;
  el.style.opacity = "1";
  el.style.transform = "translateY(0px)";
  el.style.filter = "blur(0px)";
  return window.setTimeout(
    () => {
      el.style.transition = "";
      el.style.opacity = "";
      el.style.transform = "";
      el.style.filter = "";
      el.style.willChange = "";
    },
    REVEAL_MS + delay + 80,
  );
}

function inViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

/** Single-block reveal: wraps its children in a div that reveals
 *  once when it scrolls into view. */
export function ScrollReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.dataset.scrollRevealed === "1") return;
    if (!motionAllowed()) return;

    hideEl(el);
    let cleanupTimer: number | undefined;
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      cleanupTimer = revealEl(el, delay);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    // Never leave on-screen content hidden if the observer misfires.
    const safety = window.setTimeout(() => {
      if (inViewport(el)) {
        reveal();
        io.disconnect();
      }
    }, 1600);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
      if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
    };
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** List reveal: renders a <ul> whose <li> children rise in with a
 *  gentle stagger when the list scrolls into view. Children added
 *  later (e.g. tapping a different calendar day) are never armed —
 *  they show statically, as they should for an interaction. */
export function ScrollRevealList({
  children,
  className,
  step = 60,
}: {
  children: ReactNode;
  className?: string;
  step?: number;
}) {
  const ref = useRef<HTMLUListElement | null>(null);

  useLayoutEffect(() => {
    const ul = ref.current;
    if (!ul) return;
    if (!motionAllowed()) return;

    const items = Array.from(ul.children) as HTMLElement[];
    if (items.length === 0) return;
    items.forEach(hideEl);
    const timers: number[] = [];
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      items.forEach((item, i) => {
        timers.push(revealEl(item, i * step));
      });
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(ul);
    const safety = window.setTimeout(() => {
      if (inViewport(ul)) {
        reveal();
        io.disconnect();
      }
    }, 1600);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [step]);

  return (
    <ul ref={ref} className={className}>
      {children}
    </ul>
  );
}
