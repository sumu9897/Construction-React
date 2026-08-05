/**
 * Monogram preloader — shown once per session, never longer than ~1.4s.
 * The red block draws in, the counter runs, the curtain lifts. Under
 * reduced motion it simply doesn't exist.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { gsap, reducedMotion } from "../lib/motion";

const SEEN_KEY = "pmcc-preloaded";

export default function Preloader({ onDone }) {
  const [skip] = useState(
    () => reducedMotion() || sessionStorage.getItem(SEEN_KEY) === "1",
  );
  const root = useRef(null);
  const done = useRef(onDone);
  done.current = onDone;

  useLayoutEffect(() => {
    if (skip) {
      done.current?.();
      return undefined;
    }
    sessionStorage.setItem(SEEN_KEY, "1");
    const el = root.current;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => done.current?.(),
      });
      // The whole ritual stays under ~1.1s — it is a signature, not a gate,
      // and every extra tenth here is added to first-visit LCP.
      tl.fromTo(
        "[data-block]",
        { scaleX: 0 },
        { scaleX: 1, duration: 0.4, ease: "power4.inOut", transformOrigin: "left center" },
      )
        .fromTo(
          "[data-word]",
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.2 },
          "-=0.1",
        )
        .fromTo(
          "[data-count]",
          { textContent: 0 },
          { textContent: 100, duration: 0.45, snap: { textContent: 1 }, ease: "power2.inOut" },
          "<",
        )
        .to(el, {
          yPercent: -100,
          duration: 0.55,
          ease: "power4.inOut",
        });
    }, el);
    return () => ctx.revert();
  }, [skip]);

  if (skip) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-6">
        <div data-block className="overflow-clip">
          <img data-word src="/im/logo.png" alt="" width={418} height={413} className="h-16 w-auto" />
        </div>
        <div className="font-sans text-xs tabular-nums text-smoke">
          <span data-count>0</span>%
        </div>
      </div>
    </div>
  );
}
