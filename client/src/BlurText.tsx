import { useEffect, useRef, useState } from "react";

/**
 * BlurText — the React Bits "Blur Text" component
 * (@react-bits/BlurText-JS-CSS), implemented from that component's
 * JS/CSS variant (the shadcn CLI install path is not part of this
 * artifact's build pipeline, same as the other React Bits pieces
 * here): a heading's words start blurred, faded and slightly
 * lowered, then sharpen, rise and fade in one by one the first time
 * the heading scrolls into view.
 *
 * Applied to the section headings below the calendar ("Coming up",
 * "Needs checking") — never the main title, which SplitText owns.
 * Safety: the wrapper carries the full text as an aria-label with
 * the word spans aria-hidden (same pattern as SplitText), the words
 * render in their final inline positions so there is no layout
 * shift, a safety timer guarantees the heading ends fully visible
 * even if the observer never fires, and under
 * prefers-reduced-motion the plain static text shows immediately.
 */
export function BlurText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    const safety = window.setTimeout(() => setShown(true), 1600);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, []);

  const words = text.split(" ");
  return (
    <span ref={ref} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            display: "inline-block",
            opacity: shown ? 1 : 0,
            filter: shown ? "blur(0px)" : "blur(6px)",
            transform: shown ? "translateY(0px)" : "translateY(4px)",
            transition:
              `opacity 550ms ease ${i * 110}ms, ` +
              `filter 550ms ease ${i * 110}ms, ` +
              `transform 550ms ease ${i * 110}ms`,
            willChange: "opacity, filter, transform",
          }}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
