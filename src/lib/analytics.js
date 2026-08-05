/**
 * Measurement for the three actions that actually sell apartments: a WhatsApp
 * click, a phone call, and a submitted lead form. Everything else is vanity.
 *
 * Both trackers are loaded here, at runtime, only when their ID is set — so
 * the site ships with this wiring in place and lights up the day the IDs are
 * pasted in. No ID, no third-party script, no consent surface needed.
 *
 * GA4 answers "which channel and country do buyers come from"; the Meta pixel
 * exists so Instagram/Facebook ads can optimise for people who actually
 * enquire, not people who scroll. In Lebanon-diaspora marketing the second
 * one is the workhorse.
 */

/** Paste the GA4 measurement ID here, e.g. "G-XXXXXXXXXX". Empty = off. */
export const GA4_ID = "G-3JSXJJ0Y35";

/** Paste the Meta pixel ID here, e.g. "1234567890123456". Empty = off. */
export const META_PIXEL_ID = "1373538834137149";

let booted = false;

export function initAnalytics() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  if (GA4_ID) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    // send_page_view off: the SPA reports its own page views on route change,
    // so the initial load isn't counted twice.
    window.gtag("config", GA4_ID, { send_page_view: false });
  }

  if (META_PIXEL_ID) {
    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", META_PIXEL_ID);
  }
}

/** Meta only understands its own standard event names; map ours across. */
const META_EVENTS = {
  generate_lead: "Lead",
  whatsapp_click: "Contact",
  call_click: "Contact",
  email_click: "Contact",
};

/**
 * Report one event to whichever trackers are live. Safe to call always —
 * with no IDs configured this is a no-op.
 */
export function track(name, params = {}) {
  if (typeof window === "undefined") return;
  if (window.gtag) window.gtag("event", name, params);
  if (window.fbq) {
    const std = META_EVENTS[name];
    if (std) window.fbq("track", std, params);
    else window.fbq("trackCustom", name, params);
  }
}

/** SPA route change → one page view on each tracker. */
export function trackPageView(path) {
  if (typeof window === "undefined") return;
  if (window.gtag) window.gtag("event", "page_view", { page_path: path });
  if (window.fbq) window.fbq("track", "PageView");
}
