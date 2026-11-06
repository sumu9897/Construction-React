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
        <p className="type-eyebrow text-smoke">Speak to the agency</p>
        <Lines className="type-display mt-6 text-[clamp(2.6rem,7vw,6rem)]">
          Let&rsquo;s talk about
          <br />
          <em className="type-display-it text-stone">your next build.</em>
        </Lines>

        <Fade className="mt-12 flex flex-wrap items-center gap-4">
          <Magnetic>
            <a
              href={`mailto:${company.email}`}
              onClick={() => track("email_click", { source: "footer_primary" })}
              className="group inline-flex items-center gap-3 bg-pmcc px-7 py-4 font-sans text-sm font-semibold text-bone hover:opacity-95 transition-opacity"
            >
              Contact Us · {company.email}
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
          </Magnetic>
          <a
            href={`https://wa.me/${company.whatsapp}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("whatsapp_click", { source: "footer" })}
            className="inline-flex items-center gap-3 border border-seam px-7 py-4 font-sans text-sm text-bone transition-colors hover:border-stone"
          >
            WhatsApp {company.mobile}
          </a>
        </Fade>

        <div className="rule mt-20" />

        <div className="mt-8 flex flex-col justify-between gap-6 text-xs text-smoke sm:flex-row sm:items-end">
          <div className="max-w-sm">
            <Monogram className="h-8" />
            <p className="mt-4 leading-relaxed">
              {company.legalName}
              <br />
              US Construction Agency
              <br />
              {company.address}
              <br />
              <a href={`mailto:${company.email}`} className="text-bone underline underline-offset-4 hover:text-stone transition-colors">
                {company.email}
              </a>
              {" · "}
              <a href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noreferrer" className="text-bone underline underline-offset-4 hover:text-stone transition-colors">
                WhatsApp: {company.mobile}
              </a>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Link to="/" className="transition-colors hover:text-bone">American Financial Associates</Link>
            <Link to="/daher-el-souane-563" className="transition-colors hover:text-bone">
              1084 Curry Road
            </Link>
            <p className="mt-4">© {year} American Financial Associates LLC · Since {company.since}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
