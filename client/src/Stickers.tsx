/**
 * Stickers — the calendar sticker catalog and artwork.
 *
 * The user asked (18 Nov 2026) for a tray of stickers they can grab,
 * stick on calendar days and peel off again. Designs follow the
 * dashboard's existing StickerPeel logo look: colourful art with a
 * thick white sticker outline, a soft drop shadow and a slight
 * playful rotation (rotations are applied by the tray / day-cell
 * cluster, not here). Everything is drawn as inline SVG or CSS —
 * no emoji, no image files.
 *
 * Icon stickers render an SVG glyph whose filled shapes carry a
 * white stroke with paint-order="stroke", which reads as the white
 * sticker border. Text stickers (EXAM, QUIZ, …) render as a bold
 * pill with a white border. `size` is the sticker's height in px;
 * text pills size their type from it and keep a readable minimum.
 */

export type StickerDef = {
  type: string;
  label: string;
  /** Text stickers render as a labelled pill instead of an icon. */
  text?: boolean;
  /** Pill background for text stickers. */
  bg?: string;
};

export const STICKERS: StickerDef[] = [
  { type: "star", label: "Star" },
  { type: "heart", label: "Heart" },
  { type: "flag", label: "Flag" },
  { type: "pin", label: "Pin" },
  { type: "check", label: "Check" },
  { type: "thumbs-up", label: "Thumbs up" },
  { type: "fire", label: "Fire" },
  { type: "rocket", label: "Rocket" },
  { type: "coffee", label: "Coffee" },
  { type: "book", label: "Book" },
  { type: "pencil", label: "Pencil" },
  { type: "alarm", label: "Alarm clock" },
  { type: "medal", label: "Medal" },
  { type: "balloon", label: "Balloon" },
  { type: "music", label: "Music" },
  { type: "exam", label: "EXAM", text: true, bg: "#e2483d" },
  { type: "quiz", label: "QUIZ", text: true, bg: "#2563eb" },
  { type: "important", label: "IMPORTANT", text: true, bg: "#d97706" },
  { type: "holiday", label: "HOLIDAY", text: true, bg: "#1d7a4f" },
  { type: "rest-day", label: "REST DAY", text: true, bg: "#0e7490" },
];

/** The user's own photo sticker: not part of the static catalog —
 *  its artwork is the data URL stored server-side. */
export const PHOTO_STICKER: StickerDef = { type: "photo", label: "Your photo" };

export function stickerDef(type: string): StickerDef {
  if (type === PHOTO_STICKER.type) return PHOTO_STICKER;
  const found = STICKERS.find((s) => s.type === type);
  if (found) return found;
  return { type: "star", label: "Star" };
}

export function stickerLabel(type: string): string {
  return stickerDef(type).label;
}

/** White sticker outline shared by the filled icon shapes. */
const OUTLINE = {
  stroke: "#ffffff",
  strokeWidth: 1.5,
  paintOrder: "stroke" as const,
  strokeLinejoin: "round" as const,
};

function IconArt({ type }: { type: string }) {
  switch (type) {
    case "star":
      return (
        <path
          d="M12 2.6l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.7l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"
          fill="#f6b73c"
          {...OUTLINE}
        />
      );
    case "heart":
      return (
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="#ef4456"
          {...OUTLINE}
        />
      );
    case "flag":
      return (
        <>
          <rect x="5.3" y="2.4" width="1.9" height="19" rx="0.95" fill="#8a5a2b" {...OUTLINE} />
          <path d="M7.2 3.8h10.6l-2.7 3.9 2.7 3.9H7.2z" fill="#e2483d" {...OUTLINE} />
        </>
      );
    case "pin":
      return (
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
          fill="#e2483d"
          fillRule="evenodd"
          {...OUTLINE}
        />
      );
    case "check":
      return (
        <>
          <circle cx="12" cy="12" r="9.2" fill="#22a35c" {...OUTLINE} />
          <path
            d="M8.1 12.5l2.6 2.6 5.1-5.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case "thumbs-up":
      return (
        <path
          d="M2 21h3V9H2v12zM21 10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L12.17 1 5.59 7.59C5.22 7.95 5 8.45 5 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"
          fill="#f2a93b"
          {...OUTLINE}
        />
      );
    case "fire":
      return (
        <>
          <path
            d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"
            fill="#f97316"
            {...OUTLINE}
          />
          <path
            d="M11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"
            fill="#fcd34d"
          />
        </>
      );
    case "rocket":
      return (
        <>
          <path d="M10.1 16.4c-.4 1.8.2 3.6 1.9 5.2 1.7-1.6 2.3-3.4 1.9-5.2z" fill="#f59e0b" {...OUTLINE} />
          <path d="M7.7 12.6C6.1 14.2 5.2 16.2 4.9 18.5l3.4-2.3c-.3-1.1-.5-2.3-.6-3.6z" fill="#e2483d" {...OUTLINE} />
          <path d="M16.3 12.6c1.6 1.6 2.5 3.6 2.8 5.9l-3.4-2.3c.3-1.1.5-2.3.6-3.6z" fill="#e2483d" {...OUTLINE} />
          <path
            d="M12 2.4c2.9 2.4 4.4 6.2 4.4 10.1 0 1.4-.2 2.7-.5 3.8H8.1c-.3-1.1-.5-2.4-.5-3.8C7.6 8.6 9.1 4.8 12 2.4z"
            fill="#e9eef6"
            {...OUTLINE}
          />
          <circle cx="12" cy="9" r="2" fill="#2563eb" stroke="#ffffff" strokeWidth="0.9" />
        </>
      );
    case "coffee":
      return (
        <>
          <path
            d="M9 2.6c-.9 1.1.9 1.8 0 2.9M13.4 2.6c-.9 1.1.9 1.8 0 2.9"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M17 10.6h1.5a2.9 2.9 0 0 1 0 5.8H17"
            fill="none"
            stroke="#b0722f"
            strokeWidth="1.9"
          />
          <path
            d="M5 9.3h12v4.4a5.3 5.3 0 0 1-5.3 5.3h-1.4A5.3 5.3 0 0 1 5 13.7z"
            fill="#b0722f"
            {...OUTLINE}
          />
          <ellipse cx="11" cy="9.3" rx="6" ry="1.3" fill="#6f4520" />
          <rect x="3.8" y="20.2" width="14.4" height="1.7" rx="0.85" fill="#94a3b8" {...OUTLINE} />
        </>
      );
    case "book":
      return (
        <>
          <path
            d="M5 3.5A1.5 1.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 0 5 20.5z"
            fill="#2563eb"
            {...OUTLINE}
          />
          <path d="M5 20.5V5.2" fill="none" stroke="#ffffff" strokeWidth="1.4" />
          <rect x="8.6" y="5.4" width="7.6" height="4.6" rx="0.8" fill="#ffffff" opacity="0.85" />
        </>
      );
    case "pencil":
      return (
        <>
          <path
            d="M4.2 19.8l1-3.9L16.9 4.2a2.05 2.05 0 0 1 2.9 0l.9.9a2.05 2.05 0 0 1 0 2.9L9 19.7z"
            fill="#f6b73c"
            {...OUTLINE}
          />
          <path d="M14.9 6.2l2.9 2.9" stroke="#ffffff" strokeWidth="1.3" />
          <path d="M4.2 19.8l2.9-.7-2.2-2.2z" fill="#17203a" />
        </>
      );
    case "alarm":
      return (
        <>
          <path d="M5.2 3.2L3 5.6M18.8 3.2L21 5.6" stroke="#e2483d" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="12" cy="13" r="7.6" fill="#e2483d" {...OUTLINE} />
          <circle cx="12" cy="13" r="5.9" fill="#ffffff" />
          <path
            d="M12 9.8V13l2.3 1.5"
            fill="none"
            stroke="#17203a"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M8.4 19.6l-1.2 1.9M15.6 19.6l1.2 1.9" stroke="#e2483d" strokeWidth="1.9" strokeLinecap="round" />
        </>
      );
    case "medal":
      return (
        <>
          <path d="M8.2 2.6L12 9l1.8-2.9L11.6 2.6z" fill="#2563eb" {...OUTLINE} />
          <path d="M15.8 2.6L12 9l-1.8-2.9 2.2-3.5z" fill="#e2483d" {...OUTLINE} />
          <circle cx="12" cy="14.6" r="6.4" fill="#f6b73c" {...OUTLINE} />
          <circle cx="12" cy="14.6" r="4.4" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.8" />
          <path
            d="M12 11.9l.85 1.8 2 .25-1.47 1.38.38 1.97L12 16.35l-1.76.95.38-1.97-1.47-1.38 2-.25z"
            fill="#ffffff"
          />
        </>
      );
    case "balloon":
      return (
        <>
          <path
            d="M12 2.2c3.9 0 6.6 2.9 6.6 6.4 0 3.9-3.1 6.9-6.6 6.9s-6.6-3-6.6-6.9c0-3.5 2.7-6.4 6.6-6.4z"
            fill="#8b5cf6"
            {...OUTLINE}
          />
          <ellipse cx="9.6" cy="6.4" rx="1.7" ry="2.5" fill="#ffffff" opacity="0.45" transform="rotate(-18 9.6 6.4)" />
          <path d="M10.9 15.5h2.2l-1.1 1.8z" fill="#8b5cf6" {...OUTLINE} />
          <path
            d="M12 17.3c-1 1.4 1 2 .2 3.4"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </>
      );
    case "music":
      return (
        <>
          <path
            d="M9.2 18.6V6.1l10.3-2v11.1"
            fill="none"
            stroke="#0e7490"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <circle cx="6.6" cy="18.6" r="2.9" fill="#0e7490" {...OUTLINE} />
          <circle cx="16.9" cy="15.1" r="2.9" fill="#e2483d" {...OUTLINE} />
        </>
      );
    default:
      return (
        <path
          d="M12 2.6l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.7l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"
          fill="#f6b73c"
          {...OUTLINE}
        />
      );
  }
}

/**
 * One sticker at the given height (px). Icon stickers are square;
 * text stickers are pills whose width follows the word. The wrapper
 * carries the soft sticker shadow; rotation is the caller's job.
 */
export function StickerArt({
  type,
  size,
  photoUrl,
}: {
  type: string;
  size: number;
  /** The user's photo sticker image (data URL) — only used when
   *  type is "photo". Without it the photo sticker falls back to a
   *  neutral round placeholder so a stale placement never breaks. */
  photoUrl?: string | null;
}) {
  const def = stickerDef(type);
  if (type === "photo") {
    return (
      <span
        aria-hidden="true"
        className="block overflow-hidden rounded-full"
        style={{
          width: size,
          height: size,
          border: `${Math.max(1.5, size * 0.09)}px solid #ffffff`,
          boxShadow: "0 2px 4px rgba(15, 20, 40, 0.3)",
          backgroundColor: "#cbd5e1",
        }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : null}
      </span>
    );
  }
  if (def.text) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center rounded-full font-display font-extrabold whitespace-nowrap uppercase"
        style={{
          backgroundColor: def.bg,
          color: "#ffffff",
          border: `${Math.max(1.5, size * 0.09)}px solid #ffffff`,
          fontSize: Math.max(6, size * 0.36),
          letterSpacing: "0.05em",
          lineHeight: 1,
          padding: `${size * 0.16}px ${size * 0.34}px`,
          boxShadow: "0 2px 4px rgba(15, 20, 40, 0.3)",
        }}
      >
        {def.label}
      </span>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: "block",
        filter: "drop-shadow(0 2px 3px rgba(15, 20, 40, 0.3))",
      }}
    >
      <IconArt type={type} />
    </svg>
  );
}
