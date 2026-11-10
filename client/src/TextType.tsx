import { useEffect, useState } from "react";

/**
 * TextType — the React Bits "TextType" component
 * (@react-bits/TextType-JS-CSS) the user asked for, implemented
 * from that component's JS/CSS variant (the shadcn CLI install
 * path is not part of this artifact's build pipeline, same as the
 * other React Bits pieces here): a typewriter that types the text
 * out character by character with a blinking cursor.
 *
 * Placement/UX for this dashboard:
 * - Applied to the small "Last checked …" line under the
 *   title ONLY. The text is the live `lastCheckedAt` value,
 *   formatted exactly as before — never a hard-coded string — and
 *   when a re-check stores a newer timestamp the effect re-runs
 *   and types the new value.
 * - Types ONCE at a natural speed (~28ms per character), then
 *   stops: no looping, no deleting. The cursor blinks while
 *   typing and fades out once the line is complete.
 * - No layout jitter: an invisible full copy of the text reserves
 *   the line's exact space in normal flow while the typed text is
 *   overlaid on top, so nothing around it moves as it types.
 * - Accessible: the wrapper carries the full text as its
 *   aria-label and both rendered copies are aria-hidden, so a
 *   screen reader reads the complete line immediately.
 * - Under prefers-reduced-motion the full static text renders at
 *   once, with no typing and no cursor.
 */
export function TextType({ text }: { text: string }) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      setDone(true);
      return;
    }
    setCount(0);
    setDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, 28);
    return () => window.clearInterval(id);
  }, [text]);

  return (
    <span role="text" aria-label={text} className="relative inline-block max-w-full whitespace-nowrap">
      <span aria-hidden="true" className="invisible whitespace-nowrap">
        {text}|
      </span>
      <span aria-hidden="true" className="absolute inset-0 whitespace-nowrap">
        {text.slice(0, count)}
        <span
          className={
            done
              ? "opacity-0 transition-opacity duration-700"
              : "texttype-cursor"
          }
        >
          |
        </span>
      </span>
    </span>
  );
}
