import { useEffect, useRef } from "react";

/**
 * CursorGrid page background — the React Bits "CursorGrid" component
 * (@react-bits/CursorGrid-JS-CSS) the user asked for, implemented from
 * that component's JS/CSS variant: a full-viewport canvas grid of cells
 * that light up around the pointer and fade back down.
 *
 * Background only: fixed, z-0, pointer-events none, so every control on
 * top stays tappable. Colours stay at low alpha so text and the red/blue
 * calendar dots remain clear in light and dark mode. Performance: DPR is
 * capped, the animation loop only runs while cells are lit, and under
 * prefers-reduced-motion it draws one static faint grid and stops.
 */
export function CursorGrid() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctxOrNull = canvasEl.getContext("2d");
    if (!ctxOrNull) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const CELL = 30; // px between cell centres
    const RADIUS = 140; // pointer influence radius, px
    const BASE_SIZE = 3; // resting dot size, px
    const MAX_SIZE = 15; // fully lit cell size, px

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let intensity = new Float32Array(0);
    let pointerX = -9999;
    let pointerY = -9999;
    let lastMove = 0;
    let raf = 0;
    let running = false;

    function colors() {
      return darkQuery.matches
        ? { base: "rgba(154, 163, 184, 0.10)", a: [62, 207, 142], b: [96, 165, 250] }
        : { base: "rgba(23, 32, 58, 0.07)", a: [29, 122, 79], b: [37, 99, 235] };
    }

    function drawBase() {
      const { base } = colors();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = base;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * CELL + CELL / 2;
          const y = r * CELL + CELL / 2;
          ctx.fillRect(x - BASE_SIZE / 2, y - BASE_SIZE / 2, BASE_SIZE, BASE_SIZE);
        }
      }
    }

    function frame() {
      // Light up cells near the pointer while it is present and fresh.
      if (pointerX >= 0 && performance.now() - lastMove < 2000) {
        const minC = Math.max(0, Math.floor((pointerX - RADIUS) / CELL));
        const maxC = Math.min(cols - 1, Math.ceil((pointerX + RADIUS) / CELL));
        const minR = Math.max(0, Math.floor((pointerY - RADIUS) / CELL));
        const maxR = Math.min(rows - 1, Math.ceil((pointerY + RADIUS) / CELL));
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            const x = c * CELL + CELL / 2;
            const y = r * CELL + CELL / 2;
            const d = Math.hypot(x - pointerX, y - pointerY);
            if (d < RADIUS) {
              const t = 1 - d / RADIUS;
              const idx = r * cols + c;
              const cur = intensity[idx] ?? 0;
              intensity[idx] = Math.max(cur, t * t);
            }
          }
        }
      }

      const { base, a, b } = colors();
      ctx.clearRect(0, 0, width, height);
      let alive = false;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const v = intensity[idx] ?? 0;
          const x = c * CELL + CELL / 2;
          const y = r * CELL + CELL / 2;
          if (v > 0.02) {
            alive = true;
            // Per-cell blend between the two glow colours (stable hash).
            const t = ((idx * 2654435761) % 100) / 100;
            const cr = Math.round((a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * t);
            const cg = Math.round((a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * t);
            const cb = Math.round((a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t);
            const size = BASE_SIZE + v * (MAX_SIZE - BASE_SIZE);
            ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.08 + v * 0.3})`;
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
            intensity[idx] = v * 0.92;
          } else {
            if (v !== 0) intensity[idx] = 0;
            ctx.fillStyle = base;
            ctx.fillRect(x - BASE_SIZE / 2, y - BASE_SIZE / 2, BASE_SIZE, BASE_SIZE);
          }
        }
      }

      if (alive) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
        drawBase();
      }
    }

    function kick() {
      if (!running && !reduced) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      intensity = new Float32Array(cols * rows);
      if (!running) drawBase();
    }

    function onPointerMove(e: PointerEvent) {
      pointerX = e.clientX;
      pointerY = e.clientY;
      lastMove = performance.now();
      kick();
    }
    function onPointerLeave() {
      pointerX = -9999;
      pointerY = -9999;
    }
    function onSchemeChange() {
      if (!running) drawBase();
    }

    resize();
    window.addEventListener("resize", resize);
    if (!reduced) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
    }
    darkQuery.addEventListener("change", onSchemeChange);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      darkQuery.removeEventListener("change", onSchemeChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
