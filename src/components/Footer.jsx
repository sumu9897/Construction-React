import { Link } from "react-router-dom";
import { Lines, Fade } from "./reveal";
import Monogram from "./Monogram";
import Magnetic from "./Magnetic";
import { company } from "../data/content";
import { track } from "../lib/analytics";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-clip bg-ink px-5 pb-10 pt-28 text-bone sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">Speak to the builder</p>
        <Lines className="type-display mt-6 text-[clamp(2.6rem,7vw,6rem)]">
          Let&rsquo;s talk about
          <br />
          <em className="type-display-it text-stone">what you&rsquo;re building.</em>
        </Lines>

        <Fade className="mt-12 flex flex-wrap items-center gap-4">
          <Magnetic>
            <a
              href={`https://wa.me/${company.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("whatsapp_click", { source: "footer" })}
              className="group inline-flex items-center gap-3 bg-pmcc px-7 py-4 font-sans text-sm font-semibold text-bone"
            >
              WhatsApp {company.mobile}
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
          </Magnetic>
          <a
            href={`mailto:${company.email}`}
            onClick={() => track("email_click", { source: "footer" })}
            className="inline-flex items-center gap-3 border border-seam px-7 py-4 font-sans text-sm text-bone transition-colors hover:border-stone"
          >
            {company.email}
          </a>
        </Fade>

        <div className="rule mt-20" />

        <div className="mt-8 flex flex-col justify-between gap-6 text-xs text-smoke sm:flex-row sm:items-end">
          <div className="max-w-sm">
            <Monogram className="h-6" />
            <p className="mt-4 leading-relaxed">
              {company.legalName}
              <br />
              {company.address}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Link to="/" className="transition-colors hover:text-bone">PMCC</Link>
            <Link to="/daher-el-souane-563" className="transition-colors hover:text-bone">
              Daher el Souane 563
            </Link>
            <p className="mt-4">© {year} PMCC S.A.R.L. · Since {company.since}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
