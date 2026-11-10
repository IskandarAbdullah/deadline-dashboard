import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * BranchedMenu — the React Bits "BranchedMenu" component
 * (@react-bits/BranchedMenu-JS-CSS) the user asked for, implemented
 * from that component's JS/CSS variant (the shadcn CLI install path
 * is not part of this artifact's build pipeline, same as the other
 * React Bits pieces here): a trunk menu anchored to one side whose
 * entries fan out as branches — a branch header expands to reveal
 * its child items along a drawn branch line, staggered in.
 *
 * Placement/UX for this dashboard:
 * - Anchored to the BOTTOM LEFT corner of the page as a fixed rail.
 *   Collapsed it is a single 44px round toggle button hugging the
 *   corner (with a safe gap from the edges, mirrored by extra bottom
 *   padding on the page), so it never covers or blocks the calendar,
 *   its dots/checkboxes, the Extend button or the Shredder stack —
 *   especially on a phone. The panel opens UPWARD from the button
 *   and only exists while the user has it open.
 * - The panel closes on Escape, on an outside tap/click, and after
 *   any leaf is chosen, so it never lingers over the content.
 * - Items are wired only to things this dashboard actually does
 *   (supplied by the caller): "Go to" branch — Today (jump the
 *   calendar to today) and Coming up (extend the hidden sections and
 *   scroll to them); a "Check again" leaf that runs the existing
 *   re-check; and an "Open" branch with the user's two real study
 *   sites as new-tab links.
 * - Theme tokens only (surface/border/text/accent), so it matches in
 *   light and dark mode. Entrance animations are disabled under
 *   prefers-reduced-motion via the classes in theme.css.
 */

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const BranchIcon = (
  <Icon>
    <circle cx="5" cy="12" r="2.2" />
    <circle cx="19" cy="5" r="2.2" />
    <circle cx="19" cy="19" r="2.2" />
    <path d="M7 11l9.5-4.5M7 13l9.5 4.5" />
  </Icon>
);

const CalendarIcon = (
  <Icon>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);

const ListIcon = (
  <Icon>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

const RefreshIcon = (
  <Icon>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </Icon>
);

const ExternalIcon = (
  <Icon>
    <path d="M14 4h6v6" />
    <path d="M20 4L10.5 13.5" />
    <path d="M19 13.5V19a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 19V7a1.5 1.5 0 0 1 5.5 5.5H11" />
  </Icon>
);

const BookIcon = (
  <Icon>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13z" />
    <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
  </Icon>
);

const ClockIcon = (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Icon>
);

const CompassIcon = (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5z" />
  </Icon>
);

function LeafButton({
  icon,
  label,
  ariaLabel,
  delay,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  delay: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <li className="branched-item relative" style={{ animationDelay: `${delay}ms` }}>
      <span
        aria-hidden="true"
        className="absolute top-1/2 -left-5 h-px w-3.5 bg-[var(--border)]"
      />
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-display text-sm font-bold hover:bg-[var(--bg)] disabled:opacity-50"
      >
        <span className="text-[var(--accent)]">{icon}</span>
        {label}
      </button>
    </li>
  );
}

function LeafLink({
  icon,
  label,
  ariaLabel,
  href,
  delay,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  href: string;
  delay: number;
  onClick: () => void;
}) {
  return (
    <li className="branched-item relative" style={{ animationDelay: `${delay}ms` }}>
      <span
        aria-hidden="true"
        className="absolute top-1/2 -left-5 h-px w-3.5 bg-[var(--border)]"
      />
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={ariaLabel}
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 font-display text-sm font-bold hover:bg-[var(--bg)]"
      >
        <span className="text-[var(--accent)]">{icon}</span>
        {label}
        <span aria-hidden="true" className="ml-auto text-xs text-[var(--dim)]">
          ↗
        </span>
      </a>
    </li>
  );
}

function Branch({
  id,
  icon,
  label,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  icon: ReactNode;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        aria-label={`${label} branch`}
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-display text-sm font-extrabold tracking-wide hover:bg-[var(--bg)]"
      >
        <span className="text-[var(--dim)]">{icon}</span>
        {label}
        <span
          aria-hidden="true"
          className="ml-auto text-xs text-[var(--dim)] transition-transform duration-200"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ›
        </span>
      </button>
      <div
        id={id}
        className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <ul className="relative mt-0.5 mb-1 ml-[19px] space-y-0.5 pl-5">
            {/* The branch line the child items hang off. */}
            <span
              aria-hidden="true"
              className="absolute top-0 bottom-2 left-[7px] w-px bg-[var(--border)]"
            />
            {children}
          </ul>
        </div>
      </div>
    </li>
  );
}

export function BranchedMenu({
  onGoToday,
  onGoComingUp,
  onCheck,
  checkPending,
}: {
  onGoToday: () => void;
  onGoComingUp: () => void;
  onCheck: () => void;
  checkPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [goExpanded, setGoExpanded] = useState(true);
  const [openExpanded, setOpenExpanded] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape or on a pointer-down outside the rail.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open ]);

  const runAndClose = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className="fixed bottom-4 left-3 z-40 flex flex-col-reverse items-start gap-2 sm:left-4"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="branched-menu-panel"
        aria-label={open ? "Close side menu" : "Open side menu"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--text)] text-[var(--bg)] shadow-[0_6px_20px_rgba(0,0,0,0.25)]"
      >
        {open ? (
          <span aria-hidden="true" className="font-display text-base leading-none font-extrabold">
            ✕
          </span>
        ) : (
          BranchIcon
        )}
      </button>

      {open ? (
        <nav
          id="branched-menu-panel"
          aria-label="Side menu"
          className="branched-panel max-h-[70vh] w-[232px] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-2.5 text-[var(--text)] shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
        >
          <ul className="space-y-0.5">
            <Branch
              id="branched-menu-go"
              icon={CompassIcon}
              label="Go to"
              expanded={goExpanded}
              onToggle={() => setGoExpanded((v) => !v)}
            >
              <LeafButton
                icon={CalendarIcon}
                label="Today"
                ariaLabel="Jump the calendar to today (side menu)"
                delay={40}
                onClick={runAndClose(onGoToday)}
              />
              <LeafButton
                icon={ListIcon}
                label="Coming up"
                ariaLabel="Show the Coming up deadlines (side menu)"
                delay={90}
                onClick={runAndClose(onGoComingUp)}
              />
            </Branch>

            <li className="branched-item" style={{ animationDelay: "140ms" }}>
              <button
                type="button"
                aria-label="Check again (side menu)"
                disabled={checkPending}
                onClick={runAndClose(onCheck)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-display text-sm font-extrabold tracking-wide hover:bg-[var(--bg)] disabled:opacity-50"
              >
                <span className="text-[var(--dim)]">{RefreshIcon}</span>
                {checkPending ? "Checking…" : "Check again"}
              </button>
            </li>

            <Branch
              id="branched-menu-open"
              icon={ExternalIcon}
              label="Open"
              expanded={openExpanded}
              onToggle={() => setOpenExpanded((v) => !v)}
            >
              <LeafLink
                icon={BookIcon}
                label="LMS"
                ariaLabel="Open the LMS in a new tab"
                href="https://example.com/lms"
                delay={190}
                onClick={() => setOpen(false)}
              />
              <LeafLink
                icon={ClockIcon}
                label="Timetable"
                ariaLabel="Open the timetable in a new tab"
                href="https://example.com/timetable"
                delay={240}
                onClick={() => setOpen(false)}
              />
            </Branch>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
