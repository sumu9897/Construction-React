import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { gsap } from "../lib/motion";
import Monogram from "./Monogram";
import { company } from "../data/content";
import { track } from "../lib/analytics";

/**
 * Fixed minimal bar. Transparent over the hero, then a dark scrim once
 * scrolled so links never fight the content underneath. Hidden while
 * scrolling down — and made inert then, so keyboard focus cannot land on
 * off-screen controls.
 */
export default function Nav() {
  const { pathname } = useLocation();
  const onProject = pathname.startsWith("/daher");
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);
  const header = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 80);
      setHidden(y > 160 && y > lastY.current);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    header.current?.toggleAttribute("inert", hidden);
  }, [hidden]);

  useEffect(() => {
    gsap.fromTo(
      "[data-nav]",
      { y: -24, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.9, delay: 0.2, ease: "power3.out" },
    );
  }, []);

  const linkCls =
    "type-eyebrow inline-flex min-h-[44px] items-center px-2 text-bone transition-opacity hover:opacity-70";

  return (
    <header
      ref={header}
      data-nav
      className={`fixed inset-x-0 top-0 z-[90] transition-all duration-500 ease-out-expo ${
        hidden ? "-translate-y-full" : ""
      } ${scrolled ? "bg-ink/80 backdrop-blur-sm" : ""}`}
    >
      <nav className="flex items-center justify-between px-5 py-3 sm:px-8">
        <Link to="/" aria-label="PMCC home" className="inline-flex min-h-[44px] items-center transition-opacity hover:opacity-80">
          <Monogram className="h-7" />
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <span className="flex flex-col items-end whitespace-nowrap">
            {/* A label, not a link, stacked right above the project name. */}
            <span aria-hidden className="pr-2 font-sans text-[0.5rem] font-bold uppercase tracking-wideish text-pmcc">
              Now selling
            </span>
            <Link
              to="/daher-el-souane-563"
              className={`type-eyebrow inline-flex items-center px-2 pb-1 text-bone transition-opacity hover:opacity-70 ${
                onProject ? "underline underline-offset-4" : ""
              }`}
            >
              Daher el Souane 563
            </Link>
          </span>
          <a
            href={`https://wa.me/${company.whatsapp}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("whatsapp_click", { source: "nav" })}
            className={`${linkCls} hidden sm:inline-flex`}
          >
            Contact
          </a>
        </div>
      </nav>
    </header>
  );
}
