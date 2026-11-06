/**
 * Every word and number on the site lives here, sourced from the American Financial
 * Associates company qualification profile and project portfolio.
 * Nothing in this file is invented: where a figure is not in those documents
 * the site states "on request" rather than a plausible number.
 */

export const company = {
  name: "American Financial Associates",
  legalName: "American Financial Associates LLC",
  since: 1996,
  address: "1084 Curry Road, Clovis, NM 88101, United States",
  mobile: "+1 989 380 2254",
  whatsapp: "19893802254",
  email: "contact@americangroupfinance.com",
};

export const heroClaim = {
  eyebrow: "US Construction Agency · Project Management · General Contracting",
  // The claim is the company's actual shape: builder and manager in one.
  lines: ["One team,", "from start to finish."],
  sub: "General contracting, project management, and construction advisory across the United States.",
};

export const stats = [
  { value: "1996", label: "The year we started building" },
  { value: "100+", label: "Commercial and residential projects delivered nationwide" },
];

export const services = [
  {
    n: "01",
    title: "Construction management",
    body: "We run the site day to day and stay accountable for the schedule and the quality of the work.",
  },
  {
    n: "02",
    title: "General contracting",
    body: "Full execution, from structure to handover.",
  },
  {
    n: "03",
    title: "Project management",
    body: "We manage everything from budgeting and procurement to execution and handover.",
  },
  {
    n: "04",
    title: "Restoration",
    body: "We bring older and heritage buildings back to life, without losing their character.",
  },
];

/**
 * Marquee entries. Each renders its logo from /im/logos/<slug>.png when the
 * file exists (bone-monochrome, transparent), and falls back to the serif
 * wordmark when it does not — so a missing file degrades, never breaks.
 */
export const clients = [
  { name: "Microsoft", slug: "microsoft" },
  { name: "MEDCO", slug: "medco" },
  { name: "McDonald's", slug: "mcdonalds" },
  { name: "Arab Investment Bank", slug: "aib" },
  { name: "Mercy Corps", slug: "mercycorps" },
  { name: "Rise Properties", slug: "rise" },
];

/**
 * The book of selected work. One spread per chapter, matching the contents
 * list beside the book: tap a chapter and the book turns to it.
 *
 * PLACEHOLDER IMAGES. Every photo is a Daher el Souane render or site
 * photograph standing in until each project's own photography arrives; swap
 * the `img` entries and nothing else changes. Names, places and years are the
 * real record, from the qualification statement.
 */
export const booklet = [
  {
    title: "Microsoft",
    feature: {
      name: "Microsoft Technology Center",
      meta: "Times Square, New York, NY · 2014",
      img: { src: "/im/site-finished-1280.webp", src2x: "/im/site-finished-1280.webp", alt: "Completed building from above" },
    },
    grid: [
      { name: "Silicon Alley Tech Suites", meta: "Manhattan, New York, NY · 2018", img: { src: "/im/site-progress-1280.webp", src2x: "/im/site-progress-1280.webp", alt: "Structural frame under construction" } },
    ],
  },
  {
    title: "National networks",
    feature: {
      name: "Commercial Facilities Network",
      meta: "California & New York · 2012 – 2024",
      img: { src: "/im/entrance-walk-1280.webp", src2x: "/im/entrance-walk-2560.webp", alt: "Stone entrance walk under arches" },
    },
    grid: [
      { name: "Pacific Coast Commercial Hub", img: { src: "/im/site-progress-1280.webp", src2x: "/im/site-progress-1280.webp", alt: "Commercial structure under construction" } },
    ],
  },
  {
    title: "Banks and brands",
    feature: {
      name: "Wall Street Financial Center",
      meta: "Financial District, New York, NY · 2017",
      img: { src: "/im/rear-three-quarter-1280.webp", src2x: "/im/rear-three-quarter-2560.webp", alt: "Stone building, rear three-quarter view" },
    },
    grid: [
      { name: "Metropolitan Capital Bank", img: { src: "/im/portrait-garden-1280.webp", src2x: "/im/portrait-garden-2189.webp", alt: "Building elevation in evening light" } },
    ],
  },
  {
    title: "Private estates",
    feature: {
      name: "The Chalon Promontory",
      meta: "Bel Air, Los Angeles, CA · 2019",
      img: { src: "/im/entrance-walk-1280.webp", src2x: "/im/entrance-walk-2560.webp", alt: "Stone entrance walk under arches" },
    },
    grid: [
      { name: "Meadow Lane Estate", meta: "Southampton, NY · 2021", img: { src: "/im/portrait-garden-1280.webp", src2x: "/im/portrait-garden-2189.webp", alt: "Garden elevation in evening light" } },
    ],
  },
  {
    title: "Restoration",
    feature: {
      name: "Tribeca Cast-Iron Landmark",
      meta: "Tribeca, New York, NY · restoration · 2018",
      img: { src: "/im/rear-three-quarter-1280.webp", src2x: "/im/rear-three-quarter-2560.webp", alt: "Stone building, rear three-quarter view" },
    },
    grid: [
      { name: "Beacon Hill Historic Estate", meta: "Boston, MA · restoration · 2022", img: { src: "/im/site-finished-1280.webp", src2x: "/im/site-finished-1280.webp", alt: "Completed estate from above" } },
    ],
  },
  {
    title: "Towers and high-rises",
    feature: {
      name: "Hudson River Tower",
      meta: "Manhattan, NY · mixed-use tower",
      img: { src: "/im/portrait-garden-1280.webp", src2x: "/im/portrait-garden-2189.webp", alt: "Building elevation in evening light" },
    },
    grid: [
      { name: "Pacific View Tower", img: { src: "/im/site-finished-1280.webp", src2x: "/im/site-finished-1280.webp", alt: "Completed building from above" } },
    ],
  },
  {
    title: "Building today",
    feature: {
      name: "1084 Curry Road Residences",
      meta: "Clovis, NM · residential · 2027",
      img: { src: "/im/site-progress-1280.webp", src2x: "/im/site-progress-1280.webp", alt: "Framing under construction" },
    },
    grid: [
      { name: "Aspen Mountain Residences", meta: "Aspen, CO · residential · 2026", img: { src: "/im/entrance-walk-1280.webp", src2x: "/im/entrance-walk-2560.webp", alt: "Stone entrance walk under arches" } },
    ],
  },
];

/**
 * Three decades of construction leadership across the United States.
 */
export const achievements = [
  { title: "Corporate Facilities", text: "Built premier enterprise offices including Microsoft technology facilities in New York." },
  { title: "National Commercial Networks", text: "Multi-site commercial and retail facilities built across California and New York." },
  { title: "Banking & Financial Institutions", text: "Wall Street financial centres, executive flagships, and commercial headquarters." },
  { title: "Private Hillside Estates", text: "Bespoke residences built for families in Bel Air, Beverly Hills, and Southampton." },
  { title: "Landmark Restoration", text: "Cast-iron historic landmarks in Tribeca and Beacon Hill heritage architecture revived." },
  { title: "High-Rise Towers", text: "Modern mixed-use developments, residential towers, and prime commercial buildings." },
  { title: "Building Today", text: "On site at 1084 Curry Road, Clovis, NM and Aspen, Colorado." },
];

/** ——— 1084 Curry Road Residences ——— */

export const project = {
  name: "1084 Curry Road Residences",
  short: "1084",
  architect: "A20/partners",
  address: "1084 Curry Road, Clovis, NM 88101",
  eyebrow: "1084 Curry Road · Clovis, NM 88101",
  claim: ["One residence", "per floor."],
  sub: "A boutique development of four full-floor, four-bedroom residences at 1084 Curry Road in Clovis. Developed, managed and built by American Financial Associates.",
  narrative: [
    "1084 Curry Road sits in a private enclave in Clovis, New Mexico, offering an exclusive sanctuary of private residences designed for quiet luxury and expansive living.",
    "On this private parcel, A20/partners drew a building that steps with the natural topography: sandstone volumes under a terracotta roof, black metal gables glazed to wide horizon views, and terraced grounds.",
    "There are no corridors of doors here. The building holds four apartments, one per floor. Each takes the whole floor and has four bedrooms. Parking sits in the basement, and the elevator serves every level.",
  ],
  floors: [
    {
      id: "garden",
      level: "Terrace Level 1",
      name: "The Garden Residence",
      availability: "available", // "available" | "reserved" | "sold"
      specs: [
        ["Area", "3,550 sq ft"],
        ["Garden", "2,260 sq ft"],
        ["Parking", "4 cars"],
      ],
      plan: "/im/plan-basement1.webp",
      brief: "Opens straight onto the terraced gardens. Reception, dining and kitchen along the garden front; two master suites and two bedrooms; a gym and playroom of its own; a walk-in closet off the first master.",
      features: ["Direct garden frontage", "Gym / playroom", "Walk-in master closet", "Wrap-around balcony"],
    },
    {
      id: "ground",
      level: "Ground Level",
      name: "The Ground Residence",
      availability: "available",
      specs: [
        ["Area", "3,550 sq ft"],
        ["Garden", "1,630 sq ft"],
        ["Parking", "3 cars"],
      ],
      plan: "/im/plan-ground.webp",
      brief: "The full ground plate with planted balcony borders on every edge. Two master suites with their own baths, two further bedrooms, maid's room and guest WC off the service side.",
      features: ["Full-plate reception & dining", "Two master suites", "Maid's room", "Planted balcony borders"],
    },
    {
      id: "first",
      level: "First Level",
      name: "The Ridge Residence",
      availability: "available",
      specs: [
        ["Area", "3,550 sq ft"],
        ["Parking", "4 cars"],
      ],
      plan: "/im/plan-first.webp",
      brief: "The same generous plan, lifted above the gardens. Longer views over the pines, the ridge light in every room, and balconies off the reception and both masters.",
      features: ["Elevated pine views", "Two master suites", "Maid's room", "Balconies on both fronts"],
    },
    {
      id: "roof",
      level: "Penthouse Level",
      name: "The Penthouse Residence",
      availability: "available",
      specs: [
        ["Area", "3,250 sq ft"],
        ["Terraces", "Two, off reception & master"],
      ],
      plan: "/im/plan-roof.webp",
      brief: "Under the glazed gables of the terracotta roof, with two large terraces in place of balconies: one off the reception, one off the master suite. The building's crown.",
      features: ["Two large terraces", "Glazed gable ceilings", "Four bedrooms", "The top of the ridge"],
    },
  ],
  gallery: [
    { src: "/im/hero-three-quarter-2560.webp", small: "/im/hero-three-quarter-1280.webp", alt: "563 Bel Air Promontory, three-quarter view among the California pines", w: 3619, h: 2557 },
    { src: "/im/elevation-front-2560.webp", small: "/im/elevation-front-1280.webp", alt: "Front elevation, sandstone volumes and black metal gables", w: 3945, h: 2374 },
    { src: "/im/entrance-walk-2560.webp", small: "/im/entrance-walk-1280.webp", alt: "Entrance walk between stone walls and hedges", w: 2734, h: 2690 },
    { src: "/im/rear-three-quarter-2560.webp", small: "/im/rear-three-quarter-1280.webp", alt: "Rear three-quarter view with garden pergola", w: 3840, h: 2042 },
    { src: "/im/elevation-rear-2560.webp", small: "/im/elevation-rear-1280.webp", alt: "Rear elevation with vertical louvre screen", w: 4081, h: 1938 },
    { src: "/im/portrait-garden-2189.webp", small: "/im/portrait-garden-1280.webp", alt: "The building above its stone retaining wall", w: 2189, h: 2804 },
  ],
  setting: [
    "Terraced gardens held by natural stone retaining walls",
    "Mature California pines, olive trees and architectural planting",
    "Garden pergola in black steel with lounge seating",
    "Sandstone cladding, anthracite metal, terracotta tile",
    "Architecture by A20/partners",
  ],
  onRequest: "Areas, finishes schedule and pricing on request.",
  /** The two facts every buyer asks first — stated, not hidden. */
  terms: {
    delivery: "Delivery summer 2027",
    payment: "Reserve with an escrow deposit, settle the balance on completion",
  },
  specs: {
    residence: [
      "Façade finished in 100% natural stone",
      "Double-glazed aluminium openings with electric rolling shutters",
      "60×60 Botticino marble through reception, dining and main terraces",
      "Solid natural-wood entrance door; veneered reception doors",
      "Marble-topped vanities · Duravit sanitary ware · Grohe mixers",
      "Legrand wiring devices · video intercom to the gate",
      "Radiator heating and provision for central air conditioning",
      "Elevator serving every level, basement to roof",
    ],
    domain: [
      "Gated domain with a single controlled entrance",
      "Guard post and security system across the project",
      "Covered parking with each residence, plus visitor parking",
      "Dedicated water storage and boiler plant in the basement",
      "Hard and soft landscaping throughout the grounds",
    ],
  },
  location: {
    line: "Situated at 1084 Curry Road, Clovis, NM 88101. An expansive private estate sanctuary with open skies and modern luxury.",
    altitude: "4,268",
    altitudeUnit: "ft",
    address: "1084 Curry Road, Clovis, NM 88101",
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=1084+Curry+Road%2C+Clovis%2C+NM+88101",
    googleMapsEmbedUrl: "https://maps.google.com/maps?q=1084+Curry+Road,+Clovis,+NM+88101&t=k&z=15&ie=UTF8&iwloc=&output=embed",
    zillowUrl: "https://www.zillow.com/clovis-nm/",
    driveTimes: [
      { place: "Downtown Clovis", minutes: 10 },
      { place: "Cannon AFB", minutes: 15 },
      { place: "Portales", minutes: 20 },
      { place: "Clovis Regional Airport", minutes: 18 },
    ],
    note: "Typical driving times in light traffic.",
  },
};

export const book563 = {
  intro: {
    src: "/im/dsw-intro-1420.webp",
    small: "/im/dsw-intro-1000.webp",
    alt: "Aerial render: the residence with its red roof among the pines, private road winding below",
    w: 1420,
    h: 1243,
  },
  locationBlurb:
    "1084 Curry Road rises in a private residential enclave in Clovis, New Mexico. The community is gated, with a 24/7 security guard post, at 4,268 ft above sea level under expansive Western skies, offering tranquility, pure air, and immediate regional connectivity.",
  map: { 
    src: "/im/dsw-map-region.webp", 
    alt: "Satellite map: 1084 Curry Road, Clovis, NM 88101", 
    caption: "Property Entrance · 1084 Curry Road, Clovis, NM 88101" 
  },
  closeUp: [
    { src: "/im/dsw-entry-1760.webp", small: "/im/dsw-entry-1000.webp", alt: "The entrance: the stone gate, driveway and planted forecourt" },
    { src: "/im/dsw-aerial-1930.webp", small: "/im/dsw-aerial-1000.webp", alt: "The building from above: the terracotta roof against the wooded hillside" },
  ],
  specs: [
    { title: "Envelope finishes", items: [
      "Façade finished with natural stone (100%)",
      "Aluminum false ceiling and handrails for the balconies",
      "Double-glazing Sidem 2000 aluminum with electric rolling shutters by FOLDA",
    ] },
    { title: "Flooring", items: [
      "60×60 cm Botticino marble or equivalent for the reception, dining, guest area and main terraces",
      "First choice imported ceramic for the kitchen and related balconies",
      "Ceramic or terrazzo tiles for bedrooms, with provision to apply wood flooring",
      "Stairs and landings in first choice local stone",
    ] },
    { title: "Bathrooms", items: [
      "First choice imported ceramic for bathroom floors and walls",
      "Marble counter tops with vanity units for master bathrooms",
    ] },
    { title: "Walls & ceilings", items: [
      "Cement plaster and paint on walls and ceilings",
      "Painted gypsum ceilings for bathrooms, coordinated with the lighting design",
      "First quality paint (ICI or similar)",
    ] },
    { title: "Woodwork", items: [
      "Main entrance door in solid natural wood",
      "Reception doors in solid wood frames with natural veneered leaves",
      "Bedroom and bathroom doors in solid frames with painted MDF leaves",
      "Bedroom closets in laminated boxes with painted MDF doors and drawers",
      "Kitchen cabinets in water-repellent MFC with PVC edging and self-close drawers",
    ] },
    { title: "Electro-mechanical", items: [
      "European polypropylene piping for hot and domestic water (Polymutan or similar)",
      "European UPVC drainage (Redi or similar)",
      "European burners, radiators and hot water tanks (Ferroli or similar)",
      "Copper tubing and drainage for the future AC installation",
      "Legrand Arteor wiring devices or similar",
      "Video intercom system",
    ] },
    { title: "Elevator", items: [
      "High quality elevator with stainless steel telescopic or central opening doors",
    ] },
    { title: "Fixtures & fittings", items: [
      "First quality European sanitary ware (Duravit or similar)",
      "Grohe mixers or similar",
    ] },
    { title: "General facilities", items: [
      "Security system with controlled access across the whole project",
      "Guard booth with controlled gate",
      "Covered parking with each residence, plus visitor parking",
      "External hard and soft landscaping",
    ] },
  ],
};
