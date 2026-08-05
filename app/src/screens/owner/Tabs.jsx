/**
 * The owner's five tabs. Home is the five-second story; Diary is the page
 * they'll open weekly for two years; Plan is Procore's lookahead in plain
 * words; Money is the no-misunderstanding ledger; More is everything else.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore, usd } from "../../store";
import { Screen, TopBar, Card, Row, Stamp, Ring, StateDot, StateLegend, Icon, Btn } from "../../ui";

/** The one-line answer to "are we late?" — set by the team, seen by all. */
function OutlookLine({ project, className = "" }) {
  const o = project.outlook;
  const tone = { ontrack: "bg-[#55996A]", watch: "bg-[#D9A441]", atrisk: "bg-pmcc" }[o?.state] ?? "bg-[#55996A]";
  const text = o?.note ?? `On track — delivery ${project.delivery}.`;
  return (
    <p className={`flex items-start gap-3 font-sans text-xs leading-relaxed text-bone/85 ${className}`}>
      <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${tone}`} />
      <span>
        <span className="font-semibold uppercase tracking-wideish text-smoke">Delivery outlook · </span>
        {text}
      </span>
    </p>
  );
}
import { IS_LIVE, sb } from "../../lib/supabase";
import { openDoc } from "../../lib/storage";
import { markDiaryRead } from "../../live/sync";

/* ------------------------------------------------ Home */
export function Home() {
  const { state } = useStore();
  const { project, owner, diary, lookahead } = state;
  const latest = diary[0];
  const thisWeek = lookahead.weeks[0];
  const nextMilestone = project.milestones.find((m) => m.next);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <Screen>
      <TopBar
        eyebrow={project.name}
        title={`${greet}, ${owner.name.split(" ")[0]}`}
        right={
          <Link to="/more" aria-label="Notifications" className="flex h-10 w-10 items-center justify-center border border-seam text-stone">
            <Icon.bell className="h-[18px] w-[18px]" />
          </Link>
        }
      />

      {/* The residence — the building itself, not a drawing. */}
      <Card className="rise rise-1 overflow-clip">
        <div className="relative">
          <img src={owner.photo} alt={owner.unit} className="aspect-[16/9] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-center gap-2">
              {owner.level && <p className="type-eyebrow text-stone">{owner.level}</p>}
              <Stamp tone="red">Yours</Stamp>
            </div>
            <p className="type-display mt-1 truncate text-2xl text-bone">{owner.unit}</p>
            {(owner.area || owner.extras) && (
              <p className="mt-1 font-sans text-xs text-bone/80">
                {[owner.area, owner.extras].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Progress */}
      <Card className="rise rise-2 mt-4 p-5">
        <div className="flex items-center gap-6">
          <Ring pct={project.overall} />
          <div className="min-w-0 flex-1">
            {project.phases.map((p) => (
              <div key={p.name} className="mb-2.5 last:mb-0">
                <div className="flex items-baseline justify-between font-sans text-[0.65rem] uppercase tracking-wideish">
                  <span className={p.pct > 0 ? "text-bone" : "text-smoke"}>{p.name}</span>
                  <span className="tabular-nums text-smoke">{p.pct}%</span>
                </div>
                <div className="mt-1 h-px bg-seam">
                  <div className="h-full bg-stone" style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {nextMilestone && (
          <p className="mt-4 border-t border-seam pt-3 font-sans text-xs text-smoke">
            Next milestone — <span className="text-bone">{nextMilestone.name}</span> · {nextMilestone.date}.
          </p>
        )}
        <OutlookLine project={project} className="mt-3 border-t border-seam pt-3" />
      </Card>

      {/* This week */}
      <Link to="/plan" className="rise rise-3 mt-4 block">
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <p className="type-eyebrow text-smoke">On site this week</p>
            <span className="font-sans text-xs text-stone">{thisWeek.range} →</span>
          </div>
          <ul className="mt-3 space-y-2">
            {thisWeek.items.slice(0, 3).map((it) => (
              <li key={it.t} className="flex items-start gap-3 font-sans text-sm text-bone/90">
                <StateDot s={it.s} />
                {it.t}
              </li>
            ))}
          </ul>
        </Card>
      </Link>

      {/* Latest from the diary */}
      <Link to="/diary" className="rise rise-4 mt-4 block">
        <Card>
          <img src={latest.photo} alt="" className="aspect-[16/10] w-full object-cover" />
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="type-eyebrow text-stone">{latest.date}</p>
              <Stamp tone="stone">{latest.phase}</Stamp>
            </div>
            <p className="mt-2 line-clamp-2 font-sans text-sm leading-relaxed text-bone/90">{latest.text}</p>
            <p className="mt-3 font-sans text-xs font-semibold text-pmcc">Open the diary →</p>
          </div>
        </Card>
      </Link>
    </Screen>
  );
}

/* ------------------------------------------------ Diary */
export function Diary() {
  const { state } = useStore();
  const [open, setOpen] = useState(null);
  // Opening this tab IS the read — receipt every entry on screen, once.
  useEffect(() => {
    if (IS_LIVE) markDiaryRead(state.diary.slice(0, 20).map((d) => d.id));
  }, [state.diary]);
  return (
    <Screen>
      <TopBar eyebrow="The record of your build" title="Site diary" />
      {state.diary.map((d, i) => (
        <Card key={d.id} className={`mb-5 ${i < 4 ? `rise rise-${i + 1}` : ""}`}>
          <button type="button" onClick={() => setOpen(d)} className="block w-full">
            <img src={d.photo} alt="" className="aspect-[16/10] w-full object-cover" />
          </button>
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="type-eyebrow text-stone">{d.date}</p>
              <Stamp tone="stone">{d.phase}</Stamp>
            </div>
            {d.activity && (
              <p className="mt-1.5 font-sans text-[0.65rem] uppercase tracking-wideish text-smoke">{d.activity}</p>
            )}
            <p className="mt-2.5 font-sans text-sm leading-relaxed text-bone/90">{d.text}</p>
          </div>
        </Card>
      ))}
      <p className="pb-4 text-center font-sans text-xs text-smoke">
        Every entry is timestamped and kept — this diary is part of your project record.
      </p>
      {open && (
        <button
          type="button"
          aria-label="Close photo"
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/95 p-3"
        >
          <img src={open.photo} alt="" className="max-h-full w-full object-contain" />
          <span className="absolute bottom-8 left-0 right-0 px-8 text-center font-sans text-xs text-smoke">
            {open.date} · {open.phase} — tap to close
          </span>
        </button>
      )}
    </Screen>
  );
}

/* ------------------------------------------------ Plan */
export function Plan() {
  const { state } = useStore();
  const { lookahead, project } = state;
  return (
    <Screen>
      <TopBar eyebrow="Three-week look-ahead" title="The plan" />
      {lookahead.weeks.map((w, i) => (
        <Card key={w.label} className={`mb-4 p-5 rise rise-${i + 1}`}>
          <div className="flex items-baseline justify-between">
            <p className="type-display text-xl text-bone">{w.label}</p>
            <p className="font-sans text-xs tabular-nums text-smoke">{w.range}</p>
          </div>
          <ul className="mt-4 space-y-3">
            {w.items.map((it) => (
              <li key={it.t} className="flex items-start gap-3 border-t border-seam pt-3 first:border-t-0 first:pt-0">
                <StateDot s={it.s} />
                <div className="min-w-0 flex-1">
                  <p className={`font-sans text-sm ${it.s === "done" ? "text-smoke line-through" : "text-bone/90"}`}>{it.t}</p>
                  {it.note && <p className="mt-0.5 font-sans text-xs text-smoke">{it.note}</p>}
                </div>
                {it.d && <span className="shrink-0 font-sans text-[0.65rem] tabular-nums text-smoke">{it.d}</span>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <div className="mb-4 px-1">
        <StateLegend />
      </div>

      <Card className="p-5">
        <OutlookLine project={project} />
      </Card>

      <p className="mt-4 px-1 pb-4 font-sans text-xs leading-relaxed text-smoke">
        Drawn from the site programme · updated {lookahead.updated}.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------ Money */
export function Money() {
  const { state } = useStore();
  const { payments, owner, variations } = state;
  const approvedVars = variations.filter((v) => v.state === "approved");
  const varTotal = approvedVars.reduce((s, v) => s + v.price, 0);
  const total = owner.price + varTotal;
  const paid = payments.filter((p) => p.state === "paid").reduce((s, p) => s + p.amount, 0);
  return (
    <Screen>
      <TopBar eyebrow={owner.unit} title="Payments" />
      <Card className="rise rise-1 p-5">
        <div className="flex items-baseline justify-between">
          <p className="type-eyebrow text-smoke">Contract value</p>
          <p className="type-display text-2xl text-bone">{usd(total)}</p>
        </div>
        {varTotal > 0 && (
          <p className="mt-1 text-right font-sans text-xs text-smoke">
            incl. approved variations {usd(varTotal)}
          </p>
        )}
        <div className="mt-4 h-1 bg-seam">
          <div className="h-full bg-pmcc transition-all duration-700" style={{ width: `${(paid / total) * 100}%` }} />
        </div>
        <div className="mt-2 flex justify-between font-sans text-xs text-smoke">
          <span>
            Paid <span className="tabular-nums text-bone">{usd(paid)}</span>
          </span>
          <span>
            Remaining <span className="tabular-nums text-bone">{usd(total - paid)}</span>
          </span>
        </div>
      </Card>

      <div className="rise rise-2 mt-6">
        {payments.map((p) => (
          <div key={p.id} className="border-b border-seam py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-sans text-sm font-semibold text-bone">{p.name}</p>
              <p className="type-display shrink-0 text-lg text-bone">{usd(p.amount)}</p>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="font-sans text-xs text-smoke">{p.link}</p>
              {p.state === "paid" ? (
                <span className="flex items-center gap-2">
                  <Stamp tone="stone">Paid · {p.date}</Stamp>
                  {p.receipt && (
                    <button
                      type="button"
                      onClick={() =>
                        p.receiptPath
                          ? openDoc(p.receiptPath).catch((e) => alert(`Could not open: ${e.message ?? e}`))
                          : null
                      }
                      className="font-sans text-[0.65rem] text-smoke underline underline-offset-2"
                    >
                      receipt
                    </button>
                  )}
                </span>
              ) : (
                <Stamp tone="smoke">Upcoming</Stamp>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 pb-4 font-sans text-xs leading-relaxed text-smoke">
        Each installment is tied to a construction milestone — you pay for what you can see built.
        Figures shown are yours alone.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------ More */
export function More() {
  const { state, dispatch } = useStore();
  const nav = useNavigate();
  const openSelections = state.selections.filter((s) => s.state === "open").length;
  const offeredVars = state.variations.filter((v) => v.state === "offered").length;
  const watching = state.risks.filter((r) => r.status !== "closed").length;
  return (
    <Screen>
      <TopBar eyebrow={state.project.name} title="More" />
      <div className="rise rise-1">
        <Row icon={Icon.shield} title="Risks & notices" meta="What we're watching, shared openly" badge={watching} onClick={() => nav("/risks")} />
        <Row icon={Icon.swatch} title="Selections" meta="Choices that make it yours" badge={openSelections} onClick={() => nav("/selections")} />
        <Row icon={Icon.compass} title="Variations" meta="Changes, priced and approved" badge={offeredVars} onClick={() => nav("/variations")} />
        <Row icon={Icon.calendar} title="Site visits" meta="Book a walk of your floor" onClick={() => nav("/visits")} />
        <Row icon={Icon.doc} title="Documents" meta="Contract, plans, schedules" onClick={() => nav("/documents")} />
        <Row icon={Icon.inbox} title="Questions" meta="Your thread with the team" onClick={() => nav("/questions")} />
      </div>
      <div className="rise rise-2 mt-8 border border-seam p-5">
        <p className="type-eyebrow text-smoke">Signed in as</p>
        <p className="mt-1 font-sans text-sm font-semibold text-bone">
          {state.owner.name} — {state.owner.unit}
        </p>
        <p className="mt-0.5 font-sans text-xs text-smoke">Owner since {state.owner.memberSince}</p>
        <div className="mt-4 flex gap-3">
          <Btn
            tone="ghost"
            onClick={() => {
              if (IS_LIVE) sb.auth.signOut();
              dispatch({ type: "signout" });
              nav("/signin");
            }}
          >
            <Icon.out className="h-4 w-4" /> Sign out
          </Btn>
          {!IS_LIVE && <Btn tone="ghost" onClick={() => dispatch({ type: "reset" })}>Reset demo</Btn>}
        </div>
      </div>
      <p className="mt-8 pb-4 text-center font-sans text-[0.65rem] text-smoke/70">
        PMCC S.A.R.L. · One team, from start to finish · Since 1996
      </p>
    </Screen>
  );
}
