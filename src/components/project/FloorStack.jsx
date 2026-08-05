/**
 * The signature sequence: the architect's actual floor plans, one residence
 * per floor, presented as a pinned deck that advances as you scroll —
 * B1 garden residence up to the roof, with a held beat on the roof before
 * the pin releases.
 *
 * Layout contract: the absolute stacking exists only under
 * `motion-safe:lg:` — small screens AND reduced-motion desktops both get the
 * plain stacked flow, so no combination of settings can superimpose panels
 * or strand content. Panels animate opacity (never visibility) and toggle
 * aria-hidden/pointer-events from the scrub, so assistive tech always has
 * exactly the visible residence.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { gsap, reducedMotion } from "../../lib/motion";
import { project } from "../../data/content";

const MARKS = ["B1", "GF", "F1", "RF"];

/** Stamp styling per state. The word is the record; the colour just ranks it. */
const AVAILABILITY = {
  available: { label: "Available", cls: "border-pmcc/70 text-pmcc" },
  reserved: { label: "Reserved", cls: "border-stone/70 text-stone" },
  sold: { label: "Sold", cls: "border-smoke/40 text-smoke/70" },
};
/** Extra scroll (in viewport-heights) the roof residence is held before release. */
const DWELL = 0.6;

export default function FloorStack() {
  const section = useRef(null);
  const pinTarget = useRef(null);
  const [active, setActive] = useState(0);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const panels = gsap.utils.toArray("[data-floor]");
        const steps = panels.length - 1;

        const setPanelState = (index) => {
          panels.forEach((p, i) => {
            p.setAttribute("aria-hidden", i === index ? "false" : "true");
            p.style.pointerEvents = i === index ? "auto" : "none";
          });
        };
        gsap.set(panels.slice(1), { opacity: 0 });
        setPanelState(0);

        const tl = gsap.timeline({
          scrollTrigger: {
            // Pin the inner wrapper, never the section: pinning re-parents
            // the element into a pin-spacer, and React must keep owning the
            // section's position among its siblings.
            trigger: pinTarget.current,
            start: "top top",
            end: () => `+=${(steps + DWELL) * window.innerHeight}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const idx = Math.min(steps, Math.round(self.progress * (steps + DWELL)));
              setActive(idx);
              setPanelState(idx);
            },
          },
        });

        panels.forEach((panel, i) => {
          if (i === 0) return;
          const prev = panels[i - 1];
          const plan = panel.querySelector("[data-plan]");
          const text = panel.querySelector("[data-text]");
          tl.to(prev, { opacity: 0, yPercent: -4, duration: 0.45 }, i - 0.5)
            .fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.45 }, i - 0.35)
            .fromTo(
              plan,
              { yPercent: 9, scale: 0.97 },
              { yPercent: 0, scale: 1, duration: 0.55, ease: "power2.out" },
              i - 0.35,
            )
            .fromTo(
              text,
              { y: 34, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" },
              i - 0.25,
            );
        });
        // The held beat: timeline space after the last transition, so the
        // roof residence rests composed before the section scrolls away.
        tl.to({}, { duration: DWELL });

        return () => {
          panels.forEach((p) => {
            p.removeAttribute("aria-hidden");
            p.style.pointerEvents = "";
          });
        };
      });
    }, section.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={section} className="bg-ink">
      <div
        ref={pinTarget}
        className="relative motion-safe:lg:h-screen motion-safe:lg:overflow-clip"
      >
      <div className="px-5 pt-20 sm:px-8 motion-safe:lg:absolute motion-safe:lg:inset-x-0 motion-safe:lg:top-0 motion-safe:lg:z-10 motion-safe:lg:pt-24">
        <p className="type-eyebrow text-smoke">The residences</p>
        <h2 className="type-display mt-4 max-w-5xl text-[clamp(1.8rem,3.4vw,3rem)] text-bone">
          Four floors. Four homes.{" "}
          <em className="type-display-it text-stone">No neighbours on your landing.</em>
        </h2>
      </div>

      {/* progress rail — pinned desktop only */}
      <div className="absolute left-5 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-4 sm:left-8 motion-safe:lg:flex">
        {MARKS.map((m, i) => (
          <span
            key={m}
            className={`font-sans text-xs tabular-nums transition-colors duration-300 ${
              i === active ? "text-pmcc" : "text-smoke/50"
            }`}
          >
            {m}
          </span>
        ))}
      </div>

      <div className="relative mt-12 motion-safe:lg:mt-0 motion-safe:lg:h-full">
        {project.floors.map((f, i) => (
          <article
            key={f.id}
            data-floor
            className="mb-20 grid gap-8 px-5 sm:px-8 motion-safe:lg:absolute motion-safe:lg:inset-0 motion-safe:lg:mb-0 motion-safe:lg:grid-cols-[1.25fr_1fr] motion-safe:lg:items-center motion-safe:lg:gap-14 motion-safe:lg:px-24 motion-safe:lg:pb-[5vh] motion-safe:lg:pt-[clamp(14rem,24vh,19rem)]"
          >
            <a
              data-plan
              href={f.plan}
              target="_blank"
              rel="noreferrer"
              className="block bg-bone p-2 shadow-2xl shadow-black/40 transition-transform duration-300 hover:scale-[1.01] sm:p-3"
              aria-label={`Open the full-resolution ${f.level} plan`}
            >
              <img
                src={f.plan}
                alt={`${f.name} floor plan, ${f.level}`}
                width={2200}
                height={1420}
                className="mx-auto w-full motion-safe:lg:max-h-[min(44vh,calc(100svh-28rem))] motion-safe:lg:w-auto motion-safe:lg:object-contain"
                loading={i === 0 ? "eager" : "lazy"}
              />
              <span className="mt-2 block px-1 font-sans text-[0.65rem] uppercase tracking-wideish text-ink/50">
                {f.level} plan · tap to enlarge
              </span>
            </a>
            <div data-text>
              <div className="flex items-center gap-4">
                <p className="type-eyebrow text-stone">{f.level}</p>
                {AVAILABILITY[f.availability] && (
                  <span
                    className={`inline-block border px-2.5 py-1 font-sans text-[0.6rem] font-semibold uppercase tracking-wideish ${AVAILABILITY[f.availability].cls}`}
                  >
                    {AVAILABILITY[f.availability].label}
                  </span>
                )}
              </div>
              <h3 className="type-display mt-3 text-3xl text-bone sm:text-4xl">{f.name}</h3>
              <p className="mt-5 max-w-md font-sans text-sm leading-relaxed text-smoke">{f.brief}</p>
              {f.specs && (
                <ul className="mt-6 flex flex-wrap gap-2">
                  {f.specs.map(([k, v]) => (
                    <li
                      key={k}
                      className="border border-seam px-3 py-1.5 font-sans text-[0.65rem] uppercase tracking-wideish text-smoke"
                    >
                      {k} · <span className="font-semibold text-bone">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
              <ul className="mt-6 space-y-2">
                {f.features.map((feat) => (
                  <li key={feat} className="flex items-baseline gap-3 font-sans text-xs text-bone/80">
                    <span aria-hidden className="inline-block h-[3px] w-[14px] shrink-0 translate-y-[-2px] bg-pmcc" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
      </div>
    </section>
  );
}
