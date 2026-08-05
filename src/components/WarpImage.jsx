/**
 * A full-bleed image with the WebGL warp treatment layered on top.
 * The plain <img> is always in the DOM and always correct; the canvas is an
 * enhancement that fades in when its texture is ready, and never exists under
 * reduced motion or when WebGL is unavailable.
 *
 * The canvas is keyed by src: a lost-on-destroy WebGL context cannot be
 * revived on the same element, so a new src gets a new canvas node.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { createWarp } from "../lib/warpgl";
import { ScrollTrigger, reducedMotion } from "../lib/motion";

export default function WarpImage({
  src,
  srcSet,
  sizes,
  alt,
  className = "",
  imgClassName = "",
  priority = false,
  anchor = "center",
}) {
  const wrap = useRef(null);
  const img = useRef(null);
  const canvas = useRef(null);
  const [glReady, setGlReady] = useState(false);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const warp = createWarp(canvas.current, img.current, { anchorY: anchor === "top" ? 1 : 0.5 });
    if (!warp) return undefined;

    const st = ScrollTrigger.create({
      trigger: wrap.current,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => warp.setScroll(self.progress * 2 - 1),
      // The render loop pauses off-screen. ScrollTrigger, not an
      // IntersectionObserver, so pinned ancestors are measured correctly.
      onToggle: (self) => warp.setVisible(self.isActive),
    });
    warp.setVisible(st.isActive);

    const show = () => setGlReady(true);
    if (img.current.complete && img.current.naturalWidth > 0) show();
    else img.current.addEventListener("load", show, { once: true });

    return () => {
      st.kill();
      warp.destroy();
      setGlReady(false);
    };
  }, [src, anchor]);

  return (
    <div ref={wrap} className={`relative overflow-clip ${className}`}>
      <img
        ref={img}
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes ?? "100vw" : undefined}
        alt={alt}
        className={`absolute inset-0 h-full w-full object-cover ${imgClassName}`}
        // React 18 only forwards the lowercase form; the camelCase prop
        // arrives in React 19. eslint's rule is ahead of the runtime here.
        // eslint-disable-next-line react/no-unknown-property
        fetchpriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
      />
      <canvas
        key={src}
        ref={canvas}
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
          glReady ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
