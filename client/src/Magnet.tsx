import { useRef, type ReactNode } from "react";

/**
 * Magnet — the React Bits "Magnet" component
 * (@react-bits/Magnet-JS-CSS), implemented from that component's
 * JS/CSS variant (the shadcn CLI install path is not part of this
 * artifact's build pipeline, same as the other React Bits pieces
 * here): the wrapped control is gently pulled toward the pointer
 * while it hovers nearby and springs back with a slight overshoot
 * when the pointer leaves.
 *
 * Applied to the dashboard's two primary buttons ("Check ULearn
 * again" and Extend/Hide). Safety: the pull is transform-only on
 * the wrapper — the button inside keeps its exact size, position in
 * the layout and click behaviour — and it only engages on fine
 * pointers with motion allowed; on touch/coarse pointers and under
 * prefers-reduced-motion the wrapper is a plain static box.
 */
export function Magnet({
  children,
  className = "inline-block",
  strength = 0.32,
}: {
  children: ReactNode;
  className?: string;
  /** Fraction of the pointer's offset from centre to follow. */
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const enabled = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || !enabled()) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const x = e.clientX - (rect.left + rect.width / 2);
        const y = e.clientY - (rect.top + rect.height / 2);
        el.style.transition = "transform 120ms ease-out";
        el.style.transform = `translate(${(x * strength).toFixed(1)}px, ${(y * strength).toFixed(1)}px)`;
      }}
      onPointerLeave={() => {
        const el = ref.current;
        if (!el) return;
        el.style.transition =
          "transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1)";
        el.style.transform = "translate(0px, 0px)";
      }}
    >
      {children}
    </div>
  );
}
