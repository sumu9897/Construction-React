import { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import SmoothScroll, { useLenis } from "./lib/SmoothScroll";
import { ScrollTrigger } from "./lib/motion";
import Preloader from "./components/Preloader";
import Cursor from "./components/Cursor";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Project from "./pages/Project";
import NotFound from "./pages/NotFound";
import { trackPageView } from "./lib/analytics";

function ScrollReset() {
  const { pathname } = useLocation();
  const lenisRef = useLenis();
  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);
  useEffect(() => {
    // Through Lenis, not window.scrollTo: a plain reset issued mid-inertia is
    // overwritten by Lenis's next raf frame with the in-flight scroll value.
    const lenis = lenisRef?.current;
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    // New page, new layout — every trigger's measurements are stale.
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [pathname, lenisRef]);
  return null;
}

export default function App() {
  const [loaded, setLoaded] = useState(false);

  return (
    <SmoothScroll>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:bg-pmcc focus:px-4 focus:py-2 focus:text-bone"
      >
        Skip to content
      </a>
      <div className="grain" />
      <Cursor />
      <Preloader onDone={() => setLoaded(true)} />
      <ScrollReset />
      <Nav />
      <main id="content" className={loaded ? "" : "invisible"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/daher-el-souane-563" element={<Project />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
      </main>
    </SmoothScroll>
  );
}
