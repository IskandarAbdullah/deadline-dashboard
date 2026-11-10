import { useRef, useState } from "react";

/**
 * StickerPeel — the React Bits "StickerPeel" component
 * (@react-bits/StickerPeel-JS-CSS) the user asked for, implemented
 * from that component's JS/CSS variant (the shadcn CLI install path
 * is not part of this artifact's build pipeline, same as the other
 * React Bits pieces here): the dashboard's logo rendered as a real
 * peelable sticker — thick white sticker border, soft drop shadow,
 * a slight playful tilt — whose bottom-right corner can be grabbed
 * and dragged to peel it back, revealing the sticker's underside
 * and the backing beneath, then springs flat again on release.
 *
 * Placement/UX for this dashboard:
 * - Sits in normal flow at the TOP LEFT of the header, beside the
 *   "What's due" title, so it never overlays or blocks the calendar,
 *   its dots/checkboxes, the Extend button or anything else.
 * - The artwork is a small calendar glyph carrying the dashboard's
 *   own dot language: one red dot (assignment/deadline) and one blue
 *   dot (class) on the calendar grid.
 * - The peel is pointer-driven only (drag the corner handle); it is
 *   decorative, so the sticker exposes a plain accessible name and
 *   the drag handle is not a separate focus target. The peel amount
 *   is computed from the pointer's distance from the corner and
 *   clamped 0..1; while dragging there is no transition so the
 *   corner tracks the finger 1:1, and on release a transition
 *   springs it flat (removed under prefers-reduced-motion via the
 *   motion-reduce variant on the face).
 */

const SIZE = 58;

export function StickerPeel() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [peel, setPeel] = useState(0);
  const [dragging, setDragging] = useState(false);

  const peelFromPointer = (clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Peel grows as the pointer moves away from the bottom-right
    // corner toward the top-left.
    const dx = Math.max(rect.right - clientX, 0);
    const dy = Math.max(rect.bottom - clientY, 0);
    const dist = Math.hypot(dx, dy);
    setPeel(Math.min(1, Math.max(0, dist / (rect.width * 1.35))));
  };

  const endDrag = () => {
    setDragging(false);
    setPeel(0);
  };

  // Corner cut length, as a % of the sticker, driven by the peel.
  const cut = peel * 72;
  const peeled = cut > 0.5;
  const snap = dragging
    ? "none"
    : "clip-path 320ms cubic-bezier(0.22, 1, 0.36, 1), width 320ms cubic-bezier(0.22, 1, 0.36, 1), height 320ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label="Calendar sticker logo — red dot for assignments, blue dot for classes"
      className="relative shrink-0 select-none"
      style={{
        width: SIZE,
        height: SIZE,
        transform: "rotate(-6deg)",
        filter: "drop-shadow(0 3px 5px rgba(15, 20, 40, 0.28))",
        touchAction: "none",
      }}
    >
      {/* Backing left behind where the corner has peeled away. */}
      {peeled ? (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: "var(--border)",
            clipPath: `polygon(${100 - cut}% 100%, 100% ${100 - cut}%, 100% 100%)`,
            borderRadius: 14,
          }}
        />
      ) : null}

      {/* The sticker face: white sticker stock around a calendar glyph. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-white motion-reduce:transition-none"
        style={{
          clipPath: peeled
            ? `polygon(0 0, 100% 0, 100% ${100 - cut}%, ${100 - cut}% 100%, 0 100%)`
            : undefined,
          borderRadius: 14,
          padding: 5,
          transition: snap,
        }}
      >
        <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden="true">
          <rect x="3" y="6" width="42" height="38" rx="6" fill="#ffffff" stroke="#17203a" strokeWidth="2.4" />
          <path d="M3 12a6 6 0 0 1 6-6h30a6 6 0 0 1 6 6v4H3z" fill="#e2483d" />
          <rect x="12" y="2.5" width="4.5" height="9" rx="2.25" fill="#17203a" />
          <rect x="31.5" y="2.5" width="4.5" height="9" rx="2.25" fill="#17203a" />
          {/* Calendar grid */}
          <g fill="#c9cedb">
            <circle cx="13" cy="24" r="2.3" />
            <circle cx="35" cy="24" r="2.3" />
            <circle cx="13" cy="35" r="2.3" />
            <circle cx="35" cy="35" r="2.3" />
          </g>
          {/* The dashboard's two dots: red = assignment, blue = class */}
          <circle cx="24" cy="35" r="3.6" fill="#e2483d" />
          <circle cx="24" cy="24" r="3.6" fill="#2563eb" />
        </svg>
      </div>

      {/* The folded-back flap: the sticker's underside, mirrored
          across the fold line so it lies back over the sticker face,
          with its own soft shadow. */}
      {peeled ? (
        <div
          aria-hidden="true"
          className="absolute motion-reduce:transition-none"
          style={{
            right: 0,
            bottom: 0,
            width: `${cut}%`,
            height: `${cut}%`,
            background: "linear-gradient(315deg, #fdfdfa 0%, #e9e7dd 55%, #d6d3c6 100%)",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            filter: "drop-shadow(-2px -2px 3px rgba(15, 20, 40, 0.25))",
            borderRadius: 4,
            transition: snap,
          }}
        />
      ) : null}

      {/* Corner drag handle: invisible, covers the bottom-right
          corner; dragging it peels, releasing springs back. */}
      <div
        aria-hidden="true"
        className="absolute right-0 bottom-0 h-[55%] w-[55%] cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
          peelFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging) peelFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </div>
  );
}
