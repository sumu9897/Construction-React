/**
 * A trailing-dot cursor for fine pointers. It never replaces the system
 * cursor's job — it decorates it, grows over links and buttons, and says
 * "view" over rows that open something. Mounts on nothing for touch devices
 * and reduced-motion visitors.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { gsap, reducedMotion } from "../lib/motion";

export default function Cursor() {
  const [enabled] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: fine)").matches &&
      !reducedMotion(),
  );
  const dot = useRef(null);
  const ring = useRef(null);
  const label = useRef(null);

  useLayoutEffect(() => {
    if (!enabled) return undefined;

    const xDot = gsap.quickTo(dot.current, "x", { duration: 0.12, ease: "power3.out" });
    const yDot = gsap.quickTo(dot.current, "y", { duration: 0.12, ease: "power3.out" });
    const xRing = gsap.quickTo(ring.current, "x", { duration: 0.45, ease: "power3.out" });
    const yRing = gsap.quickTo(ring.current, "y", { duration: 0.45, ease: "power3.out" });

    const move = (e) => {
      xDot(e.clientX);
      yDot(e.clientY);
      xRing(e.clientX);
      yRing(e.clientY);
    };

    const over = (e) => {
      const interactive = e.target.closest("a, button, [data-cursor]");
      const view = e.target.closest('[data-cursor="view"]');
      gsap.to(ring.current, {
        scale: interactive ? 2.6 : 1,
        opacity: interactive ? 0.9 : 0.45,
        duration: 0.35,
        ease: "power3.out",
      });
      gsap.to(label.current, {
        opacity: view ? 1 : 0,
        duration: 0.25,
      });
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerover", over, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[95]">
      <div
        ref={ring}
        className="absolute -ml-4 -mt-4 flex h-8 w-8 items-center justify-center rounded-full border border-bone/60 opacity-45"
      >
        <span ref={label} className="font-sans text-[0.5rem] uppercase tracking-widest text-bone opacity-0">
          view
        </span>
      </div>
      <div ref={dot} className="absolute -ml-[3px] -mt-[3px] h-[6px] w-[6px] rounded-full bg-pmcc" />
    </div>
  );
}
