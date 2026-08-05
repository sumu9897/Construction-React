import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { applySeo } from "../lib/seo";
import { gsap, reducedMotion } from "../lib/motion";
import { Lines, Fade } from "../components/reveal";
import WarpImage from "../components/WarpImage";
import Timeline from "../components/home/Timeline";
import Booklet from "../components/home/Booklet";
import { heroClaim, stats, services, clients, project } from "../data/content";

function Hero() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-hero-strip]",
        { clipPath: "inset(0 0 100% 0)" },
        { clipPath: "inset(0 0 0% 0)", duration: 1.2, delay: 0.5, ease: "power4.inOut" },
      );
      gsap.fromTo(
        "[data-hero-sub]",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 1, delay: 0.7 },
      );
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="grid h-[100svh] grid-rows-[minmax(0,1fr)_auto] bg-ink pt-[64px]">
      <div data-hero-copy className="flex min-h-0 flex-col justify-center overflow-clip px-5 sm:px-8">
        <Fade delay={0.35}>
          <p className="type-eyebrow text-smoke">{heroClaim.eyebrow}</p>
        </Fade>
        <Lines
          as="h1"
          trigger={false}
          delay={0.35}
          className="type-display mt-[2svh] text-[clamp(2.4rem,min(8vw,10.5svh),7.2rem)] text-bone"
        >
          {heroClaim.lines[0]}
          <br />
          <em className="type-display-it text-stone">{heroClaim.lines[1]}</em>
        </Lines>
        <div className="mt-[3svh] flex items-end justify-between gap-8 pb-[2svh]">
          <p data-hero-sub className="max-w-md font-sans text-sm leading-relaxed text-smoke">
            {heroClaim.sub}
          </p>
          <p className="type-eyebrow hidden shrink-0 text-smoke sm:block" aria-hidden="true">
            Scroll ↓
          </p>
        </div>
      </div>
      <div data-hero-strip className="relative z-10 h-[38svh]">
        <WarpImage
          src="/im/hero-reveal-2560.webp"
          srcSet="/im/hero-reveal-1280.webp 1280w, /im/hero-reveal-2560.webp 2560w"
          alt="A concrete frame at first light, in the quiet hours of a build"
          className="h-full"
          priority
        />
      </div>
    </section>
  );
}

function Stats() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.utils.toArray("[data-stat]").forEach((el) => {
        const raw = el.dataset.stat;
        const num = parseInt(raw, 10);
        if (Number.isNaN(num)) return;
        gsap.fromTo(
          el,
          { textContent: 0 },
          {
            textContent: num,
            duration: 1.6,
            ease: "power2.out",
            snap: { textContent: 1 },
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
            onUpdate() {
              el.textContent = `${Math.round(gsap.getProperty(el, "textContent"))}${raw.replace(/^\d+/, "")}`;
            },
          },
        );
      });
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="border-y border-seam bg-ink px-5 py-16 sm:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-12">
        {stats.map((s) => (
          <Fade key={s.label}>
            <p data-stat={s.value} className="type-display text-5xl text-bone sm:text-6xl">
              {s.value}
            </p>
            <p className="mt-3 max-w-[16rem] font-sans text-xs leading-relaxed text-smoke">
              {s.label}
            </p>
          </Fade>
        ))}
      </div>
    </section>
  );
}

function Services() {
  return (
    <section className="bg-ink px-5 pb-28 pt-14 sm:pt-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">What we do</p>
        <div className="mt-10">
          {services.map((s) => (
            <Fade
              key={s.n}
              className="group grid gap-4 border-t border-seam py-10 last:border-b sm:grid-cols-[6rem_1fr_1.2fr] sm:gap-8"
            >
              <p className="font-sans text-sm text-smoke transition-colors duration-300 group-hover:text-pmcc">
                {s.n}
              </p>
              <h3 className="type-display text-3xl text-bone transition-transform duration-500 ease-out-expo group-hover:translate-x-2 sm:text-4xl">
                {s.title}
              </h3>
              <p className="max-w-md font-sans text-sm leading-relaxed text-smoke sm:pt-2">{s.body}</p>
            </Fade>
          ))}
        </div>
      </div>
    </section>
  );
}

function Clients() {
  // Slugs whose /im/logos/<slug>.png failed to load fall back to wordmarks.
  const [failed, setFailed] = useState(() => new Set());
  const row = [...clients, ...clients, ...clients];
  return (
    // The label is positioned rather than stacked, so the only thing in the
    // normal flow is the belt itself. Equal padding then lands the logos on the
    // exact centre line between the rule above and the panel below - stacked,
    // the label's own height pushed them a third of the band too low.
    <section className="relative overflow-clip bg-ink pb-10 pt-14 sm:py-16" aria-label="Selected clients">
      <p className="type-eyebrow absolute left-5 top-6 text-smoke sm:left-8 sm:top-7">
        Clients we&rsquo;ve built for
      </p>
      <div className="marquee flex w-max items-center pr-0">
        {row.map((c, i) => (
          <span
            key={`${c.slug}-${i}`}
            className="flex items-center"
            aria-hidden={i >= clients.length}
          >
            {failed.has(c.slug) ? (
              <span className="type-display whitespace-nowrap text-[clamp(1.7rem,3.8vw,3.1rem)] text-stone">
                {c.name}
              </span>
            ) : (
              <img
                src={`/im/logos/${c.slug}.png`}
                alt={c.name}
                className="h-10 w-auto opacity-80 sm:h-16 xl:h-20"
                loading="lazy"
                onError={() =>
                  setFailed((prev) => {
                    const next = new Set(prev);
                    next.add(c.slug);
                    return next;
                  })
                }
              />
            )}
            <span aria-hidden className="mx-10 inline-block h-1.5 w-1.5 rounded-full bg-pmcc sm:mx-20 xl:mx-24" />
          </span>
        ))}
      </div>
      <style>{`
        .marquee { animation: marquee-x 48s linear infinite; }
        @keyframes marquee-x { to { transform: translateX(-33.333%); } }
        @media (prefers-reduced-motion: reduce) { .marquee { animation: none; } }
      `}</style>
    </section>
  );
}

/** The red box under the book: the one thing on this page that sells. */
function DevelopmentPromo() {
  return (
    <section className="bg-ink px-5 pb-24 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Fade>
          <Link
            to="/daher-el-souane-563"
            data-cursor="view"
            className="group flex flex-col justify-between gap-6 bg-pmcc p-8 transition-transform duration-500 ease-out-expo hover:scale-[1.01] sm:flex-row sm:items-center sm:p-10"
          >
            <div>
              <p className="type-eyebrow text-bone/80">Our own development · now selling</p>
              <p className="type-display mt-3 text-3xl text-bone sm:text-4xl">
                {project.name} · {project.claim[0].toLowerCase()}{" "}
                <em className="type-display-it">{project.claim[1]}</em>
              </p>
            </div>
            <span
              aria-hidden
              className="type-display shrink-0 text-4xl text-bone transition-transform duration-500 ease-out-expo group-hover:translate-x-3"
            >
              →
            </span>
          </Link>
        </Fade>
      </div>
    </section>
  );
}

export default function Home() {
  // Client-side navigation leaves the baked-in <head> describing the wrong
  // page; put it right. Scrapers read the baked copy, Google reads this.
  useLayoutEffect(() => applySeo("home"), []);

  return (
    <>
      <Hero />
      <Stats />
      <Clients />
      <Services />
      <Timeline />
      <Booklet />
      <DevelopmentPromo />
    </>
  );
}
