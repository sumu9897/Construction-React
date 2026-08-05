/**
 * Per-page metadata.
 *
 * One source of truth, used twice: `scripts/prerender-meta.mjs` bakes these
 * into a static HTML file per route at build time, and `useSeo` applies the
 * same values on client-side navigation.
 *
 * Both are needed, for different readers. Google renders JavaScript, so it
 * would eventually see the client-side version — but WhatsApp, Facebook,
 * LinkedIn and iMessage do NOT. They fetch the raw HTML and read whatever is
 * in <head> at that moment. In Lebanon the link is forwarded on WhatsApp far
 * more often than it is found on Google, so the baked-in copy is the one that
 * actually earns the enquiry.
 */

export const SITE = "https://pmcclb.com";

/** Absolute, because a relative og:image is silently ignored by every scraper. */
const abs = (path) => `${SITE}${path}`;

export const PAGES = {
  home: {
    path: "/",
    title: "PMCC · General Contracting & Project Management, Lebanon",
    description:
      "PMCC S.A.R.L. General contracting and project management across Lebanon since 1996. Microsoft, MEDCO, McDonald's and Arab Investment Bank among past clients. Now selling: Daher el Souane 563.",
    // Dedicated 1200×630 JPEG cards: exactly the aspect the scrapers crop
    // to, and JPEG because WhatsApp/Facebook handle webp og:images unreliably.
    // Two cards on purpose — the company link previews as the brand, the
    // development link previews as the building.
    // ?v= is for Meta's image CDN, which caches by exact URL and ignores
    // re-scrapes: bump it whenever the card's pixels change, or WhatsApp
    // and Facebook keep showing the previous artwork indefinitely.
    image: abs("/im/og-card-home.jpg?v=4"),
    imageAlt: "PMCC · One team, from start to finish. General contracting and project management, Lebanon.",
  },
  project: {
    path: "/daher-el-souane-563",
    title: "Daher el Souane 563 · Four-Bedroom Full-Floor Apartments, Mount Lebanon",
    description:
      "Four full-floor residences of 330 m², one per floor, four bedrooms each, in a gated domain 900 m above Beirut. Private gardens and terraces, delivery summer 2027. Developed, managed and built by PMCC.",
    image: abs("/im/og-card.jpg?v=2"),
    imageAlt: "Daher el Souane 563, three-quarter view among the umbrella pines",
  },
};

/**
 * Structured data. This is what lets Google show the company in Maps and
 * local results, and what makes the development eligible for the richer
 * real-estate listing treatment rather than a plain blue link.
 */
export const ORGANISATION_LD = {
  "@context": "https://schema.org",
  "@type": "GeneralContractor",
  "@id": `${SITE}/#organisation`,
  name: "PMCC",
  legalName: "Project Management and Construction Company S.A.R.L.",
  url: SITE,
  logo: abs("/im/logo.png"),
  image: abs("/im/hero-three-quarter-1280.webp"),
  foundingDate: "1996",
  description:
    "General contracting and project management across Lebanon since 1996. One team, from budgeting to handover.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Al-Bustan Building, Amaret Chalhoub, Nahr El Mot Highway",
    addressRegion: "Metn",
    addressCountry: "LB",
  },
  telephone: "+961 3 616 222",
  email: "info@pmcclb.com",
  areaServed: { "@type": "Country", name: "Lebanon" },
  knowsAbout: [
    "Construction management",
    "General contracting",
    "Residential development",
    "Heritage restoration",
    "Commercial fit-out",
  ],
};

export const PROJECT_LD = {
  "@context": "https://schema.org",
  "@type": "ApartmentComplex",
  "@id": `${SITE}/daher-el-souane-563#development`,
  name: "Daher el Souane 563",
  url: `${SITE}/daher-el-souane-563`,
  description:
    "A boutique building of four full-floor, four-bedroom residences on a terraced garden site in Daher el Souane, Mount Lebanon. One apartment per floor, elevator to every level, basement parking. Architecture by A20/partners; developed, managed and built by PMCC.",
  image: [
    abs("/im/hero-three-quarter-2560.webp"),
    abs("/im/elevation-front-2560.webp"),
    abs("/im/portrait-garden-2189.webp"),
  ],
  numberOfAccommodationUnits: 4,
  numberOfBedrooms: 4,
  petsAllowed: true,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Daher el Souane",
    addressRegion: "Mount Lebanon",
    addressCountry: "LB",
  },
  amenityFeature: [
    { "@type": "LocationFeatureSpecification", name: "One residence per floor", value: true },
    { "@type": "LocationFeatureSpecification", name: "Elevator to every level", value: true },
    { "@type": "LocationFeatureSpecification", name: "Terraced private gardens", value: true },
    { "@type": "LocationFeatureSpecification", name: "Basement parking", value: true },
  ],
  developer: { "@id": `${SITE}/#organisation` },
};

/** Set or replace one meta/link tag in the live document. */
function setTag(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(attrs.rel ? "link" : "meta");
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
}

/**
 * Apply a page's metadata to the live document. Used on client-side route
 * changes, where the baked-in HTML no longer describes what is on screen.
 */
export function applySeo(key) {
  const page = PAGES[key];
  if (!page || typeof document === "undefined") return;

  const url = `${SITE}${page.path}`;
  document.title = page.title;

  setTag('meta[name="description"]', { name: "description", content: page.description });
  setTag('link[rel="canonical"]', { rel: "canonical", href: url });

  setTag('meta[property="og:title"]', { property: "og:title", content: page.title });
  setTag('meta[property="og:description"]', { property: "og:description", content: page.description });
  setTag('meta[property="og:image"]', { property: "og:image", content: page.image });
  setTag('meta[property="og:url"]', { property: "og:url", content: url });
  setTag('meta[property="og:type"]', { property: "og:type", content: "website" });

  setTag('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  setTag('meta[name="twitter:title"]', { name: "twitter:title", content: page.title });
  setTag('meta[name="twitter:description"]', { name: "twitter:description", content: page.description });
  setTag('meta[name="twitter:image"]', { name: "twitter:image", content: page.image });
}
