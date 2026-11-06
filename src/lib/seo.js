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
 * in <head> at that moment. The baked-in copy is the one that
 * reliably earns the enquiry.
 */

export const SITE = "https://pmcclb.com";

/** Absolute, because a relative og:image is silently ignored by every scraper. */
const abs = (path) => `${SITE}${path}`;

export const PAGES = {
  home: {
    path: "/",
    title: "American Financial Associates · US Construction Agency & Project Management",
    description:
      "American Financial Associates LLC. Premier US construction agency delivering general contracting, construction management, and capital project execution nationwide. Contact: contact@americangroupfinance.com.",
    // Dedicated 1200×630 JPEG cards: exactly the aspect the scrapers crop
    // to, and JPEG because WhatsApp/Facebook handle webp og:images unreliably.
    // Two cards on purpose — the company link previews as the brand, the
    // development link previews as the building.
    // ?v= is for Meta's image CDN, which caches by exact URL and ignores
    // re-scrapes: bump it whenever the card's pixels change, or WhatsApp
    // and Facebook keep showing the previous artwork indefinitely.
    image: abs("/im/og-card-home.jpg?v=4"),
    imageAlt: "American Financial Associates · One team, from start to finish. US Construction Agency.",
  },
  project: {
    path: "/daher-el-souane-563",
    title: "1084 Curry Road · Four-Bedroom Full-Floor Residences, Clovis, NM",
    description:
      "Four full-floor residences of 3,550 sq ft at 1084 Curry Road, Clovis, NM 88101. Private gardens and terraces, delivery summer 2027. Developed, managed and built by American Financial Associates.",
    image: abs("/im/og-card.jpg?v=2"),
    imageAlt: "1084 Curry Road Residences, three-quarter view among the pines",
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
  name: "American Financial Associates",
  legalName: "American Financial Associates LLC",
  url: SITE,
  logo: abs("/im/logo.png"),
  image: abs("/im/hero-three-quarter-1280.webp"),
  foundingDate: "1996",
  description:
    "Premier US construction agency delivering general contracting, project management, and construction advisory. One team, from budgeting to handover.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1084 Curry Road",
    addressLocality: "Clovis",
    addressRegion: "NM",
    postalCode: "88101",
    addressCountry: "US",
  },
  telephone: "+1 989 380 2254",
  email: "contact@americangroupfinance.com",
  areaServed: { "@type": "Country", name: "United States" },
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
  name: "1084 Curry Road Residences",
  url: `${SITE}/daher-el-souane-563`,
  description:
    "A boutique residential building of four full-floor, four-bedroom residences at 1084 Curry Road, Clovis, NM 88101. One apartment per floor, private elevator to every level, secure underground parking. Architecture by A20/partners; developed, managed and built by American Financial Associates.",
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
    streetAddress: "1084 Curry Road",
    addressLocality: "Clovis",
    addressRegion: "NM",
    postalCode: "88101",
    addressCountry: "US",
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
