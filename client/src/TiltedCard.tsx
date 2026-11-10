import { useEffect, useRef, type ReactNode } from "react";

/**
 * TiltedCard wrapper — the React Bits "TiltedCard" effect
 * (@react-bits/TiltedCard-JS-CSS) the user asked for, implemented from
 * that component's JS/CSS variant: the card tilts in 3D following the
 * pointer (rotateX / rotateY inside a perspective container) and
 * springs smoothly back to flat when the pointer leaves.
 *
 * Tuned for a working calendar, not a showcase card:
 * - Gentle tilt only — max ~5° on each axis, 1.01 scale — so the grid
 *   never wobbles distractingly and day cells stay easy to hit.
 * - Disabled entirely on coarse pointers (touch) and under
 *   prefers-reduced-motion: the card stays flat and taps stay precise.
 * - The wrapper never intercepts pointer events itself; every button,
 *   day cell and checkbox inside keeps working exactly as before.
 */
export function TiltedCard({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const outerEl = outerRef.current;
    const innerEl = innerRef.current;
    if (!outerEl || !innerEl) return;
    const outer: HTMLDivElement = outerEl;
    const inner: HTMLDivElement = innerEl;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    if (reduced || coarse || noHover) return;

    const MAX_TILT = 5; // degrees — deliberately gentle for a calendar
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let raf = 0;
    let running = false;

    function frame() {
      // Spring-ish easing toward the target rotation.
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;
      if (Math.abs(targetX - currentX) < 0.01) currentX = targetX;
      if (Math.abs(targetY - currentY) < 0.01) currentY = targetY;
      const settled = currentX === targetX && currentY === targetY;
      const scale = settled && targetX === 0 && targetY === 0 ? 1 : 1.01;
      inner.style.transform = `rotateX(${currentX.toFixed(3)}deg) rotateY(${currentY.toFixed(3)}deg) scale(${scale})`;
      if (!settled) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    }

    function kick() {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }

    function onMove(e: PointerEvent) {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const rect = outer.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const px = (e.clientX - rect.left) / rect.width; // 0..1
      const py = (e.clientY - rect.top) / rect.height; // 0..1
      targetY = (px - 0.5) * 2 * MAX_TILT;
      targetX = (0.5 - py) * 2 * MAX_TILT;
      if (glareRef.current) {
        glareRef.current.style.opacity = "1";
        glareRef.current.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.14), transparent 55%)`;
      }
      kick();
    }

    function onLeave() {
      targetX = 0;
      targetY = 0;
      if (glareRef.current) glareRef.current.style.opacity = "0";
      kick();
    }

    outer.addEventListener("pointermove", onMove, { passive: true });
    outer.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      outer.removeEventListener("pointermove", onMove);
      outer.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={outerRef} style={{ perspective: "1000px" }}>
      <div
        ref={innerRef}
        style={{ transformStyle: "preserve-3d", willChange: "transform" }}
        className="relative"
      >
        {children}
        <div
          ref={glareRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-[var(--radius)] opacity-0 transition-opacity duration-300"
        />
      </div>
    </div>
  );
}
