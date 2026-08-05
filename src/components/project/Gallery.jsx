/**
 * The building as a horizontal museum wall. One pinned strip; vertical scroll
 * drags the plates past in the order you would walk the site. Every image is
 * mounted in a fixed frame — one shared height, widths set by a composed
 * rhythm, never by the image's own aspect — so the wall reads as one curated
 * line, not a pile of mismatched prints. The render drifts inside its frame
 * against the travel for depth, and a counter + hairline track the walk.
 *
 * On small screens and reduced-motion it is a swipeable snap row of
 * uniform-height plates; the pin is a desktop instrument.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { gsap, reducedMotion } from "../../lib/motion";
import { project } from "../../data/content";

/**
 * Frame widths per plate, chosen against each render's composition: wide
 * stages for the elevations, a tall slot for the portrait, a near-square
 * for the entrance walk. The rhythm — broad, narrow, broad — is the design.
 */
const FRAMES = [
  "motion-safe:lg:w-[46vw]",
  "motion-safe:lg:w-[40vw]",
  "motion-safe:lg:w-[31vw]",
  "motion-safe:lg:w-[48vw]",
  "motion-safe:lg:w-[52vw]",
  "motion-safe:lg:w-[30vw]",
];
/** Alternating shelf offsets — a hung wall, not a filmstrip. */
const SHELF = [
  "motion-safe:lg:-translate-y-[2.5vh]",
  "motion-safe:lg:translate-y-[2.5vh]",
];

export default function Gallery() {
  const section = useRef(null);
  const pinTarget = useRef(null);
  const track = useRef(null);
  const bar = useRef(null);
  const [active, setActive] = useState(0);
  const count = project.gallery.length;

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const distance = () => track.current.scrollWidth - window.innerWidth;
        gsap.to(track.current, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: pinTarget.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              if (bar.current) bar.current.style.transform = `scaleX(${self.progress})`;
              setActive(Math.min(count - 1, Math.round(self.progress * (count - 1))));
            },
          },
        });
        // Each image drifts inside its frame against the travel — depth
        // without a single layout-affecting property.
        gsap.utils.toArray("[data-slide] img").forEach((img) => {
          gsap.fromTo(
            img,
            { xPercent: -6 },
            {
              xPercent: 6,
              ease: "none",
              scrollTrigger: {
                trigger: section.current,
                start: "top top",
                end: () => `+=${distance()}`,
                scrub: 1,
              },
            },
          );
        });
      });
    }, section.current);
    return () => ctx.revert();
  }, [count]);

  return (
    <section ref={section} className="bg-ink">
      <div ref={pinTarget} className="overflow-clip motion-safe:lg:h-screen">
        <div className="flex items-baseline justify-between px-5 pt-20 sm:px-8 motion-safe:lg:pt-24">
          <p className="type-eyebrow text-smoke">The building</p>
          <p
            className="hidden font-sans text-xs tabular-nums text-smoke motion-safe:lg:block"
            aria-hidden="true"
          >
            <span className="text-bone">{String(active + 1).padStart(2, "0")}</span>
            {" / "}
            {String(count).padStart(2, "0")}
          </p>
        </div>
        <div
          ref={track}
          className="no-scrollbar mt-8 flex w-auto snap-x snap-mandatory items-center gap-5 overflow-x-auto px-5 pb-10 sm:px-8 motion-safe:lg:w-max motion-safe:lg:snap-none motion-safe:lg:overflow-visible motion-safe:lg:gap-8 motion-safe:lg:pb-0 motion-safe:lg:pr-[18vw]"
        >
          {project.gallery.map((g, i) => (
            <figure
              key={g.src}
              data-slide
              className={`w-[84vw] shrink-0 snap-center sm:w-[64vw] motion-safe:lg:shrink-0 ${FRAMES[i % FRAMES.length]} ${SHELF[i % 2]}`}
            >
              {/* The fixed plate: one height everywhere, so the wall is even. */}
              <div className="h-[52svh] overflow-clip sm:h-[56svh] motion-safe:lg:h-[60vh]">
                <img
                  src={g.src}
                  srcSet={`${g.small} 1280w, ${g.src} ${g.w}w`}
                  sizes="(min-width: 1024px) 52vw, 84vw"
                  alt={g.alt}
                  width={g.w}
                  height={g.h}
                  loading="lazy"
                  className="h-full w-full scale-[1.14] object-cover"
                />
              </div>
              <figcaption className="mt-3 flex items-baseline gap-3 font-sans text-xs text-smoke">
                <span className="tabular-nums text-pmcc">{String(i + 1).padStart(2, "0")}</span>
                {g.alt}
              </figcaption>
            </figure>
          ))}
        </div>
        {/* The walk's progress, as a hairline — desktop only, the pin's companion. */}
        <div className="mx-8 mt-6 hidden h-px bg-seam motion-safe:lg:block">
          <div
            ref={bar}
            className="h-full origin-left bg-pmcc"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      </div>
    </section>
  );
}
