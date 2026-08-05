/**
 * The demo world: Daher el Souane 563 as it would look mid-construction,
 * seen by one owner (Rami K., the Roof Residence) and by the site team.
 * Every number is internally consistent — payments sum to the unit price,
 * progress matches the diary, the lookahead matches the phase — because the
 * first thing a builder does with a demo is check whether it adds up.
 *
 * DEMO DATA. When the real backend is wired, this file is replaced by
 * Supabase queries and real content published by the team.
 */

export const seed = {
  project: {
    name: "Daher el Souane 563",
    short: "Daher 563",
    location: "Daher el Souane · Mount Lebanon",
    delivery: "Summer 2027",
    hero: "/im/hero-three-quarter-1280.webp",
    overall: 46,
    phases: [
      { name: "Permits", pct: 100 },
      { name: "Earthworks", pct: 100 },
      { name: "Structure", pct: 82 },
      { name: "Envelope", pct: 12 },
      { name: "Finishes", pct: 0 },
      { name: "Handover", pct: 0 },
    ],
    milestones: [
      { name: "Construction permit issued", date: "Jan 2024", done: true },
      { name: "Excavation & retaining walls complete", date: "Sep 2024", done: true },
      { name: "Basement structure complete", date: "May 2025", done: true },
      { name: "Structure top-out", date: "Nov 2026", done: false, next: true },
      { name: "Envelope closed & watertight", date: "Mar 2027", done: false },
      { name: "Finishes complete", date: "Jun 2027", done: false },
      { name: "Handover", date: "Summer 2027", done: false },
    ],
  },

  owner: {
    name: "Rami K.",
    unit: "The Roof Residence",
    level: "Roof Floor",
    plan: "/im/plan-roof.webp",
    photo: "/im/hero-three-quarter-1280.webp",
    area: "300 m²",
    extras: "Two terraces · four bedrooms",
    price: 800000,
    memberSince: "Mar 2026",
    /**
     * What the indexed contract answers with. Live version: the uploaded
     * contract PDF is parsed and chunked into the chat brain; these fields
     * are the demo's stand-in for that index.
     */
    contract: {
      signedOn: "Apr 2, 2026",
      parties: "Rami K. and PMCC S.A.R.L.",
      unitClause: "The Roof Residence — full roof floor, 300 m², two terraces, four bedrooms, two covered parking bays (B2-02, B2-04) and one storage room.",
      paymentClause: "Deposit on reservation, installments tied to certified construction milestones, balance on completion. No installment falls due before its milestone is certified.",
      deliveryClause: "Delivery in Summer 2027, with a 90-day grace period. Beyond grace, a delay compensation of $2,000 per month applies.",
      variationClause: "Changes are priced in writing and built only after the owner's written approval in this portal.",
      warrantyClause: "Twelve months defects liability from handover; structural warranty per Lebanese decennial liability law.",
    },
  },

  diary: [
    {
      id: "d6",
      date: "Aug 1, 2026",
      phase: "Structure — Level 1",
      photo: "/im/site-progress-1280.webp",
      text: "Level 1 slab poured Thursday at first light — 74 m³ in one continuous pour, cured under wet burlap through the weekend heat. Formwork strike begins Tuesday.",
    },
    {
      id: "d5",
      date: "Jul 18, 2026",
      phase: "Structure — Ground",
      photo: "/im/entrance-walk-1280.webp",
      text: "Ground-floor columns complete on the garden front. The entrance walk's retaining geometry is now readable on site — the render below shows where it lands.",
    },
    {
      id: "d4",
      date: "Jul 4, 2026",
      phase: "Site",
      photo: "/im/view-ridge-1280.webp",
      text: "Taken from your roof level this morning. The view your terraces will hold — the valley, the ridge across, the sea haze behind Beirut.",
    },
    {
      id: "d3",
      date: "Jun 20, 2026",
      phase: "Structure — Basement",
      photo: "/im/site-finished-1280.webp",
      text: "Basement 2 plant rooms formed: water storage, boiler room and the parking plate. Waterproofing membrane inspected and closed.",
    },
    {
      id: "d2",
      date: "Jun 6, 2026",
      phase: "Quality",
      photo: "/im/elevation-front-1280.webp",
      text: "Concrete cube results for May pours: all above 32 MPa at 28 days, target 30. Third-party lab certificates filed to the project record.",
    },
    {
      id: "d1",
      date: "May 23, 2026",
      phase: "Programme",
      photo: "/im/portrait-garden-1280.webp",
      text: "Programme revision P6-R4 accepted: structure top-out holds at November, delivery holds at Summer 2027. Two weeks of float retained on the critical path.",
    },
  ],

  lookahead: {
    updated: "Aug 2, 2026",
    weeks: [
      {
        label: "This week",
        range: "Aug 3 – Aug 9",
        items: [
          { t: "Strike Level 1 slab formwork", s: "done" },
          { t: "Level 1 column reinforcement", s: "ready" },
          { t: "Block D water tank pressure test", s: "ready" },
          { t: "Electrical sleeves — Level 1 slab", s: "done" },
        ],
      },
      {
        label: "Next week",
        range: "Aug 10 – Aug 16",
        items: [
          { t: "Pour Level 1 columns", s: "ready" },
          { t: "Roof-level formwork delivery", s: "ready" },
          { t: "Stone sample panel for façade approval", s: "blocked", note: "Supplier ETA Aug 14" },
        ],
      },
      {
        label: "Week after",
        range: "Aug 17 – Aug 23",
        items: [
          { t: "Roof slab formwork begins", s: "ready" },
          { t: "External drainage — garden side", s: "ready" },
          { t: "Site visit day — owners welcome", s: "ready" },
        ],
      },
    ],
  },

  payments: [
    { id: "p1", name: "Reservation", link: "On signature", amount: 50000, state: "paid", date: "Mar 12, 2026", receipt: true },
    { id: "p2", name: "Contract signature", link: "On signature", amount: 120000, state: "paid", date: "Apr 2, 2026", receipt: true },
    { id: "p3", name: "Structure milestone 1", link: "Basement complete", amount: 160000, state: "paid", date: "Jul 8, 2026", receipt: true },
    { id: "p4", name: "Structure top-out", link: "Milestone — Nov 2026", amount: 160000, state: "upcoming" },
    { id: "p5", name: "Envelope closed", link: "Milestone — Mar 2027", amount: 150000, state: "upcoming" },
    { id: "p6", name: "Handover", link: "Keys — Summer 2027", amount: 160000, state: "upcoming" },
  ],

  risks: [
    {
      id: "r1",
      title: "Cement supply interruption",
      shared: "Jun 14, 2026",
      status: "closed",
      body: "National cement plant maintenance paused deliveries for nine days in June. Impact absorbed within programme float — no change to milestones. Closed Jun 28.",
    },
    {
      id: "r2",
      title: "Façade stone lead time",
      shared: "Jul 25, 2026",
      status: "watching",
      body: "The natural stone supplier quotes 10 weeks from approval against 8 planned. Mitigation: sample panel brought forward to Aug 14; order placed immediately on approval. Envelope milestone unchanged for now.",
    },
  ],

  selections: [
    {
      id: "s1",
      title: "Master bathroom stone",
      due: "Sep 15, 2026",
      state: "open",
      body: "Both options are included in your specification — this is a style choice, not a cost change.",
      options: [
        { id: "a", name: "Botticino classico — warm ivory", img: "/im/portrait-garden-1280.webp" },
        { id: "b", name: "Pietra grey — deep graphite", img: "/im/elevation-rear-1280.webp" },
      ],
      chosen: null,
    },
    {
      id: "s2",
      title: "Kitchen counter",
      due: "decided",
      state: "decided",
      chosenName: "Quartz — bone white",
      decidedOn: "Jul 2, 2026",
    },
  ],

  variations: [
    {
      id: "v1",
      title: "Terrace outdoor kitchen provision",
      state: "offered",
      price: 9800,
      time: "No programme impact",
      body: "Gas, water and drainage provision plus counter base to the reception terrace, ready for a future outdoor kitchen. Priced per your request of Jul 20.",
    },
    {
      id: "v2",
      title: "Bedrooms 3+4 combined into second master suite",
      state: "approved",
      price: 14500,
      time: "No programme impact",
      approvedOn: "May 30, 2026",
      body: "Partition omitted, en-suite enlarged, walk-in added. Approved and issued to site — reflected in construction drawings rev. C.",
    },
  ],

  visits: {
    booked: { date: "Thu Aug 21, 2026", time: "10:00", note: "Hard hat and site boots provided at the gate." },
    slots: [
      { id: "t1", date: "Thu Aug 28, 2026", time: "10:00" },
      { id: "t2", date: "Sat Aug 30, 2026", time: "11:30" },
      { id: "t3", date: "Thu Sep 4, 2026", time: "16:00" },
    ],
  },

  documents: [
    { id: "doc1", name: "Sale & purchase contract", meta: "Signed · Apr 2026 · PDF", href: null },
    { id: "doc2", name: "Roof Residence — floor plan", meta: "A20/partners · rev C", href: "/im/plan-roof.webp" },
    { id: "doc3", name: "Finishes schedule", meta: "General specification · PDF", href: null },
    { id: "doc4", name: "Payment schedule annex", meta: "Contract annex 2 · PDF", href: null },
    { id: "doc5", name: "Project booklet", meta: "Dahr el Sawan — Private Residences", href: null },
  ],

  questions: [
    {
      id: "q1",
      from: "Rami K.",
      asked: "Jul 26, 2026",
      q: "Can the second parking bay be nearer the elevator lobby?",
      answered: "Jul 27, 2026",
      a: "Yes — bays B2-04 and B2-05 are both allocated to the Roof Residence; we've swapped B2-05 for B2-02, directly opposite the lobby door. Updated parking plan attached to your documents.",
    },
  ],

  team: {
    members: [{ name: "Site office", role: "Engineer" }, { name: "N. Saleh", role: "Director" }],
    owners: [
      { unit: "The Garden Residence", name: "— unsold —", state: "available", lastSeen: null },
      { unit: "The Ground Residence", name: "— unsold —", state: "available", lastSeen: null },
      { unit: "The First-Floor Residence", name: "— unsold —", state: "available", lastSeen: null },
      { unit: "The Roof Residence", name: "Rami K.", state: "active", lastSeen: "Today, 09:12", opened: "Update of Aug 1 · viewed Aug 1, 21:40" },
    ],
  },
};

/** Phase options a site engineer tags an update with. */
export const PHASES = [
  "Structure — Basement",
  "Structure — Ground",
  "Structure — Level 1",
  "Structure — Roof",
  "Envelope",
  "Finishes",
  "Quality",
  "Programme",
  "Site",
];

/** Photos available to the demo composer (real backend: camera roll). */
export const PHOTO_LIBRARY = [
  "/im/site-progress-1280.webp",
  "/im/site-finished-1280.webp",
  "/im/view-ridge-1280.webp",
  "/im/entrance-walk-1280.webp",
  "/im/elevation-front-1280.webp",
  "/im/portrait-garden-1280.webp",
  "/im/rear-three-quarter-1280.webp",
  "/im/hero-three-quarter-1280.webp",
];
