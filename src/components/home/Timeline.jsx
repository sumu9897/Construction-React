/**
 * Since 1996 — what three decades of building produced, as concise points
 * rather than a year-by-year journey. Static and swipeless on purpose:
 * the record reads at a glance.
 */
import { Fade, Lines } from "../reveal";
import { achievements, company } from "../../data/content";

export default function Timeline() {
  // Each card is a chapter of the book below: tap it, the page scrolls to
  // the book and the book turns to that chapter.
  const openChapter = (i) => {
    document.getElementById("record")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.dispatchEvent(new CustomEvent("book:open", { detail: i }));
  };

  return (
    <section className="bg-coal px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">Since {company.since}</p>
        <Lines className="type-display mt-6 max-w-3xl text-[clamp(2.2rem,5vw,4.2rem)] text-bone">
          Three decades of building <em className="type-display-it text-stone">across Lebanon.</em>
        </Lines>
        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a, i) => (
            <Fade key={a.title} className="border-t border-seam">
              <button type="button" onClick={() => openChapter(i)} className="group w-full pt-6 text-left">
                <h3 className="type-display text-2xl text-bone transition-colors duration-300 group-hover:text-stone">
                  {a.title}
                </h3>
                <p className="mt-3 max-w-sm font-sans text-sm leading-relaxed text-smoke">{a.text}</p>
                <span
                  aria-hidden
                  className="mt-4 inline-block font-sans text-base text-pmcc transition-transform duration-300 group-hover:translate-y-1"
                >
                  ↓
                </span>
              </button>
            </Fade>
          ))}
        </div>
      </div>
    </section>
  );
}
