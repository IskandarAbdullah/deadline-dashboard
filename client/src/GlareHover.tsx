import { useRef, type ReactNode } from "react";

/**
 * GlareHover — the React Bits "GlareHover" component
 * (@react-bits/GlareHover-JS-CSS), implemented from that
 * component's JS/CSS variant (the shadcn CLI install path is not
 * part of this artifact's build pipeline, same as the other React
 * Bits pieces here): a soft radial glare in the theme's accent
 * green follows the pointer across the wrapped panel and fades out
 * when the pointer leaves.
 *
 * Applied to the calendar's day-detail panel. Safety: the glare is
 * a pointer-events-none overlay written straight to the DOM (no
 * re-renders on pointer move), so day taps and done checkboxes
 * inside keep working exactly as before; it only engages on fine
 * pointers with motion allowed — touch and prefers-reduced-motion
 * get the plain static panel.
 */
export function GlareHover({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={ref}
      className={`relative ${className ?? ""}`}
      onPointerMove={(e) => {
        const el = ref.current;
        const glare = glareRef.current;
        if (!el || !glare) return;
        if (!window.matchMedia("(pointer: fine)").matches) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
          return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        glare.style.background = `radial-gradient(circle 160px at ${px}% ${py}%, var(--glare), transparent 70%)`;
        glare.style.opacity = "1";
      }}
      onPointerLeave={() => {
        if (glareRef.current) glareRef.current.style.opacity = "0";
      }}
    >
      {children}
      <div
        ref={glareRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300"
      />
    </div>
  );
}
