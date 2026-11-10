/**
 * SplitText — the React Bits "SplitText" component
 * (@react-bits/SplitText-JS-CSS) the user asked for, implemented
 * from that component's JS/CSS variant (the shadcn CLI install
 * path is not part of this artifact's build pipeline, same as the
 * other React Bits pieces here): the text is split into individual
 * characters, each rising and fading in with a short stagger so
 * the word assembles itself on page load, then settles flat.
 *
 * Placement/UX for this dashboard:
 * - Applied to the "What's due" heading ONLY — same text, same
 *   size, same place beside the StickerPeel logo at the top left.
 * - The animation is pure CSS (keyframes in theme.css) running
 *   once on mount: characters render in the DOM immediately in
 *   their final inline positions, so there is no layout shift —
 *   only transform/opacity move while animating. A tiny bottom
 *   padding on the wrapper keeps descenders from clipping.
 * - Quick and tasteful: ~45ms stagger, ~450ms per character, the
 *   whole title settled in well under a second.
 * - Accessible: the wrapper carries the full text as its
 *   aria-label and the per-character spans are aria-hidden, so a
 *   screen reader reads "What's due" as one normal heading.
 * - Under prefers-reduced-motion the keyframes are disabled in
 *   theme.css and the static title shows (characters start from
 *   their resting state, never hidden).
 */
export function SplitText({ text }: { text: string }) {
  const chars = Array.from(text);
  return (
    <span role="text" aria-label={text} className="inline-block pb-[0.08em]">
      {chars.map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="split-char inline-block"
          style={{ animationDelay: `${i * 45}ms` }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}
