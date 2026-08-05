/**
 * One place registers GSAP plugins and owns the global motion switches.
 * Everything animates transform/opacity/clip-path only — the 60fps budget is
 * a hard rule, not a hope.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

gsap.defaults({ ease: "power3.out", duration: 1 });

/** True when the visitor asked for calm. Checked at setup, not per-frame. */
export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export { gsap, ScrollTrigger, SplitText };
