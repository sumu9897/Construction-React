import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { applySeo } from "../lib/seo";
import { gsap, reducedMotion } from "../lib/motion";
import { Lines, Fade } from "../components/reveal";
import Magnetic from "../components/Magnetic";
import WarpImage from "../components/WarpImage";
import FloorStack from "../components/project/FloorStack";
import BeforeAfter from "../components/project/BeforeAfter";
import Gallery from "../components/project/Gallery";
import LeadForm from "../components/LeadForm";
import ShareButton from "../components/ShareButton";
import { project, company, book563 } from "../data/content";
import { track } from "../lib/analytics";

function ProjectHero() {
  return (
    <section className="relative h-[100svh]">
      <WarpImage
        src="/im/hero-three-quarter-3200.webp"
        srcSet="/im/hero-three-quarter-1280.webp 1280w, /im/hero-three-quarter-2560.webp 2560w, /im/hero-three-quarter-3200.webp 3200w"
        alt={project.gallery[0].alt}
        className="h-full"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-ink/45" />
      <div className="absolute inset-x-0 bottom-0 px-5 pb-16 sm:px-8">
        <Fade delay={0.3}>
          <p className="type-eyebrow text-bone/90">{project.eyebrow}</p>
        </Fade>
        <Lines
          as="h1"
          trigger={false}
          delay={0.45}
          className="type-display mt-6 max-w-5xl text-[clamp(3rem,10vw,9rem)] text-bone"
        >
          {project.claim[0]}
          <br />
          <em className="type-display-it text-stone">{project.claim[1]}</em>
        </Lines>
        <Fade delay={0.9} className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-md font-sans text-sm leading-relaxed text-bone/80">{project.sub}</p>
          <p className="type-eyebrow text-smoke" aria-hidden="true">Scroll ↓</p>
        </Fade>
      </div>
    </section>
  );
}

/**
 * Introduction: the book's opening plate edge to edge, a short summary in
 * place of the long narrative, then the four residences stacked like the
 * building itself — roof at the top, garden at the bottom.
 */
function Introduction() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-intro-img]",
        { scale: 1.14, yPercent: 4 },
        {
          scale: 1,
          yPercent: -3,
          ease: "none",
          scrollTrigger: { trigger: "[data-intro-frame]", start: "top bottom", end: "bottom top", scrub: 1 },
        },
      );
    }, root.current);
    return () => ctx.revert();
  }, []);

  const stack = [...project.floors].reverse();
  const widths = ["sm:w-[70%]", "sm:w-[84%]", "sm:w-[94%]", "sm:w-full"];
  const spec = (f, key) => f.specs.find(([k]) => k === key)?.[1] ?? "—";

  return (
    <section ref={root} className="bg-ink py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="type-eyebrow text-smoke">Introduction</p>
        <Lines className="type-display mt-6 max-w-4xl text-[clamp(2.2rem,5.4vw,4.4rem)] text-bone">
          Dahr el Sawan <em className="type-display-it text-stone">private residences.</em>
        </Lines>
      </div>

      {/* The plate, edge to edge — no margins. */}
      <div data-intro-frame className="mt-12 overflow-clip">
        <img
          data-intro-img
          src={book563.intro.src}
          srcSet={`${book563.intro.small} 1000w, ${book563.intro.src} 1420w`}
          sizes="100vw"
          alt={book563.intro.alt}
          width={book563.intro.w}
          height={book563.intro.h}
          loading="lazy"
          className="h-[58svh] w-full object-cover will-change-transform sm:h-[78svh]"
        />
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Fade className="mt-14">
          <p className="max-w-2xl font-sans text-base leading-relaxed text-bone/85">
            A gated development on the green ridge above the coast, twenty minutes from
            Beirut and a world away from it. One boutique building, four full-floor
            residences, gardens terraced into the hillside, and an elevator to every level.
          </p>
          <p className="mt-4 font-sans text-xs uppercase tracking-wideish text-smoke">
            Architecture · {project.architect}
          </p>
        </Fade>

        {/* What is for sale, drawn as the building: one residence per floor. */}
        <Fade className="mt-20">
          <h3 className="type-display text-center text-2xl text-bone sm:text-3xl">
            Four residences, <em className="type-display-it text-stone">one per floor.</em>
          </h3>
        </Fade>
        <div className="mx-auto mt-10 max-w-3xl">
          {stack.map((f, i) => (
            <Fade key={f.id} className={`ml-auto w-full ${widths[i]} ${i ? "-mt-px" : ""}`}>
              {/* All rows share the right edge, and the two value cells have
                  fixed widths — so Indoor and Garden stack perfectly. */}
              <div className="flex items-baseline gap-x-3 border border-seam bg-coal px-4 py-4 transition-colors duration-300 hover:border-stone sm:px-7 sm:py-5">
                <span className="type-display truncate text-lg text-bone sm:text-xl">{f.level}</span>
                <span className="ml-auto flex shrink-0 items-baseline gap-4 font-sans text-xs tabular-nums sm:gap-8">
                  <span className="flex w-[6.4rem] items-baseline justify-between sm:w-[7.5rem]">
                    <span className="text-[0.6rem] uppercase tracking-wideish text-stone">Indoor</span>
                    <span className="text-bone/90">{spec(f, "Area")}</span>
                  </span>
                  <span className="flex w-[6rem] items-baseline justify-between sm:w-[7rem]">
                    <span className="text-[0.6rem] uppercase tracking-wideish text-stone">Garden</span>
                    <span className="text-bone/90">{spec(f, "Garden")}</span>
                  </span>
                </span>
              </div>
            </Fade>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The real photograph from the site, full bleed, with the altitude counting
 * itself up as the section scrolls in. Renders sell the building; this photo
 * sells the reason the building is here.
 */
function TheView() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      const el = root.current.querySelector("[data-altitude]");
      gsap.fromTo(
        el,
        { textContent: 0 },
        {
          textContent: Number(project.location.altitude),
          duration: 2,
          ease: "power2.out",
          snap: { textContent: 1 },
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        },
      );
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative">
      <div className="relative h-[92svh] overflow-clip">
        <WarpImage
          src="/im/view-ridge-3200.webp"
          srcSet="/im/view-ridge-1280.webp 1280w, /im/view-ridge-2444.webp 2444w, /im/view-ridge-3200.webp 3200w"
          alt="The view from the site, over the Metn valley and the mountains beyond, photographed at Daher el Souane"
          className="h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-ink/30" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-14 sm:px-8">
          <p className="type-eyebrow text-bone/90">The view · photographed on site</p>
          <p className="type-display mt-4 text-[clamp(3.4rem,11vw,9rem)] leading-none text-bone">
            <span data-altitude>{project.location.altitude}</span>
            <span className="text-stone"> m</span>
          </p>
          <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-bone/85">
            above the sea. The valley below, the mountains across, and Beirut twenty
            minutes down the hill.
          </p>
        </div>
      </div>
    </section>
  );
}

/** The book's own pictograms, redrawn as line icons — one per category. */
function SpecIcon({ name, className = "h-9 w-9" }) {
  const P = { stroke: "currentColor", strokeWidth: 1.4, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    "Envelope finishes": (
      <>
        <rect {...P} x="5" y="7" width="22" height="18" />
        <path {...P} d="M5 13h22M5 19h22M12 7v6M20 13v6M12 19v6M20 7v6M12 13h0" />
      </>
    ),
    Flooring: <path {...P} d="M5 14l7-7 7 7M5 20l7-7 7 7M12 27l7-7 7 7M19 20l4-4 4 4" />,
    Bathrooms: (
      <>
        <rect {...P} x="6" y="5" width="9" height="8" rx="1" />
        <path {...P} d="M6 16h18a8 8 0 0 1-8 8h-3a7 7 0 0 1-7-7v-1zM12 24l-1 3h7l-1-3" />
      </>
    ),
    "Walls & ceilings": (
      <>
        <path {...P} d="M6 10l10-5 10 5-10 5-10-5z" />
        <path {...P} d="M6 10v11l10 5V15M26 10v11l-10 5" />
      </>
    ),
    Woodwork: (
      <>
        <rect {...P} x="5" y="8" width="22" height="16" rx="1" />
        <path {...P} d="M10 12c3 2 3 6 0 8M19 11c4 3 4 8 0 10M24 13v6" />
      </>
    ),
    "Electro-mechanical": <path {...P} d="M17 4L9 18h6l-2 10 10-16h-6l2-8z" />,
    Elevator: (
      <>
        <rect {...P} x="7" y="7" width="18" height="20" />
        <path {...P} d="M16 7v20M11 12l1.5-2 1.5 2M11 15h3M20 19h-1.5m1.5 3l-1.5 2-1.5-2" />
      </>
    ),
    "Fixtures & fittings": (
      <>
        <path {...P} d="M8 13h9a6 6 0 0 1 6 6v2M11 13V9h6M14 9V5h6" />
        <path {...P} d="M23 26a1.8 1.8 0 0 1-3.6 0c0-1.2 1.8-3 1.8-3s1.8 1.8 1.8 3z" />
      </>
    ),
    "General facilities": (
      <>
        <circle {...P} cx="16" cy="11" r="4.5" />
        <path {...P} d="M11 9h10M16 4v2.5M6 27c0-6 4.7-9 10-9s10 3 10 9" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      {icons[name] ?? <circle {...P} cx="16" cy="16" r="10" />}
    </svg>
  );
}

/** The general specification, laid out as the book's General Specs page:
 *  a light sheet, category pictograms, plain bulleted facts. */
function TheStandard() {
  return (
    <section className="bg-bone px-5 py-28 text-ink sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-ink/60">From the project book</p>
        <Lines className="type-display mt-6 max-w-4xl text-[clamp(2rem,4.8vw,3.8rem)]">
          General <em className="type-display-it">specs.</em>
        </Lines>
        <div className="mt-14 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {book563.specs.map((g) => (
            <Fade key={g.title}>
              <SpecIcon name={g.title} className="h-9 w-9 text-ink/65" />
              <p className="mt-4 font-sans text-xs font-bold uppercase tracking-wideish text-ink">
                {g.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {g.items.map((item) => (
                  <li key={item} className="flex items-baseline gap-2.5 font-sans text-sm leading-relaxed text-ink/70">
                    <span aria-hidden className="inline-block h-1 w-1 shrink-0 -translate-y-[3px] rounded-full bg-ink/40" />
                    {item}
                  </li>
                ))}
              </ul>
            </Fade>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The location, laid out as the project book lays it out: Lebanon in the
 * middle with the site marked, its sight-lines fanning out into the two
 * satellite maps — country, then area, then the site itself. The maps
 * land like pinned photographs, with a slight tilt that rights itself.
 */
function LocationSpread() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-lebanon]",
        { autoAlpha: 0, y: 40 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: "[data-lebanon]", start: "top 88%", once: true },
        },
      );
      gsap.utils.toArray("[data-map]").forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: 70, autoAlpha: 0, rotate: i % 2 ? 2 : -2 },
          {
            y: 0,
            autoAlpha: 1,
            rotate: 0,
            duration: 1.1,
            delay: i * 0.15,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          },
        );
      });
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="border-t border-seam bg-ink px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">The location</p>
        <Lines className="type-display mt-6 max-w-3xl text-[clamp(1.9rem,4.2vw,3.4rem)] text-bone">
          In the green hills <em className="type-display-it text-stone">above Beirut.</em>
        </Lines>
        <Fade className="mt-6">
          <p className="max-w-2xl font-sans text-sm leading-relaxed text-smoke">{book563.locationBlurb}</p>
        </Fade>
        <Fade className="mt-10">
          <div className="flex items-baseline justify-between gap-x-3 sm:justify-start sm:gap-x-10">
            {project.location.driveTimes.map((d) => (
              <p key={d.place} className="flex items-baseline gap-1.5 whitespace-nowrap sm:gap-2">
                <span className="type-display text-xl text-bone sm:text-3xl">{d.minutes}</span>
                <span className="font-sans text-[0.65rem] text-smoke sm:text-xs">min</span>
                <span className="font-sans text-[0.65rem] uppercase tracking-wideish text-smoke sm:text-xs">{d.place}</span>
              </p>
            ))}
          </div>
          <p className="mt-2 font-sans text-[0.65rem] text-smoke/70">{project.location.note}</p>
          <a
            href="https://www.google.com/maps/search/?api=1&query=VMX8%2B9V7%2C+Dahr+El+Souane%2C+Lebanon"
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center gap-3 bg-pmcc px-7 py-3.5 font-sans text-sm font-semibold text-bone"
          >
            Open in Google Maps
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </a>
        </Fade>
        {/* The country and the area, side by side: Lebanon's sight-lines
            point straight into the satellite map beside it. */}
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] items-center gap-2 sm:gap-4">
          <img
            data-lebanon
            src="/im/dsw-lebanon.webp"
            alt="Lebanon, with the project location marked in the hills above Beirut at Dahr el Sawan"
            loading="lazy"
            className="w-full max-w-[260px] justify-self-end"
          />
          <figure data-map>
            <div className="border border-seam bg-coal p-2">
              <img src={book563.map.src} alt={book563.map.alt} loading="lazy" className="w-full" />
            </div>
            <figcaption className="mt-2.5 font-sans text-xs leading-relaxed text-smoke">
              {book563.map.caption}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: "When is the building delivered?",
      a: "Summer 2027. Our own team runs the programme, the same way we have run client projects since 1996.",
    },
    {
      q: "How does payment work?",
      a: "A deposit reserves your residence. The balance is settled on completion, and the detailed schedule comes with the price list.",
    },
    {
      q: "Who is behind the project?",
      a: "PMCC is the developer, the manager and the builder. One company, accountable since 1996. Past clients include Microsoft, MEDCO, McDonald's and Arab Investment Bank. Architecture by A20/partners.",
    },
    {
      q: "How private is 'one residence per floor'?",
      a: "The elevator opens to your floor. There is no shared landing and no neighbour behind a facing door. Four families in the whole building, each with a full floor.",
    },
    {
      q: "Can I visit the site?",
      a: "Yes, and we encourage it. Message us on WhatsApp and we'll arrange a visit.",
    },
    {
      q: "Is the project permitted?",
      a: "Fully permitted. The company that holds the permit is the same company that builds.",
    },
    {
      q: "How do I get areas, finishes and pricing?",
      a: "Leave your number in the form above or message us on WhatsApp. The full price list, floor areas and finishes come to you the same day.",
    },
  ];
  return (
    <section className="border-t border-seam bg-ink px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="type-eyebrow text-smoke">Before you ask</p>
        <h2 className="type-display mt-6 text-[clamp(1.9rem,4.2vw,3.2rem)] text-bone">
          The questions every buyer asks{" "}
          <em className="type-display-it text-stone">answered straight.</em>
        </h2>
        <div className="mt-10">
          {items.map((item) => (
            <details key={item.q} className="group border-t border-seam last:border-b">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-5 font-sans text-sm font-semibold text-bone transition-colors hover:text-stone [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="shrink-0 text-pmcc transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-xl pb-6 font-sans text-sm leading-relaxed text-smoke">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Availability() {
  const total = project.floors.length;
  const remaining = project.floors.filter((f) => f.availability !== "sold").length;
  const summary =
    remaining === total
      ? "All four residences are currently available."
      : `${remaining} of ${total} residences remain.`;

  return (
    <section id="enquire" className="bg-bone px-5 py-28 text-ink sm:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="type-eyebrow text-ink/65">Availability</p>
        <Lines className="type-display mx-auto mt-8 max-w-3xl text-[clamp(2.2rem,5.4vw,4.6rem)]">
          Four residences. <em className="type-display-it">One per floor.</em>
        </Lines>
        <Fade className="mx-auto mt-6 max-w-md">
          <p className="font-sans text-sm leading-relaxed text-ink/70">
            {summary} Fully permitted. {project.onRequest}
          </p>
        </Fade>
        <Fade className="mt-12">
          <LeadForm tone="light" source="project" showWhatsApp={false} />
        </Fade>
        <Fade className="mt-8 flex justify-center">
          <Magnetic>
            <a
              href={`https://wa.me/${company.whatsapp}?text=${encodeURIComponent(
                "Hello PMCC — I'm interested in Daher el Souane 563.",
              )}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("whatsapp_click", { source: "project-availability" })}
              className="inline-flex items-center gap-3 bg-ink px-8 py-4 font-sans text-sm font-semibold text-bone"
            >
              Or enquire on WhatsApp →
            </a>
          </Magnetic>
        </Fade>
        <Fade className="mt-10">
          <p className="font-sans text-xs text-ink/55">
            Know someone this would suit?{" "}
            <ShareButton
              url="https://pmcclb.com/daher-el-souane-563"
              className="text-ink underline underline-offset-4 transition-colors hover:text-pmcc"
            />
          </p>
        </Fade>
      </div>
    </section>
  );
}

/**
 * Mobile-only action bar, appearing once the hero has made its case. On a
 * phone the money actions must never be more than a thumb away — scrolling
 * back up to find a button is where enquiries die.
 */
function StickyCta() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 1.1);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[80] flex border-t border-seam bg-ink/95 backdrop-blur-sm transition-transform duration-300 ease-out-expo lg:hidden ${
        visible ? "" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <a
        href={`https://wa.me/${company.whatsapp}?text=${encodeURIComponent(
          "Hello PMCC — I'm interested in Daher el Souane 563.",
        )}`}
        target="_blank"
        rel="noreferrer"
        onClick={() => track("whatsapp_click", { source: "sticky-bar" })}
        className="flex-1 bg-pmcc py-4 text-center font-sans text-sm font-semibold text-bone"
      >
        WhatsApp
      </a>
      <button
        type="button"
        onClick={() => document.getElementById("enquire")?.scrollIntoView({ behavior: "smooth" })}
        className="flex-1 py-4 text-center font-sans text-sm font-semibold text-bone"
      >
        Price list ↓
      </button>
    </div>
  );
}

export default function Project() {
  // Client-side navigation leaves the baked-in <head> describing the wrong
  // page; put it right. Scrapers read the baked copy, Google reads this.
  useLayoutEffect(() => applySeo("project"), []);

  return (
    <>
      <ProjectHero />
      <Introduction />
      <LocationSpread />
      <TheView />
      <BeforeAfter />
      <FloorStack />
      <Gallery />
      <TheStandard />
      <Availability />
      <Faq />
      <StickyCta />
    </>
  );
}
