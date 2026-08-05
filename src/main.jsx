import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/inter";
// full.css carries every Fraunces axis (opsz, SOFT, WONK) — the wght-only
// files silently ignore the display cut's font-variation-settings.
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "./index.css";
import App from "./App.jsx";
import { initAnalytics } from "./lib/analytics";

// No-op until GA4_ID / META_PIXEL_ID are set in src/lib/analytics.js.
initAnalytics();

// No StrictMode: its dev-only double-mount duplicates every ScrollTrigger and
// pin-spacer, which makes scroll development lie to you. The animation layer
// cleans up properly via gsap.context throughout.
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
