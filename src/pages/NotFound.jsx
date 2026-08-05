/**
 * A branded dead end. On a static host every unknown path is rewritten to
 * the app shell with a 200, so this page cannot return a true 404 status —
 * the noindex meta below is what keeps mistyped URLs out of the index, and
 * the two links are what keep the visitor.
 */
import { useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { Lines, Fade } from "../components/reveal";
import { project } from "../data/content";

export default function NotFound() {
  useLayoutEffect(() => {
    document.title = "Page not found · PMCC";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  return (
    <section className="flex min-h-[100svh] flex-col items-center justify-center bg-ink px-5 text-center sm:px-8">
      <p className="type-eyebrow text-smoke">404</p>
      <Lines className="type-display mt-6 max-w-3xl text-[clamp(2.4rem,7vw,6rem)] text-bone">
        This page isn&rsquo;t <em className="type-display-it text-stone">on the plan.</em>
      </Lines>
      <Fade className="mt-8 max-w-md">
        <p className="font-sans text-sm leading-relaxed text-smoke">
          The address may have been mistyped, or the page has moved. Everything
          we&rsquo;ve built is one of these two doors away.
        </p>
      </Fade>
      <Fade className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-3 bg-pmcc px-7 py-4 font-sans text-sm font-semibold text-bone"
        >
          PMCC home →
        </Link>
        <Link
          to="/daher-el-souane-563"
          className="inline-flex items-center gap-3 border border-seam px-7 py-4 font-sans text-sm text-bone transition-colors hover:border-stone"
        >
          {project.name}
        </Link>
      </Fade>
    </section>
  );
}
