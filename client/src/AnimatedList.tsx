import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * AnimatedList — the React Bits "AnimatedList" component
 * (@react-bits/AnimatedList-JS-CSS), implemented from that
 * component's JS/CSS variant (the shadcn CLI install path is not
 * part of this artifact's build pipeline, same as the other React
 * Bits pieces here): a list whose rows stagger in — a short rise
 * and fade, ~55ms apart — whenever the list's content is swapped.
 *
 * Applied to the calendar's day-detail list, keyed by the selected
 * day: tapping a different day remounts the list (via `listKey`) so
 * that day's rows arrive with the stagger, while plain re-renders
 * (the 30s clock tick, a data refetch, ticking a done checkbox) do
 * NOT replay it — the key is unchanged, so nothing remounts and no
 * animation restarts. The animation is a CSS keyframe class added
 * to each existing <li> (cloned, never wrapped, so list semantics
 * and the checkboxes inside are untouched), and theme.css turns it
 * off entirely under prefers-reduced-motion.
 */
export function AnimatedList({
  children,
  className,
  listKey,
  step = 55,
}: {
  children: ReactNode;
  className?: string;
  /** Changing this remounts the list and replays the stagger. */
  listKey: string;
  step?: number;
}) {
  return (
    <ul key={listKey} className={className}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<Record<string, unknown>>;
        const prevClass =
          typeof el.props.className === "string" ? el.props.className : "";
        const prevStyle = (el.props.style ?? {}) as CSSProperties;
        return cloneElement(el, {
          className: `${prevClass} animated-item`.trim(),
          style: { ...prevStyle, animationDelay: `${i * step}ms` },
        });
      })}
    </ul>
  );
}
