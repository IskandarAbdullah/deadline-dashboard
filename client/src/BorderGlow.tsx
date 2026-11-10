import { useEffect, useRef, type ReactNode } from "react";

/**
 * BorderGlow wrapper — the React Bits "BorderGlow" effect
 * (@react-bits/BorderGlow-JS-CSS) the user asked for, implemented from
 * that component's JS/CSS variant: a soft coloured glow traces the
 * card's border, brightest at the point nearest the pointer, and
 * fades out when the pointer leaves.
 *
 * Implementation: an absolutely-positioned ring layer sits over the
 * wrapped card. Its background is a radial gradient centred on the
 * pointer position, masked (padding-box / border-box composite) so
 * only the border ring shows — the card's interior is never tinted.
 * The gradient blends the dashboard's own accent green into its class
 * blue, at low alpha, so it reads as a rim light in both themes.
 *
 * Composed with TiltedCard: this wrapper lives INSIDE the tilt wrapper,
 * so the glow is a child of the transformed element and follows the
 * tilt exactly; it adds no transform of its own.
 *
 * - pointer-events: none on the glow layer, and the wrapper only
 *   listens (passive) — day taps, checkboxes, month navigation and
 *   the Extend button are untouched.
 * - Disabled entirely on coarse pointers (touch) and under
 *   prefers-reduced-motion: the border stays the plain theme border.
 * - Pointer position is written straight to CSS variables on the
 *   layer, so moving the pointer never re-renders React.
 */
export function BorderGlow({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrapEl = wrapRef.current;
    const glowEl = glowRef.current;
    if (!wrapEl || !glowEl) return;
    const wrap: HTMLDivElement = wrapEl;
    const glow: HTMLDivElement = glowEl;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    if (reduced || coarse || noHover) return;

    function onMove(e: PointerEvent) {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const rect = wrap.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      glow.style.setProperty("--glow-x", `${x.toFixed(1)}px`);
      glow.style.setProperty("--glow-y", `${y.toFixed(1)}px`);
      glow.style.opacity = "1";
    }

    function onLeave() {
      glow.style.opacity = "0";
    }

    wrap.addEventListener("pointermove", onMove, { passive: true });
    wrap.addEventListener("pointerleave", onLeave);
    return () => {
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      {children}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300"
        style={{
          borderRadius: "var(--radius)",
          padding: "1.5px",
          background:
            "radial-gradient(260px circle at var(--glow-x, 50%) var(--glow-y, 50%), var(--accent) 0%, var(--dot-class) 45%, transparent 75%)",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
        }}
      />
    </div>
  );
}
