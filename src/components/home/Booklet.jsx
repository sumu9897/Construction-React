/**
 * The booklet — a hardbound architecture monograph open on the table, with a
 * real page-turn.
 *
 * Two physical formats, one book. On large screens it lies open as a spread:
 * camera slightly above (rotateX inside a deep perspective with a raised
 * origin), cloth boards proud of the pages, sheet edges at the flanks and
 * fore-edge, a shaded gutter valley with compressed leaves, uncoated paper
 * grain, warm afternoon light from the left, and a lit tabletop holding it
 * down. On small screens it becomes the same book held in one hand: a
 * portrait page inside the same cloth cover, bound on the left, sheet stack
 * on the right, one page per view — and the turn flips the whole page around
 * the binding in 3D, exactly as a thumb would turn it.
 *
 * The desktop spread container carries its own perspective - without it the
 * leaf's rotation renders orthographically, as a flat squash, which is the
 * single loudest "CSS mockup" tell. The leaf twists slightly off-axis under
 * its own weight, shades as it tilts away from the light, catches a warm rim
 * on its free edge, shadows the page it lifts from and then the page it
 * lands on, and settles the last few degrees softly. Turning back mirrors
 * everything, because a book does.
 *
 * Reduced-motion swaps instantly in both formats.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap, reducedMotion } from "../../lib/motion";
import { Fade, Lines } from "../reveal";
import { booklet } from "../../data/content";

const pad = (n) => String(n + 1).padStart(2, "0");
const MOBILE_PAGES = booklet.length * 2;

/** Fibrous grain of uncoated stock. One tiled SVG turbulence; alpha baked in,
 *  no blend mode - mix-blend forces per-frame re-rasterisation under an
 *  animating ancestor in WebKit. */
const PAPER_GRAIN =
  "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22180%22 height=%22180%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22180%22 height=%22180%22 filter=%22url(%23n)%22 opacity=%220.55%22/></svg>')";

const CLOTH_WEAVE =
  "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)";

const CLOTH_COVER = `linear-gradient(105deg, #322a22, #241e18 30%, #2b241c 47%, #17120e 51%, #2b241c 55%, #241e18 76%, #150f0c), ${CLOTH_WEAVE}`;

function PaperGrain() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.05]"
      style={{ backgroundImage: PAPER_GRAIN }}
    />
  );
}

function Plate({ img, eager = false, className = "" }) {
  return (
    <img
      src={img.src}
      srcSet={`${img.src} 1280w, ${img.src2x} 2560w`}
      sizes="(min-width: 1024px) 40vw, 90vw"
      alt={img.alt}
      loading={eager ? "eager" : "lazy"}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/* ---------------------------------------------------------------- desktop */

/** The left page: the chapter opener — the headline, then the plate.
 *  No sentences; the photographs carry the book. */
function LeftPage({ spread, index, eager = false, plain = false }) {
  const f = spread.feature;
  return (
    <div className="relative flex h-full flex-col bg-bone p-10 pb-8">
      <div className="shrink-0 border-b border-ink/15 pb-3">
        <p className="font-sans text-[0.55rem] font-bold uppercase tracking-[0.3em] text-pmcc">Chapter {pad(index)}</p>
        <h3 className="type-display mt-1 text-[clamp(1.2rem,1.8vw,1.8rem)] leading-tight text-ink">{spread.title}</h3>
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-hidden">
        <Plate img={f.img} eager={eager} />
      </div>
      {plain ? null : <PaperGrain />}
    </div>
  );
}

/** The right page: plates only, edge to edge within the margins. */
function RightPage({ spread, eager = false, plain = false }) {
  return (
    <div className="relative flex h-full flex-col bg-bone p-10">
      <p className="pointer-events-none absolute right-8 top-4 font-sans text-[0.55rem] uppercase tracking-[0.25em] text-ink/35">
        {spread.title}
      </p>
      <div className={`min-h-0 flex-1 pt-4 ${spread.grid.length > 1 ? "grid grid-cols-2 gap-5" : ""}`}>
        {spread.grid.map((item) => (
          <div key={item.name} className="h-full min-h-0 overflow-hidden">
            <Plate img={item.img} eager={eager} />
          </div>
        ))}
      </div>
      {plain ? null : <PaperGrain />}
    </div>
  );
}

/** The stacked edges of the closed leaves at the flanks, darkening toward the board. */
function SheetEdges({ side }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-y-1 ${side === "left" ? "-left-[9px]" : "-right-[9px]"} w-[9px]`}
      style={{
        background:
          `linear-gradient(${side === "left" ? "to left" : "to right"}, transparent, rgba(0,0,0,0.28)), ` +
          "repeating-linear-gradient(to right, #f0eadf 0px, #f0eadf 1.4px, #d6cfbf 1.4px, #d6cfbf 2.6px)",
        borderRadius: side === "left" ? "2px 0 0 2px" : "0 2px 2px 0",
        boxShadow:
          side === "left"
            ? "inset 2px 0 3px rgba(0,0,0,0.3), inset -1px 0 1px rgba(0,0,0,0.12)"
            : "inset -2px 0 3px rgba(0,0,0,0.3), inset 1px 0 1px rgba(0,0,0,0.12)",
      }}
    />
  );
}

/* ----------------------------------------------------------------- mobile */

/** One portrait page of the handheld book: even indices are a feature page,
 *  odd indices the plate grid of the same spread. Fixed 3:4 page, so the
 *  book never changes size as it is read. */
function MobilePage({ index, plain = false }) {
  const ci = Math.floor(index / 2) % booklet.length;
  const spread = booklet[ci];
  const isFeature = index % 2 === 0;
  const f = spread.feature;

  return (
    <div className="relative h-full bg-bone">
      {isFeature ? (
        <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4 p-6 pb-9">
          <div className="border-b border-ink/15 pb-3">
            <p className="font-sans text-[0.55rem] font-bold uppercase tracking-[0.3em] text-pmcc">Chapter {pad(ci)}</p>
            <h3 className="type-display mt-1 text-2xl leading-tight text-ink">{spread.title}</h3>
          </div>
          <div className="min-h-0 overflow-hidden">
            <Plate img={f.img} eager />
          </div>
        </div>
      ) : (
        <div
          className={`grid h-full gap-x-4 gap-y-3 p-6 pb-9 ${
            spread.grid.length > 1 ? "grid-cols-2 grid-rows-2" : "grid-cols-1"
          }`}
        >
          {spread.grid.map((item) => (
            <div key={item.name} className="min-h-0 overflow-hidden">
              <Plate img={item.img} eager />
            </div>
          ))}
        </div>
      )}

      {/* The binding: the page curls into the spine on the left */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8" style={{ background: "linear-gradient(to right, rgba(20,17,15,0.3), rgba(20,17,15,0.1) 45%, transparent)" }} />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2 w-1 bg-gradient-to-r from-white/20 to-transparent" />
      {/* Warm light falling across the page */}
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(115deg, rgba(255,241,212,0.12), transparent 45%, rgba(20,16,12,0.1))" }} />
      {/* The folio */}
      <p className="pointer-events-none absolute inset-x-0 bottom-2.5 text-center font-sans text-[0.6rem] tracking-[0.22em] text-ink/40">
        {pad(index)} / {pad(MOBILE_PAGES - 1)}
      </p>
      {plain ? null : <PaperGrain />}
    </div>
  );
}

/** A page's self-shading while it stands in the light. */
const shadeGradient = (towardGutter) =>
  `linear-gradient(to ${towardGutter}, rgba(20,17,15,0.9), rgba(20,17,15,0.2))`;

export default function Booklet() {
  const [page, setPage] = useState(0); // desktop: spread index
  const [turning, setTurning] = useState(null); // {from, to, dir}
  const [mpage, setMpage] = useState(0); // mobile: page index
  const [mturning, setMturning] = useState(null);

  const book = useRef(null);
  const turner = useRef(null);
  const shadeFront = useRef(null);
  const shadeBack = useRef(null);
  const edgeFront = useRef(null);
  const edgeBack = useRef(null);
  const castLift = useRef(null);
  const castLand = useRef(null);

  const mbook = useRef(null);
  const mturner = useRef(null);
  const mShadeF = useRef(null);
  const mCast = useRef(null);

  const busy = useRef(false);

  // Warm every plate with the same candidate selection the render uses,
  // decoded, so a leaf never turns onto an undecoded image.
  useEffect(() => {
    if (reducedMotion()) return;
    booklet.forEach((s) => {
      [s.feature.img, ...s.grid.map((g) => g.img)].forEach(({ src, src2x }) => {
        const img = new Image();
        img.srcset = `${src} 1280w, ${src2x} 2560w`;
        img.sizes = "40vw";
        img.src = src;
        img.decode?.().catch(() => {});
      });
    });
  }, []);

  const isLg = () => window.matchMedia("(min-width: 1024px)").matches;

  const turnSpread = (next) => {
    const target = (next + booklet.length) % booklet.length;
    if (target === page) return;
    if (reducedMotion()) {
      setPage(target);
      return;
    }
    busy.current = true;
    setTurning({ from: page, to: target, dir: next - page > 0 ? 1 : -1 });
  };

  const turnMobile = (next) => {
    const target = (next + MOBILE_PAGES) % MOBILE_PAGES;
    if (target === mpage) return;
    if (reducedMotion()) {
      setMpage(target);
      return;
    }
    busy.current = true;
    setMturning({ from: mpage, to: target, dir: next - mpage > 0 ? 1 : -1 });
  };

  const go = (delta) => {
    if (busy.current) return;
    if (isLg()) turnSpread(page + delta);
    else turnMobile(mpage + delta);
  };

  // Open a chapter directly — the achievement cards above dispatch this.
  const jumpTo = (i) => {
    if (busy.current) return;
    if (isLg()) turnSpread(i);
    else turnMobile(i * 2);
  };
  const jumpRef = useRef(jumpTo);
  jumpRef.current = jumpTo;
  useEffect(() => {
    const onOpen = (e) => jumpRef.current(e.detail);
    window.addEventListener("book:open", onOpen);
    return () => window.removeEventListener("book:open", onOpen);
  }, []);

  // Swiping the page is how a phone turns it. Handlers never preventDefault
  // and the card declares touch-action: pan-y, so vertical scrolling through
  // the section stays native - only a decisively horizontal gesture turns.
  const touchStart = useRef(null);
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // A swipe, not a scroll or a tap: far enough, and clearly horizontal.
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? 1 : -1);
  };

  // Desktop: the spread turn.
  useLayoutEffect(() => {
    if (!turning) return undefined;
    const { to, dir } = turning;

    const ctx = gsap.context(() => {
      gsap.set(turner.current, {
        rotateY: 0,
        rotateX: 0,
        rotateZ: 0,
        transformOrigin: dir === 1 ? "left center" : "right center",
        force3D: true,
      });

      const end = dir === 1 ? -180 : 180;
      const tl = gsap.timeline({
        onComplete: () => {
          busy.current = false;
          setPage(to);
          setTurning(null);
        },
      });

      tl.to(turner.current, { rotateY: end * (176 / 180), duration: 1.15, ease: "power2.inOut" }, 0)
        .to(turner.current, { rotateY: end, duration: 0.16, ease: "power1.out" }, 1.15)
        .to(turner.current, { rotateX: 2.6, duration: 0.5, ease: "sine.in" }, 0.1)
        .to(turner.current, { rotateX: 0, duration: 0.55, ease: "sine.out" }, 0.62)
        .to(turner.current, { rotateZ: dir === 1 ? -0.9 : 0.9, duration: 0.5, ease: "sine.inOut" }, 0.18)
        .to(turner.current, { rotateZ: 0, duration: 0.5, ease: "sine.out" }, 0.72)
        .fromTo(shadeFront.current, { opacity: 0 }, { opacity: 0.45, duration: 0.56, ease: "power1.in" }, 0)
        .set(shadeFront.current, { opacity: 0 }, 0.6)
        .fromTo(shadeBack.current, { opacity: 0.45 }, { opacity: 0, duration: 0.56, ease: "power1.out" }, 0.64)
        .fromTo(edgeFront.current, { opacity: 0 }, { opacity: 0.9, duration: 0.45, ease: "sine.in" }, 0.12)
        .to(edgeFront.current, { opacity: 0, duration: 0.2 }, 0.58)
        .fromTo(edgeBack.current, { opacity: 0.9 }, { opacity: 0, duration: 0.5, ease: "sine.out" }, 0.62)
        .fromTo(castLift.current, { opacity: 0 }, { opacity: 0.32, duration: 0.4, ease: "power1.in" }, 0.05)
        .to(castLift.current, { opacity: 0, duration: 0.3, ease: "power1.out" }, 0.5)
        .fromTo(castLand.current, { opacity: 0 }, { opacity: 0.42, duration: 0.4, ease: "power1.in" }, 0.5)
        .to(castLand.current, { opacity: 0, duration: 0.3, ease: "power1.out" }, 0.98)
        .to(book.current, { scale: 1.005, duration: 0.62, ease: "power1.inOut" }, 0)
        .to(book.current, { scale: 1, duration: 0.62, ease: "power1.inOut" }, 0.62);
    }, book.current);

    return () => ctx.revert();
  }, [turning]);

  // Mobile: we see one page of the book, so a full card-flip reads wrong.
  // Forward, the page lifts at the fore-edge, swings over the binding and
  // leaves the frame - its second half-turn happens over the half of the book
  // the camera cannot see - while the next page is revealed beneath. Backward,
  // a page swings in from over the binding and lays down on top. Only the
  // paper back of the sheet is ever glimpsed, edge-on.
  useLayoutEffect(() => {
    if (!mturning) return undefined;
    const { to, dir } = mturning;
    const OUT = -112;

    const ctx = gsap.context(() => {
      gsap.set(mturner.current, {
        transformOrigin: "left center",
        force3D: true,
        rotateY: dir === 1 ? 0 : OUT,
        autoAlpha: dir === 1 ? 1 : 0,
        rotateX: 0,
      });

      const tl = gsap.timeline({
        onComplete: () => {
          busy.current = false;
          setMpage(to);
          setMturning(null);
        },
      });

      if (dir === 1) {
        tl.to(mturner.current, { rotateY: OUT, duration: 0.7, ease: "power2.in" }, 0)
          .to(mturner.current, { rotateY: OUT - 42, autoAlpha: 0, duration: 0.32, ease: "power1.out" }, 0.7)
          // A touch of gravity as the sheet stands
          .to(mturner.current, { rotateX: 2.2, duration: 0.45, ease: "sine.in" }, 0.12)
          .to(mturner.current, { rotateX: 0, duration: 0.35, ease: "sine.out" }, 0.6)
          // The page darkens as it turns out of the light
          .fromTo(mShadeF.current, { opacity: 0 }, { opacity: 0.5, duration: 0.62, ease: "power1.in" }, 0)
          // Its shadow sweeps the page being revealed, hinging at the binding
          .fromTo(mCast.current, { opacity: 0 }, { opacity: 0.4, duration: 0.45, ease: "power1.in" }, 0.08)
          .to(mCast.current, { opacity: 0, duration: 0.4, ease: "power1.out" }, 0.62);
      } else {
        tl.to(mturner.current, { autoAlpha: 1, duration: 0.1 }, 0)
          .to(mturner.current, { rotateY: 0, duration: 0.85, ease: "power2.out" }, 0.04)
          .to(mturner.current, { rotateX: 2, duration: 0.35, ease: "sine.in" }, 0.1)
          .to(mturner.current, { rotateX: 0, duration: 0.4, ease: "sine.out" }, 0.5)
          .fromTo(mShadeF.current, { opacity: 0.5 }, { opacity: 0, duration: 0.6, ease: "power1.out" }, 0.25)
          .fromTo(mCast.current, { opacity: 0.35 }, { opacity: 0, duration: 0.55, ease: "power1.out" }, 0.3);
      }
    }, mbook.current);

    return () => ctx.revert();
  }, [mturning]);

  // Desktop: while a leaf is in the air the static book shows what sits
  // beneath it. Forward keeps the old words and reveals the new plates;
  // backward mirrors.
  const dir = turning?.dir ?? 1;
  const leftIdx = turning ? (dir === 1 ? turning.from : turning.to) : page;
  const rightIdx = turning ? (dir === 1 ? turning.to : turning.from) : page;
  const leftSpread = booklet[leftIdx];
  const rightSpread = booklet[rightIdx];
  const shown = turning ? turning.to : page;

  // Beneath the flight: forward reveals the destination as the page lifts
  // away; backward keeps the origin until the incoming page lays over it.
  const mShown = mturning ? (mturning.dir === 1 ? mturning.to : mturning.from) : mpage;
  const mFace = mturning ? (mturning.dir === 1 ? mturning.from : mturning.to) : null;


  const faceStyle = (isBack) => ({
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    transform: isBack ? "rotateY(180deg)" : "translateZ(0)",
  });

  return (
    <section id="record" className="overflow-x-clip bg-ink px-5 py-28 sm:px-8" aria-label="Project booklet">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(13rem,1fr)_minmax(0,4fr)] lg:gap-14">
        {/* The heading and the contents live beside the book. */}
        <div>
          <Lines className="type-display text-[clamp(2rem,3.4vw,3.2rem)] leading-[1.08] text-bone">
            Selected <em className="type-display-it text-stone">Projects</em>
          </Lines>
          <Fade className="mt-6">
            <p className="max-w-[16rem] font-sans text-sm leading-relaxed text-smoke">
              Our work since 1996, as a book. Tap a chapter above, or turn the pages.
            </p>
          </Fade>
          <Fade className="mt-8 hidden items-center gap-4 lg:flex">
            <p className="font-sans text-xs tabular-nums text-smoke" aria-live="polite">
              <span className="text-bone">{pad(shown)}</span> / {pad(booklet.length - 1)}
            </p>
          </Fade>
        </div>

        {/* The book, flanked by its page-turn controls. */}
        <Fade>
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous page"
              className="hidden h-12 w-12 shrink-0 place-items-center rounded-full border border-seam text-bone transition-colors duration-300 hover:border-bone/60 sm:grid"
            >
              <span aria-hidden>←</span>
            </button>

            {/* ------------------------------------------------ desktop book */}
            <div className="relative hidden min-w-0 flex-1 lg:block">
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-x-24 -inset-y-16"
                style={{ background: "radial-gradient(58% 72% at 49% 52%, rgba(66,56,45,0.5), rgba(32,26,21,0.22) 58%, transparent 78%)" }}
              />
              <span aria-hidden className="pointer-events-none absolute -bottom-8 left-[53%] h-16 w-[94%] -translate-x-1/2 rounded-[50%] bg-black/60 blur-2xl" />
              <span aria-hidden className="pointer-events-none absolute -bottom-2.5 left-[52%] h-5 w-[99%] -translate-x-1/2 rounded-[50%] bg-black/50 blur-md" />

              <div style={{ perspective: "1800px", perspectiveOrigin: "50% 20%" }}>
                <div style={{ transform: "rotateX(7deg)", transformStyle: "preserve-3d" }}>
                  <div ref={book} className="relative" style={{ transformStyle: "preserve-3d" }}>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -inset-x-[15px] -inset-y-[11px]"
                      style={{
                        borderRadius: "6px 10px 10px 6px",
                        background: CLOTH_COVER,
                        boxShadow:
                          "inset 1px 1px 0 rgba(255,235,200,0.09), inset -1px -1px 0 rgba(0,0,0,0.55), inset 0 -3px 4px rgba(0,0,0,0.4)",
                      }}
                    />
                    <SheetEdges side="left" />
                    <SheetEdges side="right" />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -bottom-[8px] inset-x-1 h-[8px]"
                      style={{
                        background:
                          "linear-gradient(to bottom, transparent, rgba(0,0,0,0.26)), repeating-linear-gradient(to bottom, #ece5d8 0px, #ece5d8 1.3px, #d2cabb 1.3px, #d2cabb 2.4px)",
                        borderRadius: "0 0 2px 2px",
                        boxShadow: "inset 0 -2px 3px rgba(0,0,0,0.38)",
                      }}
                    />

                    {/* The open spread. Its own perspective is load-bearing:
                        without it the leaf turns orthographically. */}
                    <div className="relative aspect-[15/7] bg-bone" style={{ perspective: "2400px" }}>
                      <div className="absolute inset-y-0 left-0 w-1/2">
                        <LeftPage spread={leftSpread} index={leftIdx} eager />
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24" style={{ background: "linear-gradient(to left, rgba(20,17,15,0.34), rgba(20,17,15,0.12) 45%, transparent)" }} />
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 z-10 w-1.5 bg-gradient-to-l from-white/20 to-transparent" />
                        {turning ? (
                          <span
                            ref={dir === 1 ? castLand : castLift}
                            aria-hidden
                            className="pointer-events-none absolute inset-0 z-20 opacity-0"
                            style={{ background: "linear-gradient(to left, rgba(28,22,15,0.6), rgba(28,22,15,0.12) 55%, transparent)" }}
                          />
                        ) : null}
                      </div>

                      <div className="absolute inset-y-0 right-0 w-1/2">
                        <RightPage spread={rightSpread} eager />
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24" style={{ background: "linear-gradient(to right, rgba(20,17,15,0.38), rgba(20,17,15,0.14) 45%, transparent)" }} />
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 z-10 w-1.5 bg-gradient-to-r from-white/25 to-transparent" />
                        {turning ? (
                          <span
                            ref={dir === 1 ? castLift : castLand}
                            aria-hidden
                            className="pointer-events-none absolute inset-0 z-20 opacity-0"
                            style={{ background: "linear-gradient(to right, rgba(28,22,15,0.6), rgba(28,22,15,0.12) 55%, transparent)" }}
                          />
                        ) : null}
                      </div>

                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-14 -translate-x-1/2"
                        style={{
                          background:
                            "linear-gradient(to right, transparent, rgba(58,48,34,0.2) 34%, rgba(34,27,19,0.5) 50%, rgba(58,48,34,0.2) 66%, transparent), " +
                            "linear-gradient(to right, transparent 24%, rgba(255,252,244,0.22) 26%, transparent 30%, transparent 70%, rgba(255,252,244,0.22) 74%, transparent 76%), " +
                            "repeating-linear-gradient(to right, transparent 0 3px, rgba(0,0,0,0.12) 3px 3.8px)",
                          maskImage: "linear-gradient(to right, transparent, black 25%, black 75%, transparent)",
                          WebkitMaskImage: "linear-gradient(to right, transparent, black 25%, black 75%, transparent)",
                        }}
                      />

                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-10"
                        style={{
                          background:
                            "linear-gradient(100deg, rgba(255,241,212,0.16), rgba(255,241,212,0.05) 32%, transparent 50%, rgba(20,16,12,0.08) 76%, rgba(20,16,12,0.16))",
                        }}
                      />

                      {turning ? (
                        <div
                          ref={turner}
                          aria-hidden
                          className={`absolute inset-y-0 z-30 w-1/2 ${dir === 1 ? "left-1/2" : "left-0"}`}
                          style={{ transformStyle: "preserve-3d" }}
                        >
                          <div className="absolute inset-0 overflow-hidden" style={faceStyle(false)}>
                            {dir === 1 ? (
                              <RightPage spread={booklet[turning.from]} eager plain />
                            ) : (
                              <LeftPage spread={booklet[turning.from]} index={turning.from} eager plain />
                            )}
                            <span ref={shadeFront} className="pointer-events-none absolute inset-0 opacity-0" style={{ background: shadeGradient(dir === 1 ? "right" : "left") }} />
                            <span
                              ref={edgeFront}
                              className={`pointer-events-none absolute inset-y-0 w-[3px] opacity-0 ${dir === 1 ? "right-0" : "left-0"}`}
                              style={{ background: `linear-gradient(to ${dir === 1 ? "left" : "right"}, rgba(255,238,205,0.95), transparent)` }}
                            />
                          </div>
                          <div className="absolute inset-0 overflow-hidden" style={faceStyle(true)}>
                            {dir === 1 ? (
                              <LeftPage spread={booklet[turning.to]} index={turning.to} eager plain />
                            ) : (
                              <RightPage spread={booklet[turning.to]} eager plain />
                            )}
                            <span ref={shadeBack} className="pointer-events-none absolute inset-0 opacity-0" style={{ background: shadeGradient(dir === 1 ? "left" : "right") }} />
                            <span
                              ref={edgeBack}
                              className={`pointer-events-none absolute inset-y-0 w-[3px] opacity-0 ${dir === 1 ? "left-0" : "right-0"}`}
                              style={{ background: `linear-gradient(to ${dir === 1 ? "right" : "left"}, rgba(255,238,205,0.95), transparent)` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ------------------------------------------------- mobile book */}
            <div className="relative min-w-0 flex-1 lg:hidden" style={{ touchAction: "pan-y" }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-x-10 -inset-y-8"
                style={{ background: "radial-gradient(60% 60% at 50% 50%, rgba(66,56,45,0.45), rgba(32,26,21,0.18) 60%, transparent 80%)" }}
              />
              <span aria-hidden className="pointer-events-none absolute -bottom-5 left-[52%] h-10 w-[92%] -translate-x-1/2 rounded-[50%] bg-black/55 blur-xl" />

              <div style={{ perspective: "1600px" }}>
                <div ref={mbook} className="relative mx-auto max-w-[26rem]">
                  {/* The same cloth boards, held in one hand */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-x-[9px] -inset-y-[8px]"
                    style={{
                      borderRadius: "4px 8px 8px 4px",
                      background: CLOTH_COVER,
                      boxShadow: "inset 1px 1px 0 rgba(255,235,200,0.08), inset -1px -1px 0 rgba(0,0,0,0.5)",
                    }}
                  />
                  {/* The sheet stack at the fore-edge and foot */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-[6px] inset-y-1 w-[6px]"
                    style={{
                      background:
                        "linear-gradient(to right, transparent, rgba(0,0,0,0.25)), repeating-linear-gradient(to right, #f0eadf 0 1.3px, #d6cfbf 1.3px 2.4px)",
                      borderRadius: "0 2px 2px 0",
                      boxShadow: "inset -2px 0 3px rgba(0,0,0,0.3)",
                    }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -bottom-[6px] inset-x-1 h-[6px]"
                    style={{
                      background:
                        "linear-gradient(to bottom, transparent, rgba(0,0,0,0.24)), repeating-linear-gradient(to bottom, #ece5d8 0 1.2px, #d2cabb 1.2px 2.2px)",
                      borderRadius: "0 0 2px 2px",
                      boxShadow: "inset 0 -2px 3px rgba(0,0,0,0.35)",
                    }}
                  />

                  {/* The page. Fixed 3:4, so the book never changes size. */}
                  <div className="relative aspect-[3/4] bg-bone" style={{ perspective: "1600px" }}>
                    <MobilePage index={mShown} />
                    {mturning ? (
                      <span
                        ref={mCast}
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-20 opacity-0"
                        style={{ background: "linear-gradient(to right, rgba(28,22,15,0.55), rgba(28,22,15,0.12) 55%, transparent)" }}
                      />
                    ) : null}

                    {mturning ? (
                      <div ref={mturner} aria-hidden className="absolute inset-0 z-30" style={{ transformStyle: "preserve-3d" }}>
                        <div className="absolute inset-0 overflow-hidden" style={faceStyle(false)}>
                          <MobilePage index={mFace} plain />
                          <span ref={mShadeF} className="pointer-events-none absolute inset-0 opacity-0" style={{ background: shadeGradient("left") }} />
                          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[3px]" style={{ background: "linear-gradient(to left, rgba(255,238,205,0.85), transparent)" }} />
                        </div>
                        {/* The back of the sheet: plain paper, seen only edge-on */}
                        <div className="absolute inset-0 overflow-hidden bg-bone" style={faceStyle(true)}>
                          <PaperGrain />
                          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(105deg, rgba(20,17,15,0.16), transparent 40%, rgba(20,17,15,0.1))" }} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next page"
              className="hidden h-12 w-12 shrink-0 place-items-center rounded-full border border-seam text-bone transition-colors duration-300 hover:border-bone/60 sm:grid"
            >
              <span aria-hidden>→</span>
            </button>
          </div>

          {/* Turn controls below the book on phones */}
          <div className="mt-8 flex justify-center gap-3 sm:hidden">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous page"
              className="grid h-11 w-11 place-items-center rounded-full border border-seam text-bone"
            >
              <span aria-hidden>←</span>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next page"
              className="grid h-11 w-11 place-items-center rounded-full border border-seam text-bone"
            >
              <span aria-hidden>→</span>
            </button>
          </div>
        </Fade>
      </div>
    </section>
  );
}
