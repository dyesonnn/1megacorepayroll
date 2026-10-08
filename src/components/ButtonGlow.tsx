"use client";

import { useEffect } from "react";

/** Tint for light-surfaced controls. */
const ACCENT = "59 130 246";
/** Near-white edge light, for dark or saturated surfaces where blue muddies. */
const ON_DARK = "226 238 255";

const ACTIVE_CLASS = "glow-on";
const LIGHT_SURFACES = "button, .btn-glow";

/**
 * A 1px canvas is the only dependable way to read a background colour: the
 * browser may hand back rgb(), oklch() or a named colour, and painting it and
 * reading the pixel normalises all of them.
 */
let sampler: HTMLCanvasElement | null = null;

function surfaceColor(element: HTMLElement): [number, number, number, number] {
  if (!sampler) {
    sampler = document.createElement("canvas");
    sampler.width = 1;
    sampler.height = 1;
  }

  const context = sampler.getContext("2d", { willReadFrequently: true });
  if (!context) return [255, 255, 255, 0];

  context.clearRect(0, 0, 1, 1);
  context.fillStyle = "rgba(0, 0, 0, 0)";
  context.fillStyle = getComputedStyle(element).backgroundColor;
  context.fillRect(0, 0, 1, 1);

  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a];
}

/** Pick the light colour from the control's own background luminance. */
function lightFor(element: HTMLElement): string {
  const [r, g, b, a] = surfaceColor(element);
  if (a < 90) return ACCENT;

  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma < 0.6 ? ON_DARK : ACCENT;
}

/**
 * Lights the border of whichever button the crosshair is on and points that
 * light at the pointer. One global listener drives every button, so new
 * buttons need no wiring.
 */
export default function ButtonGlow() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;

    const release = () => {
      active?.classList.remove(ACTIVE_CLASS);
      active = null;
    };

    const paint = () => {
      frame = 0;
      if (!pointer) return;

      // Asking the document what sits under the crosshair (rather than trusting
      // the event target) keeps the light correct when the element under a
      // stationary pointer changes, e.g. the page scrolls or a modal opens.
      const control = document
        .elementFromPoint(pointer.x, pointer.y)
        ?.closest<HTMLElement>(LIGHT_SURFACES);

      if (
        !control ||
        (control instanceof HTMLButtonElement && control.disabled)
      ) {
        release();
        return;
      }

      if (control !== active) {
        release();
        active = control;
        control.style.setProperty("--glow-light", lightFor(control));
        control.classList.add(ACTIVE_CLASS);
      }

      const rect = control.getBoundingClientRect();
      const dx = pointer.x - (rect.left + rect.width / 2);
      const dy = pointer.y - (rect.top + rect.height / 2);
      // Bearing from the control's centre, measured clockwise from straight up,
      // so it lines up with the conic gradient's own origin.
      const bearing = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
      control.style.setProperty("--glow-angle", `${bearing}deg`);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };

    const onScroll = () => {
      // A stationary pointer sits over different pixels once the page moves.
      schedule();
    };

    const clear = () => {
      pointer = null;
      release();
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (!event.relatedTarget) clear();
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("blur", clear);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("blur", clear);
      if (frame) cancelAnimationFrame(frame);
      release();
    };
  }, []);

  return null;
}
