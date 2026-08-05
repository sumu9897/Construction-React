/**
 * The kit every screen is built from. Small on purpose: one card, one row,
 * one stamp, one ring — repetition is what makes an app feel designed.
 */
import { NavLink, useNavigate } from "react-router-dom";

/* ---------- iconography: 1.5px strokes, quiet ---------- */
const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
export const Icon = {
  home: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z" /></svg>
  ),
  diary: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 9h16M9 4v5" /></svg>
  ),
  plan: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="M8 4v3M16 4v3M4 9.5h16" /><rect x="4" y="5.5" width="16" height="14" rx="1.5" /><path d="M8 14h3M8 17h6" /></svg>
  ),
  money: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><rect x="3.5" y="6" width="17" height="12" rx="1.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9v.01M17.5 15v.01" /></svg>
  ),
  more: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></svg>
  ),
  chat: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="M20 12a8 8 0 1 0-3.1 6.3L20 19l-.9-2.8A7.9 7.9 0 0 0 20 12Z" /></svg>
  ),
  chevron: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="m9 6 6 6-6 6" /></svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
  ),
  doc: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="M7 3.5h7L19 8v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z" /><path d="M14 3.5V8h4.5" /></svg>
  ),
  shield: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="M12 3.5 19 6v6c0 4.4-3 7.4-7 8.5-4-1.1-7-4.1-7-8.5V6Z" /></svg>
  ),
  camera: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.2" /></svg>
  ),
  plus: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="M12 5v14M5 12h14" /></svg>
  ),
  swatch: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="M7 3.5h4v13a4 4 0 1 1-8 0v-9a4 4 0 0 1 4-4Z" /><path d="M11 8.5 15.5 4l4.9 4.9-9.4 9.4M9 16.5h.01" /></svg>
  ),
  compass: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><circle cx="12" cy="12" r="8.5" /><path d="m15 9-2 5-4 2 2-5Z" /></svg>
  ),
  calendar: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><rect x="4" y="5.5" width="16" height="14" rx="1.5" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></svg>
  ),
  bell: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2.5h-15Z" /><path d="M10.5 21a1.8 1.8 0 0 0 3 0" /></svg>
  ),
  out: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M4 12h11M11 8l4 4-4 4" /></svg>
  ),
  inbox: (p) => (
    <svg viewBox="0 0 24 24" {...S} {...p}><path d="M4 13h4l2 3h4l2-3h4" /><path d="M6 5.5h12L21 13v5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-5Z" /></svg>
  ),
};

/* ---------- the real monogram — same file the website wears ---------- */
export function Mark({ className = "h-8 w-8" }) {
  return <img src="/im/logo-mark.png" alt="PMCC" className={`${className} object-contain`} />;
}

/* ---------- layout ---------- */
export function Screen({ children, pad = true }) {
  return (
    <div className={`mx-auto min-h-[100svh] w-full max-w-md pb-32 ${pad ? "px-5" : ""}`}>
      {children}
    </div>
  );
}

export function TopBar({ eyebrow, title, right = null }) {
  return (
    <header className="rise sticky top-0 z-40 -mx-5 mb-6 border-b border-seam bg-ink/92 px-5 pb-4 pt-5 backdrop-blur-sm">
      <div className="flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="type-eyebrow text-smoke">{eyebrow}</p>}
          <h1 className="type-display mt-1 text-3xl text-bone">{title}</h1>
        </div>
        {right}
      </div>
    </header>
  );
}

export function Card({ children, className = "", onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`block w-full border border-seam bg-coal text-left ${onClick ? "transition-colors active:border-stone" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

export function Row({ icon: I, title, meta, badge, onClick, href }) {
  const inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-seam text-stone">
        <I className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-sans text-sm font-semibold text-bone">{title}</span>
        {meta && <span className="mt-0.5 block truncate font-sans text-xs text-smoke">{meta}</span>}
      </span>
      {badge != null && badge !== 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pmcc px-1.5 font-sans text-[0.65rem] font-bold text-bone">
          {badge}
        </span>
      )}
      <Icon.chevron className="h-4 w-4 shrink-0 text-smoke" />
    </>
  );
  const cls = "flex w-full items-center gap-4 border-b border-seam py-3.5 text-left transition-colors active:bg-coal";
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* ---------- atoms ---------- */
export function Stamp({ tone = "red", children }) {
  const tones = {
    red: "border-pmcc/70 text-pmcc",
    stone: "border-stone/70 text-stone",
    smoke: "border-smoke/50 text-smoke",
    green: "border-stone/70 text-stone",
  };
  return (
    <span className={`inline-block border px-2 py-0.5 font-sans text-[0.6rem] font-semibold uppercase tracking-wideish ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Btn({ children, tone = "red", full = false, ...rest }) {
  const tones = {
    red: "bg-pmcc text-bone active:bg-pmcc/85",
    ghost: "border border-seam text-bone active:border-stone",
    bone: "bg-bone text-ink active:bg-bone/90",
  };
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 px-5 py-3.5 font-sans text-sm font-semibold transition-colors disabled:opacity-50 ${tones[tone]} ${full ? "w-full" : ""} ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/** The signature element: one number, drawn as an arc. */
export function Ring({ pct, size = 148, label = "complete" }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2722" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#C8102E"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.19,1,0.22,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="type-display text-4xl text-bone">
          {pct}
          <span className="text-xl text-stone">%</span>
        </p>
        <p className="type-eyebrow mt-1 text-smoke">{label}</p>
      </div>
    </div>
  );
}

/**
 * The colour language, stated once — the site-board traffic light:
 * green = completed, yellow = on track, red = delayed, grey = not started.
 * Muted tones so they sit inside the brand's dark palette.
 */
export const COLORS = {
  done: "#55996A",
  ready: "#D9A441",
  blocked: "#C8102E",
  todo: "#8F887C",
};
export const STATE_META = {
  done: { dot: "bg-[#55996A]", label: "Completed" },
  ready: { dot: "bg-[#D9A441]", label: "On track" },
  blocked: { dot: "bg-pmcc", label: "Delayed" },
  todo: { dot: "bg-smoke/50", label: "Not started" },
};

export function StateDot({ s }) {
  return <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${STATE_META[s]?.dot ?? "bg-smoke/40"}`} />;
}

export function StateLegend() {
  return (
    <div className="flex items-center gap-5 font-sans text-[0.65rem] uppercase tracking-wideish text-smoke">
      {Object.entries(STATE_META).map(([k, m]) => (
        <span key={k} className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${m.dot}`} /> {m.label}
        </span>
      ))}
    </div>
  );
}

/* ---------- navigation ---------- */
export function TabBar({ tabs }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-seam bg-ink/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-md items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {tabs.map(({ to, label, icon: I, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-3 font-sans text-[0.62rem] font-semibold uppercase tracking-wideish transition-colors ${
                isActive ? "text-bone" : "text-smoke"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <I className={`h-5 w-5 ${isActive ? "text-pmcc" : ""}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Back({ to = -1, label = "Back" }) {
  const nav = useNavigate();
  return (
    <button
      type="button"
      onClick={() => nav(to)}
      className="mb-4 mt-5 inline-flex items-center gap-1 font-sans text-xs text-smoke transition-colors active:text-bone"
    >
      <Icon.chevron className="h-3.5 w-3.5 rotate-180" /> {label}
    </button>
  );
}
