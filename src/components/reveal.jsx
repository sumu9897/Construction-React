/**
 * The two reveal primitives the whole site is built from.
 *
 * <Lines>  — SplitText masked line-rise for display type. Splits only after
 *            document.fonts.ready (metrics from the real Fraunces, not the
 *            Georgia fallback) and re-splits on resize via autoSplit.
 * <Fade>   — group fade/rise. Animates opacity, never visibility, so content
 *            below the fold stays in the accessibility tree.
 *
 * Both no-op into visible static content under prefers-reduced-motion.
 */
import { useLayoutEffect, useRef } from "react";
import { gsap, SplitText, reducedMotion } from "../lib/motion";

export function Lines({ as: Tag = "h2", className = "", children, delay = 0, trigger = true }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const el = ref.current;
    let cancelled = false;
    const ctx = gsap.context(() => {}, el);

    // Hold the element invisible until the real font has loaded and the split
    // is measured — splitting against fallback metrics freezes wrong breaks.
    gsap.set(el, { autoAlpha: 0 });

    document.fonts.ready.then(() => {
      if (cancelled) return;
      ctx.add(() => {
        SplitText.create(el, {
          type: "lines",
          autoSplit: true, // re-splits itself on resize/late font events
          mask: "lines",
          onSplit(self) {
            gsap.set(el, { autoAlpha: 1 });
            return gsap.from(self.lines, {
              yPercent: 115,
              duration: 1.15,
              stagger: 0.09,
              ease: "power4.out",
              delay,
              ...(trigger
                ? { scrollTrigger: { trigger: el, start: "top 88%", once: true } }
                : {}),
            });
          },
        });
      });
    });

    return () => {
      cancelled = true;
      ctx.revert();
    };
  }, [delay, trigger]);

  return (
    <Tag ref={ref} className={`split-mask ${className}`}>
      {children}
    </Tag>
  );
}

export function Fade({ as: Tag = "div", className = "", children, y = 28, stagger = 0.08, delay = 0 }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const el = ref.current;
    const ctx = gsap.context(() => {
      const targets = el.children.length > 1 ? [...el.children] : [el];
      // opacity, not autoAlpha: visibility:hidden would drop the content out
      // of the accessibility tree until scrolled into view.
      gsap.set(targets, { opacity: 0, y });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 1.05,
        stagger,
        delay,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    }, el);
    return () => ctx.revert();
  }, [y, stagger, delay]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
