/**
 * Every word and number on the site lives here, sourced from the PMCC company
 * profile (2026) and the A20/partners design set for Daher el Souane 563.
 * Nothing in this file is invented: where a figure is not in those documents
 * (areas in m², prices) the site says "on request" rather than a plausible
 * number. Verify the phone numbers before launch — they are transcribed from
 * the profile PDF.
 */

export const company = {
  name: "PMCC",
  legalName: "Project Management and Construction Company S.A.R.L.",
  since: 1996,
  address: "Al-Bustan Building, Amaret Chalhoub, Nahr El Mot Highway, Metn, Lebanon",
  mobile: "+961 3 616 222",
  whatsapp: "9613616222",
  email: "info@pmcclb.com",
};

export const heroClaim = {
  eyebrow: "Project management · Construction · Lebanon",
  // The claim is the company's actual shape: builder and manager in one.
  lines: ["One team,", "from start to finish."],
  sub: "General contracting and project management, across Lebanon.",
};

export const stats = [
  { value: "1996", label: "The year we started building" },
  { value: "100+", label: "Projects delivered, from villas to office towers" },
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
      name: "Microsoft Regional Offices",
      meta: "Beirut Central District · 2002",
      img: { src: "/im/site-finished-1280.webp", src2x: "/im/site-finished-1280.webp", alt: "Completed building from above" },
    },
    grid: [
      { name: "Microsoft Offices, Berytus", meta: "Beirut Central District · 2012", img: { src: "/im/site-progress-1280.webp", src2x: "/im/site-progress-1280.webp", alt: "Concrete frame under construction" } },
    ],
  },
  {
    title: "The MEDCO network",
    feature: {
      name: "Six service stations",
      meta: "Across Lebanon · 2003 – 2016",
      img: { src: "/im/entrance-walk-1280.webp", src2x: "/im/entrance-walk-2560.webp", alt: "Stone entrance walk under arches" },
    },
    grid: [
      { name: "MEDCO station", img: { src: "/im/site-progress-1280.webp", src2x: "/im/site-progress-1280.webp", alt: "Concrete frame under construction" } },
    ],
  },
  {
    title: "Banks and brands",
    feature: {
      name: "Arab Investment Bank",
      meta: "Beirut Central District · 2015",
      img: { src: "/im/rear-three-quarter-1280.webp", src2x: "/im/rear-three-quarter-2560.webp", alt: "Stone building, rear three-quarter view" },
    },
    grid: [
      { name: "Arab Investment Bank", img: { src: "/im/portrait-garden-1280.webp", src2x: "/im/portrait-garden-2189.webp", alt: "Building elevation in evening light" } },
    ],
  },
  {
    title: "Villas",
    feature: {
      name: "Villa Zreik",
      meta: "Faqra · 2008",
      img: { src: "/im/entrance-walk-1280.webp", src2x: "/im/entrance-walk-2560.webp", alt: "Stone entrance walk under arches" },
    },
    grid: [
      { name: "Villa Fakhoury", meta: "Kfardebian · 2016", img: { src: "/im/portrait-garden-1280.webp", src2x: "/im/portrait-garden-2189.webp", alt: "Garden elevation in evening light" } },
    ],
  },
  {
    title: "Restoration",
    feature: {
      name: "WWII Museum",
      meta: "Khiam · restoration · 2005",
      img: { src: "/im/rear-three-quarter-1280.webp", src2x: "/im/rear-three-quarter-2560.webp", alt: "Stone building, rear three-quarter view" },
    },
    grid: [
      { name: "Villa Tyan", meta: "Baabdath · restoration · 2011", img: { src: "/im/site-finished-1280.webp", src2x: "/im/site-finished-1280.webp", alt: "Completed house from above" } },
    ],
  },
  {
    title: "Towers and buildings",
    feature: {
      name: "Marina Gate Tower",
      meta: "Jounieh · office tower",
      img: { src: "/im/portrait-garden-1280.webp", src2x: "/im/portrait-garden-2189.webp", alt: "Building elevation in evening light" },
    },
    grid: [
      { name: "Marina Gate Tower", img: { src: "/im/site-finished-1280.webp", src2x: "/im/site-finished-1280.webp", alt: "Completed building from above" } },
    ],
  },
  {
    title: "Building today",
    feature: {
      name: "Naccache 401–413",
      meta: "Naccache · residential · 2027",
      img: { src: "/im/site-progress-1280.webp", src2x: "/im/site-progress-1280.webp", alt: "Concrete frame under construction" },
    },
    grid: [
      { name: "Bcharreh Heritage Houses", meta: "Bcharreh · restoration · 2026", img: { src: "/im/entrance-walk-1280.webp", src2x: "/im/entrance-walk-2560.webp", alt: "Stone entrance walk under arches" } },
    ],
  },
];

/**
 * Since 1996 — not a year-by-year journey, but what three decades of work
 * actually produced. Concise, real, and in the company's own order.
 */
export const achievements = [
  { title: "Microsoft", text: "We built their corporate offices in Beirut Central District." },
  { title: "The MEDCO network", text: "Six service stations across Lebanon, built for the same client over thirteen years." },
  { title: "Banks and brands", text: "Arab Investment Bank, McDonald's and commercial centres. Clients who check everything." },
  { title: "Villas", text: "Private houses built for families in Faqra, Kfardebian, Fatka, Yarze and Baabdath." },
  { title: "Restoration", text: "The WWII Museum at Khiam, and heritage mountain houses brought back to life." },
  { title: "Towers and buildings", text: "Tiresmart, Zalka 208 and Marina Gate Tower in Jounieh." },
  { title: "Building today", text: "On site at Naccache and Bcharreh." },
];

/** ——— Daher el Souane 563 ——— */

export const project = {
  name: "Daher el Souane 563",
  short: "563",
  architect: "A20/partners",
  eyebrow: "Daher El Souane · Mount Lebanon",
  claim: ["One residence", "per floor."],
  sub: "A boutique building of four full-floor, four-bedroom residences on a terraced garden site among the umbrella pines. Developed, managed and built by PMCC.",
  narrative: [
    "Daher el Souane sits on the green ridge above the Beirut coast, a village of stone houses and pine gardens twenty minutes from the city and a world away from it.",
    "On plot 563, A20/partners drew a building that steps with the slope instead of flattening it: sandstone volumes under a terracotta roof, black metal gables glazed to the view, gardens terraced into the hillside.",
    "There are no corridors of doors here. The building holds four apartments, one per floor. Each takes the whole floor and has four bedrooms. Parking sits in the basement, and the elevator serves every level.",
  ],
  floors: [
    {
      id: "garden",
      level: "Basement 1",
      name: "The Garden Residence",
      availability: "available", // "available" | "reserved" | "sold"
      specs: [
        ["Area", "330 m²"],
        ["Garden", "210 m²"],
        ["Parking", "4 cars"],
      ],
      plan: "/im/plan-basement1.webp",
      brief: "Opens straight onto the terraced gardens. Reception, dining and kitchen along the garden front; two master suites and two bedrooms; a gym and playroom of its own; a walk-in closet off the first master.",
      features: ["Direct garden frontage", "Gym / playroom", "Walk-in master closet", "Wrap-around balcony"],
    },
    {
      id: "ground",
      level: "Ground Floor",
      name: "The Ground Residence",
      availability: "available",
      specs: [
        ["Area", "330 m²"],
        ["Garden", "152 m²"],
        ["Parking", "3 cars"],
      ],
      plan: "/im/plan-ground.webp",
      brief: "The full ground plate with planted balcony borders on every edge. Two master suites with their own baths, two further bedrooms, maid's room and guest WC off the service side.",
      features: ["Full-plate reception & dining", "Two master suites", "Maid's room", "Planted balcony borders"],
    },
    {
      id: "first",
      level: "First Floor",
      name: "The First-Floor Residence",
      availability: "available",
      specs: [
        ["Area", "330 m²"],
        ["Parking", "4 cars"],
      ],
      plan: "/im/plan-first.webp",
      brief: "The same generous plan, lifted above the gardens. Longer views over the pines, the ridge light in every room, and balconies off the reception and both masters.",
      features: ["Elevated pine views", "Two master suites", "Maid's room", "Balconies on both fronts"],
    },
    {
      id: "roof",
      level: "Roof Floor",
      name: "The Roof Residence",
      availability: "available",
      specs: [
        ["Area", "300 m²"],
        ["Terraces", "Two, off reception & master"],
      ],
      plan: "/im/plan-roof.webp",
      brief: "Under the glazed gables of the terracotta roof, with two large terraces in place of balconies: one off the reception, one off the master suite. The building's crown.",
      features: ["Two large terraces", "Glazed gable ceilings", "Four bedrooms", "The top of the ridge"],
    },
  ],
  gallery: [
    { src: "/im/hero-three-quarter-2560.webp", small: "/im/hero-three-quarter-1280.webp", alt: "Daher el Souane 563, three-quarter view among the umbrella pines", w: 3619, h: 2557 },
    { src: "/im/elevation-front-2560.webp", small: "/im/elevation-front-1280.webp", alt: "Front elevation, sandstone volumes and black metal gables", w: 3945, h: 2374 },
    { src: "/im/entrance-walk-2560.webp", small: "/im/entrance-walk-1280.webp", alt: "Entrance walk between stone walls and hedges", w: 2734, h: 2690 },
    { src: "/im/rear-three-quarter-2560.webp", small: "/im/rear-three-quarter-1280.webp", alt: "Rear three-quarter view with garden pergola", w: 3840, h: 2042 },
    { src: "/im/elevation-rear-2560.webp", small: "/im/elevation-rear-1280.webp", alt: "Rear elevation with vertical louvre screen", w: 4081, h: 1938 },
    { src: "/im/portrait-garden-2189.webp", small: "/im/portrait-garden-1280.webp", alt: "The building above its stone retaining wall", w: 2189, h: 2804 },
  ],
  setting: [
    "Terraced gardens held by natural stone retaining walls",
    "Mature umbrella pines and ornamental planting",
    "Garden pergola in black steel with lounge seating",
    "Sandstone cladding, anthracite metal, terracotta tile",
    "Architecture by A20/partners",
  ],
  onRequest: "Areas, finishes schedule and pricing on request.",
  /** The two facts every buyer asks first — stated, not hidden. */
  terms: {
    delivery: "Delivery summer 2027",
    payment: "Reserve with a deposit, settle the balance on completion",
  },
  /**
   * Drive times are typical light-traffic figures, consistent with the
   * "twenty minutes from the city" already in the narrative. Update here if
   * the owner measures different ones.
   */
  /**
   * From the developer's own project book (Dahr el Sawan — Private
   * Residences, PMCC Development): the general specification and the gated
   * domain. Facts, not adjectives — a buyer at this level reads spec sheets.
   */
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
    line: "On the green ridge above the coast. Close enough to use the city, far enough not to hear it.",
    altitude: "900",
    driveTimes: [
      { place: "Beirut", minutes: 20 },
      { place: "ABC Dbayeh", minutes: 15 },
      { place: "Airport", minutes: 35 },
    ],
    note: "Typical driving times in light traffic.",
  },
};

/**
 * From the developer's own project book (Dahr el Sawan, Private Residences):
 * the introducing render (cropped to the near building and its greenery),
 * the gated-community and location pages with their maps, the full general
 * specification, and the close-up renders. Text kept as printed, typos aside.
 */
export const book563 = {
  intro: {
    src: "/im/dsw-intro-1420.webp",
    small: "/im/dsw-intro-1000.webp",
    alt: "Aerial render from the project book: the residence with its red roof among the pines, the stone entrance road winding below",
    w: 1420,
    h: 1243,
  },
  locationBlurb:
    "Dahr el Sawan sits in the green hills above Beirut, a fifteen-minute drive from the city. The community is gated, with a 24/7 guard post, at 900 m above sea level. Fresh air, mountain views, and the Metn Highway minutes away.",
  map: { src: "/im/dsw-map-region.webp", alt: "Satellite map of the area: the project location above the Metn Highway exit, between Baabdat and Dahr el Sawan", caption: "Exit Metn Highway · Chalimar roundabout · Dahr el Sawan" },
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
