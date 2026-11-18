
/**
 * Confetti — a tiny DOM-particle burst fired when the user ticks a
 * deadline done (asked for 18 Nov 2026). No library: ~26 absolutely
 * positioned pieces spawn at the checkbox, fly out under gravity,
 * spin and fade over ~650ms, then the layer removes itself.
 *
 * Safety (react-bits Step 6): the layer is pointer-events-none and
 * fixed, so it can never block a tap; under prefers-reduced-motion
 * no burst fires at all — the caller shows a simple green pulse on
 * the checkbox instead (see `.done-pulse` in theme.css).
 */

const COLORS = ["#1d7a4f", "#3ecf8e", "#e2483d", "#2563eb", "#f6b73c"];

export function confettiBurst(x: number, y: number): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:120;overflow:hidden;";
  const pieces: HTMLSpanElement[] = [];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement("span");
    const size = 5 + Math.random() * 5;
    const round = Math.random() < 0.35;
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${round ? size : size * 0.55}px;background:${COLORS[i % COLORS.length]};border-radius:${round ? "50%" : "1.5px"};will-change:transform,opacity;`;
    layer.appendChild(p);
    pieces.push(p);
  }
  document.body.appendChild(layer);
  const start = performance.now();
  const DURATION = 650;
  const seeds = pieces.map(() => ({
    angle: Math.random() * Math.PI * 2,
    speed: 60 + Math.random() * 130,
    spin: (Math.random() - 0.5) * 720,
  }));
  const tick = (t: number) => {
    const k = Math.min(1, (t - start) / DURATION);
    pieces.forEach((p, i) => {
      const s = seeds[i];
      if (!s) return;
      const dx = Math.cos(s.angle) * s.speed * k;
      const dy = Math.sin(s.angle) * s.speed * k + 150 * k * k;
      p.style.transform = `translate(${dx - 50}%, ${dy}px) rotate(${s.spin * k}deg)`;
      p.style.opacity = String(1 - k * k);
    });
    if (k < 1) requestAnimationFrame(tick);
    else layer.remove();
  };
  requestAnimationFrame(tick);
}

/**
 * Fires a confetti burst from an element's centre — used by the done
 * checkbox when it is ticked ON. Under reduced motion, pulses the
 * element green instead (the class is defined in theme.css and is a
 * no-op animation-wise under reduced motion settings that disable
 * it; the pulse itself is the reduced-motion substitute, kept very
 * subtle and brief).
 */
export function celebrateFrom(el: HTMLElement | null): void {
  if (!el) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.classList.remove("done-pulse");
    // Restart the pulse if it was already applied.
    void el.offsetWidth;
    el.classList.add("done-pulse");
    window.setTimeout(() => el.classList.remove("done-pulse"), 500);
    return;
  }
  const r = el.getBoundingClientRect();
  confettiBurst(r.left + r.width / 2, r.top + r.height / 2);
}
