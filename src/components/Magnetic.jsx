/**
 * Magnetic hover: the wrapped element leans toward the cursor and springs
 * back on leave. Fine pointers only; a no-op wrapper everywhere else.
 */
import { useLayoutEffect, useRef } from "react";
import { gsap, reducedMotion } from "../lib/motion";

export default function Magnetic({ children, strength = 0.35, className = "" }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion() || !window.matchMedia("(pointer: fine)").matches) return undefined;
    const el = ref.current;
    const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });

    const move = (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const leave = () => {
      xTo(0);
      yTo(0);
    };

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength]);

  return (
    <div ref={ref} className={`inline-block ${className}`}>
      {children}
    </div>
  );
}
