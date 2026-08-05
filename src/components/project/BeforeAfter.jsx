/**
 * Drag-to-compare: the construction site today against the finished
 * building, same angle. The divider follows the pointer with eased motion,
 * and a visually-hidden range input drives the same value for keyboard and
 * assistive tech.
 *
 * The section renders only when the site photo exists at
 * /im/site-progress-1280.webp — no placeholder, no fake imagery. Drop the
 * drone photo there and this section appears on its own.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "../../lib/motion";
import { Fade } from "../reveal";

// The owner's drone pair: the structure on site today, and the finished
// building montaged into the same hillside.
const BEFORE = "/im/site-progress-1280.webp";
const AFTER = "/im/site-finished-1280.webp";

export default function BeforeAfter() {
  const [available, setAvailable] = useState(null);
  const frame = useRef(null);
  const topImg = useRef(null);
  const handle = useRef(null);
  const pos = useRef(50);
  const setters = useRef(null);

  useLayoutEffect(() => {
    const probe = new Image();
    probe.onload = () => setAvailable(true);
    probe.onerror = () => setAvailable(false);
    probe.src = BEFORE;
  }, []);

  useLayoutEffect(() => {
    if (!available) return undefined;
    // The section just became visible and added its height to the page —
    // every trigger measured below it is now stale.
    requestAnimationFrame(() => ScrollTrigger.refresh());
    // Tween a proxy value; clip-path strings and % positions are derived from
    // it every frame. quickTo can't ease non-numeric properties.
    const state = { p: pos.current };
    const apply = () => {
      if (!topImg.current || !handle.current) return;
      topImg.current.style.clipPath = `inset(0 ${100 - state.p}% 0 0)`;
      handle.current.style.left = `${state.p}%`;
    };
    apply();
    setters.current = (pct) => {
      pos.current = pct;
      gsap.to(state, { p: pct, duration: 0.35, ease: "power3.out", overwrite: true, onUpdate: apply });
    };
    return () => {
      gsap.killTweensOf(state);
      setters.current = null;
    };
  }, [available]);

  const fromEvent = (e) => {
    const r = frame.current.getBoundingClientRect();
    const pct = gsap.utils.clamp(2, 98, ((e.clientX - r.left) / r.width) * 100);
    setters.current?.(pct);
  };

  // Never mount this section late: inserting a node before a GSAP-pinned
  // sibling crashes React's reconciler (the sibling was re-parented into a
  // pin-spacer). The section is always in the tree; only visibility changes.
  return (
    <section hidden={!available} className="bg-coal px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">On site now</p>
        <h2 className="type-display mt-6 text-[clamp(2rem,4.6vw,3.8rem)] text-bone">
          Drag between today <em className="type-display-it text-stone">and the day you move in.</em>
        </h2>
        <Fade className="mt-12">
          <div
            ref={frame}
            className="relative cursor-ew-resize touch-pan-y overflow-clip select-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              fromEvent(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) fromEvent(e);
            }}
          >
            <img src={AFTER} alt="Daher el Souane 563, the finished building" className="w-full" draggable="false" />
            <img
              ref={topImg}
              src={BEFORE}
              alt="Daher el Souane 563, the site under construction"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: "inset(0 50% 0 0)" }}
              draggable="false"
            />
            <div ref={handle} className="absolute inset-y-0" style={{ left: "50%" }}>
              <div className="absolute inset-y-0 -ml-px w-[2px] bg-bone/90" />
              <div className="absolute top-1/2 -ml-6 -mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-pmcc font-sans text-xs font-bold text-bone shadow-lg">
                ⇄
              </div>
            </div>
            <p className="pointer-events-none absolute bottom-4 left-4 bg-ink/70 px-3 py-1 font-sans text-[0.65rem] uppercase tracking-wideish text-bone">
              On site
            </p>
            <p className="pointer-events-none absolute bottom-4 right-4 bg-ink/70 px-3 py-1 font-sans text-[0.65rem] uppercase tracking-wideish text-bone">
              Completed
            </p>
            <input
              type="range"
              min="2"
              max="98"
              defaultValue="50"
              aria-label="Compare the site today with the finished building"
              className="sr-only"
              onChange={(e) => setters.current?.(Number(e.target.value))}
            />
          </div>
        </Fade>
      </div>
    </section>
  );
}
