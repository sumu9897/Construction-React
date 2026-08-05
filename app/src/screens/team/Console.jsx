/**
 * The site team's console. Deliberately unglamorous: big buttons, dense
 * lists, everything two taps — it gets used standing on a slab. The one
 * rule that matters is enforced by the UI itself: nothing reaches an owner
 * without a human pressing Publish after seeing exactly what the owner
 * will see.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, usd } from "../../store";
import { Screen, TopBar, Card, Row, Stamp, Btn, Icon, StateDot, StateLegend, Back } from "../../ui";
import { PHASES, PHOTO_LIBRARY } from "../../data/seed";
import { IS_LIVE, sb, createAccount, suggestPassword } from "../../lib/supabase";
import {
  createProjectLive,
  saveSnapshot,
  queueQuestions,
  learnedOptions,
  fetchReasons,
  linkRiskToTask,
} from "../../live/sync";
import { loadTeam } from "../../live/load";
import { uploadPhoto, uploadDoc, openDoc } from "../../lib/storage";
import { parseMSPDI, diffProgramme } from "../../lib/mspdi";
import { extractPdfText } from "../../lib/pdf";

/* ------------------------------------------------ Today (dashboard) */
export function Today() {
  const { state, dispatch } = useStore();
  const nav = useNavigate();
  const unanswered = state.questions.filter((q) => !q.a).length;
  // Variations/payments belong to owners; a project with no owners has none.
  const hasOwners = state.team.owners.some((o) => o.state === "active");
  const offered = hasOwners ? state.variations.filter((v) => v.state === "offered").length : 0;
  const openRisks = state.risks.filter((r) => r.status !== "closed").length;
  const meta = state.projectsMeta ?? [{ id: "d563", name: "Daher el Souane 563" }];
  const activeId = state.activeProjectId ?? "d563";

  return (
    <Screen>
      <TopBar eyebrow="PMCC site console" title="Today" />

      {/* The project this console is pointed at — switch or start a new one. */}
      <div className="rise rise-1 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <select
            value={activeId}
            onChange={async (e) => {
              const id = e.target.value;
              if (IS_LIVE) {
                dispatch({ type: "boot", slices: await loadTeam(id) });
              } else {
                dispatch({ type: "switchProject", id });
              }
            }}
            aria-label="Active project"
            className="w-full appearance-none border border-seam bg-coal px-4 py-3.5 pr-10 font-sans text-sm font-semibold text-bone outline-none focus:border-stone"
          >
            {meta.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Icon.chevron className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-smoke" />
        </div>
        <Btn tone="ghost" onClick={() => nav("/team/new")} aria-label="New project">
          <Icon.plus className="h-4 w-4" /> New
        </Btn>
      </div>

      <div className="rise rise-2 mt-4 grid grid-cols-3 gap-3">
        {[
          [String(state.diary.length), "updates published"],
          [String(openRisks), "open risks"],
          [String(unanswered), "open questions"],
        ].map(([v, l]) => (
          <Card key={l} className="p-4 text-center">
            <p className="type-display text-3xl text-bone">{v}</p>
            <p className="mt-1 font-sans text-[0.62rem] uppercase tracking-wideish text-smoke">{l}</p>
          </Card>
        ))}
      </div>

      <div className="rise rise-3 mt-5 flex gap-3">
        <Btn full onClick={() => nav("/team/publish")}>
          <Icon.camera className="h-4 w-4" /> New update
        </Btn>
        <Btn full tone="ghost" onClick={() => nav("/team/copilot")}>
          <Icon.chat className="h-4 w-4" /> Copilot
        </Btn>
      </div>

      <div className="rise rise-4 mt-6">
        <Row icon={Icon.plan} title="Look-ahead" meta={`Updated ${state.lookahead.updated} — tick as built`} onClick={() => nav("/team/plan")} />
        <Row icon={Icon.inbox} title="Inbox" meta="Owner questions & chatbot escalations" badge={unanswered} onClick={() => nav("/team/inbox")} />
        <Row icon={Icon.money} title="Payments" meta="Record receipts against milestones" onClick={() => nav("/team/money")} />
        <Row icon={Icon.shield} title="Risks & notices" meta="Share, update, close" onClick={() => nav("/team/risks")} />
        <Row icon={Icon.compass} title="Variations" meta={!hasOwners ? "No owners yet" : offered ? `${offered} awaiting owner decision` : "All settled"} badge={offered} onClick={() => nav("/team/owners")} />
        <Row icon={Icon.home} title="Owners & access" meta="Accounts, read receipts" onClick={() => nav("/team/owners")} />
        <Row icon={Icon.doc} title="Project & programme" meta="Contract, milestones, MS Project / P6 import" onClick={() => nav("/team/project")} />
        <Row icon={Icon.doc} title="Report" meta="Period roll-up — internal & client flavours" onClick={() => nav("/team/report")} />
        <Row icon={Icon.diary} title="Site log" meta="Every report and action, permanently" onClick={() => nav("/team/log")} />
      </div>

      <button
        type="button"
        onClick={() => {
          if (IS_LIVE) sb.auth.signOut();
          dispatch({ type: "signout" });
          nav("/signin");
        }}
        className="mt-8 flex w-full items-center justify-center gap-2 border border-seam py-3.5 font-sans text-sm text-smoke transition-colors active:border-stone active:text-bone"
      >
        <Icon.out className="h-4 w-4" /> Sign out
      </button>
    </Screen>
  );
}

/* ------------------------------------------------ Site log */
export function LogDesk() {
  const { state } = useStore();
  const KINDS = { report: "stone", action: "smoke", risk: "red", publish: "stone", note: "smoke" };
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="The project's memory — nothing here is ever lost" title="Site log" />
      {(state.log ?? []).length === 0 && (
        <p className="font-sans text-sm leading-relaxed text-smoke">
          Empty so far. Every copilot report, applied action and published update lands here with
          its timestamp — the contemporaneous record of how this building was built.
        </p>
      )}
      {(state.log ?? []).map((l) => (
        <div key={l.id} className="border-b border-seam py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <Stamp tone={KINDS[l.kind] ?? "smoke"}>{l.kind}</Stamp>
            <p className="font-sans text-[0.65rem] tabular-nums text-smoke">
              {l.at}
              {l.author ? ` · ${l.author}` : ""}
            </p>
          </div>
          <p className="mt-2 font-sans text-sm leading-relaxed text-bone/90">{l.body}</p>
        </div>
      ))}
      <p className="mt-6 pb-4 font-sans text-xs leading-relaxed text-smoke">
        The chatbot and the copilot draw on this record — the more the site reports, the smarter
        every answer gets.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------ New project */
export function NewProject() {
  const { dispatch } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [delivery, setDelivery] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="A new client, a new record" title="New project" />
      <label className="block">
        <span className="type-eyebrow text-smoke">Project name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bcharreh Villa"
          className="mt-2 w-full border border-seam bg-transparent px-4 py-3.5 font-sans text-sm text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
        />
      </label>
      <label className="mt-4 block">
        <span className="type-eyebrow text-smoke">Location</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Town · District"
          className="mt-2 w-full border border-seam bg-transparent px-4 py-3.5 font-sans text-sm text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
        />
      </label>
      <label className="mt-4 block">
        <span className="type-eyebrow text-smoke">Target delivery</span>
        <input
          value={delivery}
          onChange={(e) => setDelivery(e.target.value)}
          placeholder="e.g. Winter 2028"
          className="mt-2 w-full border border-seam bg-transparent px-4 py-3.5 font-sans text-sm text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
        />
      </label>

      <div className="mt-8 border-t border-seam pt-6">
        <p className="type-eyebrow text-smoke">The client (recommended now, possible later)</p>
        <p className="mt-2 font-sans text-xs leading-relaxed text-smoke">
          Their email becomes their key: they sign in with it and land directly inside this
          project — nothing else to set up.
        </p>
        <input
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Client's full name"
          className="mt-3 w-full border border-seam bg-transparent px-4 py-3.5 font-sans text-sm text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
        />
        <input
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          type="email"
          placeholder="client@email.com"
          className="mt-2 w-full border border-seam bg-transparent px-4 py-3.5 font-sans text-sm text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
        />
      </div>

      <Btn
        full
        className="mt-6"
        disabled={
          !name.trim() ||
          !location.trim() ||
          !delivery.trim() ||
          (ownerEmail.trim() !== "" && (!ownerEmail.includes("@") || !ownerName.trim()))
        }
        onClick={async () => {
          const meta = {
            name: name.trim(),
            location: location.trim(),
            delivery: delivery.trim(),
            ownerName: ownerName.trim(),
            ownerEmail: ownerEmail.trim(),
          };
          if (IS_LIVE) {
            try {
              const created = await createProjectLive(meta);
              if (meta.ownerEmail) {
                const pw = suggestPassword();
                await createAccount(meta.ownerEmail.toLowerCase(), pw);
                const blurb = `Welcome to the PMCC portal — your private window into ${meta.name}.\n\nOpen: https://pmcclb.com/app\nEmail: ${meta.ownerEmail.toLowerCase()}\nPassword: ${pw}\n\nTip: in Chrome tap ⋮ → Add to Home screen (iPhone: Share → Add to Home Screen) to keep it as an app.`;
                try {
                  await navigator.clipboard.writeText(blurb);
                } catch {
                  /* clipboard blocked: the alert below still carries the password */
                }
                alert(
                  `Project created, and ${meta.ownerName}'s account is ready.\n\nEmail: ${meta.ownerEmail.toLowerCase()}\nPassword: ${pw}\n\nThe welcome message is on your clipboard — paste it into WhatsApp.`,
                );
              }
              dispatch({ type: "boot", slices: await loadTeam(created.id) });
            } catch (e) {
              alert(`Could not create the project: ${e.message ?? e}`);
              return;
            }
          } else {
            dispatch({ type: "createProject", meta: { id: `p${Date.now()}`, ...meta } });
          }
          nav("/team");
        }}
      >
        Create project
      </Btn>
      <p className="mt-4 font-sans text-xs leading-relaxed text-smoke">
        The project starts empty: import its programme, upload the contract, define units and
        invite owners from the console. Everything you publish stays inside this project only.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------ Publish */
export function Publish() {
  const { state, dispatch } = useStore();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState(PHASES[2]);
  const [linkedActivity, setLinkedActivity] = useState("");
  const [photo, setPhoto] = useState(PHOTO_LIBRARY[0]);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  // A photo can be tied to a specific look-ahead activity, or stay general.
  const activityChoices = [
    ...new Set(
      state.lookahead.weeks.slice(0, 2).flatMap((w) => w.items.map((it) => it.t)),
    ),
  ].slice(0, 10);

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (IS_LIVE) {
      setUploading(true);
      try {
        setPhoto(await uploadPhoto(file));
      } catch (err) {
        alert(`Upload failed: ${err.message ?? err}`);
      }
      setUploading(false);
    } else {
      setPhoto(URL.createObjectURL(file));
    }
  }

  const entry = {
    id: crypto.randomUUID(),
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    phase,
    activity: linkedActivity || null,
    photo,
    text: text.trim(),
  };

  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Owners see this after Publish — not before" title="New update" />
      {!preview ? (
        <>
          <p className="type-eyebrow text-smoke">Photo</p>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-2">
            <label className={`flex h-20 w-28 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed ${uploading ? "border-stone" : "border-seam"} text-smoke`}>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
              <Icon.camera className="h-5 w-5" />
              <span className="font-sans text-[0.6rem] uppercase tracking-wideish">
                {uploading ? "Uploading…" : "Camera"}
              </span>
            </label>
            {!PHOTO_LIBRARY.includes(photo) && (
              <button type="button" className="h-20 w-28 shrink-0 border-2 border-pmcc">
                <img src={photo} alt="" className="h-full w-full object-cover" />
              </button>
            )}
            {PHOTO_LIBRARY.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhoto(p)}
                className={`h-20 w-28 shrink-0 border-2 ${photo === p ? "border-pmcc" : "border-seam"}`}
              >
                <img src={p} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <p className="mt-1 font-sans text-[0.65rem] text-smoke">Demo library — the live console takes site photos from the camera roll.</p>

          <p className="type-eyebrow mt-6 text-smoke">Phase</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PHASES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhase(p)}
                className={`border px-3 py-1.5 font-sans text-xs transition-colors ${phase === p ? "border-stone text-bone" : "border-seam text-smoke"}`}
              >
                {p}
              </button>
            ))}
          </div>

          {activityChoices.length > 0 && (
            <>
              <p className="type-eyebrow mt-6 text-smoke">Activity (optional)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLinkedActivity("")}
                  className={`border px-3 py-1.5 font-sans text-xs transition-colors ${!linkedActivity ? "border-stone text-bone" : "border-seam text-smoke"}`}
                >
                  General
                </button>
                {activityChoices.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setLinkedActivity(a)}
                    className={`border px-3 py-1.5 font-sans text-xs transition-colors ${linkedActivity === a ? "border-stone text-bone" : "border-seam text-smoke"}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="type-eyebrow mt-6 text-smoke">What happened</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Level 1 slab poured Thursday at first light — 74 m³…"
            className="mt-2 w-full border border-seam bg-transparent px-4 py-3 font-sans text-sm text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
          />
          <Btn full className="mt-4" disabled={!text.trim()} onClick={() => setPreview(true)}>
            Preview as the owner sees it
          </Btn>
        </>
      ) : (
        <>
          <Card>
            <img src={entry.photo} alt="" className="aspect-[16/10] w-full object-cover" />
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="type-eyebrow text-stone">{entry.date}</p>
                <Stamp tone="stone">{entry.phase}</Stamp>
              </div>
              <p className="mt-2.5 font-sans text-sm leading-relaxed text-bone/90">{entry.text}</p>
            </div>
          </Card>
          <div className="mt-5 flex gap-3">
            <Btn
              full
              onClick={() => {
                dispatch({ type: "publish", entry });
                dispatch({
                  type: "log",
                  entry: { id: crypto.randomUUID(), at: "Just now", author: state.session?.name ?? "", kind: "publish", body: `Update published (${entry.phase}): ${entry.text.slice(0, 120)}` },
                });
                nav("/team");
              }}
            >
              Publish to owners
            </Btn>
            <Btn tone="ghost" onClick={() => setPreview(false)}>
              Edit
            </Btn>
          </div>
          <p className="mt-4 font-sans text-xs leading-relaxed text-smoke">
            Publishing timestamps the entry into the project record. Owners are notified; the entry
            cannot be silently deleted.
          </p>
        </>
      )}
    </Screen>
  );
}

/* ------------------------------------------------ Plan editor */
export function PlanEditor() {
  const { state, dispatch } = useStore();
  const [adding, setAdding] = useState(null);
  const [text, setText] = useState("");
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Tap a task to cycle completed → on track → delayed → not started" title="Look-ahead" />
      <div className="mb-4 px-1">
        <StateLegend />
      </div>
      {state.lookahead.weeks.map((w, wi) => (
        <Card key={w.label} className="mb-4 p-5">
          <div className="flex items-baseline justify-between">
            <p className="type-display text-xl text-bone">{w.label}</p>
            <p className="font-sans text-xs tabular-nums text-smoke">{w.range}</p>
          </div>
          <ul className="mt-4 space-y-1">
            {w.items.map((it, ii) => (
              <li key={`${it.t}-${ii}`} className="flex items-start gap-1 border-t border-seam first:border-t-0">
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "tick", week: wi, item: ii });
                    // The WHEN matters as much as the state — into the log.
                    const cycle = { done: "On track", ready: "Delayed", blocked: "Not started", todo: "Completed" };
                    dispatch({
                      type: "log",
                      entry: {
                        id: crypto.randomUUID(),
                        at: "Just now",
                        author: state.session?.name ?? "",
                        kind: "action",
                        body: `Look-ahead: "${it.t}" → ${cycle[it.s] ?? "Completed"}`,
                      },
                    });
                  }}
                  className="flex min-w-0 flex-1 items-start gap-3 py-2.5 text-left"
                >
                  <StateDot s={it.s} />
                  <span className={`min-w-0 flex-1 font-sans text-sm ${it.s === "done" ? "text-smoke line-through" : "text-bone/90"}`}>
                    {it.t}
                  </span>
                  {it.d && <span className="shrink-0 font-sans text-[0.65rem] tabular-nums text-smoke">{it.d}</span>}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${it.t}`}
                  onClick={() => {
                    if (!confirm(`Remove "${it.t}" from the look-ahead?`)) return;
                    dispatch({ type: "removeActivity", week: wi, item: ii });
                    dispatch({
                      type: "log",
                      entry: {
                        id: crypto.randomUUID(),
                        at: "Just now",
                        author: state.session?.name ?? "",
                        kind: "action",
                        body: `Look-ahead: "${it.t}" removed`,
                      },
                    });
                  }}
                  className="px-2 py-2.5 font-sans text-sm leading-none text-smoke/60 transition-colors active:text-pmcc"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {adding === wi ? (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && text.trim()) {
                    dispatch({ type: "addActivity", week: wi, text: text.trim() });
                    setText("");
                    setAdding(null);
                  }
                }}
                placeholder="New activity…"
                className="min-w-0 flex-1 border border-seam bg-transparent px-3 py-2 font-sans text-sm text-bone outline-none focus:border-stone"
              />
              <Btn
                tone="ghost"
                onClick={() => {
                  if (text.trim()) dispatch({ type: "addActivity", week: wi, text: text.trim() });
                  setText("");
                  setAdding(null);
                }}
              >
                Add
              </Btn>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(wi)}
              className="mt-2 inline-flex items-center gap-2 font-sans text-xs text-stone"
            >
              <Icon.plus className="h-3.5 w-3.5" /> Add activity
            </button>
          )}
        </Card>
      ))}
      <p className="px-1 pb-4 font-sans text-xs text-smoke">
        Owners see this plan live. In the wired version it is seeded from the imported programme.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------ Money */
export function MoneyDesk() {
  const { state, dispatch } = useStore();
  const paid = state.payments.filter((p) => p.state === "paid").reduce((s, p) => s + p.amount, 0);
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Rami K. — The Roof Residence" title="Payments desk" />
      <Card className="p-5">
        <p className="font-sans text-xs text-smoke">
          Collected <span className="tabular-nums text-bone">{usd(paid)}</span> of{" "}
          <span className="tabular-nums text-bone">{usd(state.owner.price)}</span>
        </p>
        <div className="mt-2 h-1 bg-seam">
          <div className="h-full bg-pmcc" style={{ width: `${(paid / state.owner.price) * 100}%` }} />
        </div>
      </Card>
      <div className="mt-4">
        {state.payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 border-b border-seam py-4">
            <div className="min-w-0">
              <p className="truncate font-sans text-sm font-semibold text-bone">{p.name}</p>
              <p className="font-sans text-xs text-smoke">
                {p.link} · {usd(p.amount)}
              </p>
            </div>
            {p.state === "paid" ? (
              <span className="flex items-center gap-2">
                <Stamp tone="stone">paid {p.date}</Stamp>
                {IS_LIVE && !p.receipt && (
                  <label className="cursor-pointer font-sans text-[0.65rem] text-stone underline underline-offset-2">
                    + receipt
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !state.owner.unitId) return;
                        try {
                          const path = await uploadDoc(file, state.owner.unitId);
                          const { error } = await sb.from("payments").update({ receipt_url: path }).eq("id", p.id);
                          if (error) throw error;
                          alert("Receipt attached — the owner sees it on their Money tab.");
                        } catch (err) {
                          alert(`Upload failed: ${err.message ?? err}`);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </span>
            ) : (
              <Btn tone="ghost" onClick={() => dispatch({ type: "pay", id: p.id })}>
                Mark paid
              </Btn>
            )}
          </div>
        ))}
      </div>
      <p className="mt-5 pb-4 font-sans text-xs leading-relaxed text-smoke">
        Marking paid attaches today's date and a receipt slot, and updates the owner's Money tab
        instantly.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------ Inbox */
export function InboxDesk() {
  const { state, dispatch } = useStore();
  const [drafts, setDrafts] = useState({});
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Questions & chatbot escalations" title="Inbox" />
      {state.questions.map((q) => (
        <Card key={q.id} className="mb-4 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-sans text-xs font-semibold text-stone">{q.from}</p>
            <p className="font-sans text-xs text-smoke">{q.asked}</p>
          </div>
          <p className="mt-2 font-sans text-sm leading-relaxed text-bone">{q.q}</p>
          {q.a ? (
            <div className="mt-3 border-l-2 border-stone pl-4">
              <p className="font-sans text-sm text-bone/80">{q.a}</p>
              <p className="mt-1 font-sans text-xs text-smoke">Answered {q.answered}</p>
            </div>
          ) : (
            <div className="mt-3">
              <textarea
                rows={2}
                value={drafts[q.id] ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                placeholder="Write the answer…"
                className="w-full border border-seam bg-transparent px-3 py-2 font-sans text-sm text-bone outline-none focus:border-stone"
              />
              <Btn
                className="mt-2"
                disabled={!(drafts[q.id] ?? "").trim()}
                onClick={() => dispatch({ type: "answer", id: q.id, text: drafts[q.id].trim() })}
              >
                Send answer
              </Btn>
            </div>
          )}
        </Card>
      ))}
    </Screen>
  );
}

/* ------------------------------------------------ Risks desk */
export function RisksDesk() {
  const { state, dispatch } = useStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Owners see shared risks immediately" title="Risks & notices" />
      <Card className="p-5">
        <p className="type-eyebrow text-smoke">Share a new notice</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — e.g. Aggregate delivery slippage"
          className="mt-3 w-full border border-seam bg-transparent px-3 py-2.5 font-sans text-sm text-bone outline-none focus:border-stone"
        />
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What, the impact, and the mitigation — plainly."
          className="mt-2 w-full border border-seam bg-transparent px-3 py-2.5 font-sans text-sm text-bone outline-none focus:border-stone"
        />
        <Btn
          className="mt-3"
          disabled={!title.trim() || !body.trim()}
          onClick={() => {
            dispatch({
              type: "shareRisk",
              risk: {
                id: crypto.randomUUID(),
                title: title.trim(),
                body: body.trim(),
                status: "watching",
                shared: "Today",
                source: "manual",
              },
            });
            dispatch({
              type: "log",
              entry: { id: crypto.randomUUID(), at: "Just now", author: state.session?.name ?? "", kind: "risk", body: `Risk shared: ${title.trim()}` },
            });
            setTitle("");
            setBody("");
          }}
        >
          Share with owners
        </Btn>
      </Card>
      <div className="mt-5">
        {state.risks.map((r) => (
          <div key={r.id} className="border-b border-seam py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-sans text-sm font-semibold text-bone">{r.title}</p>
              {r.status === "closed" ? (
                <Stamp tone="stone">closed</Stamp>
              ) : (
                <Btn tone="ghost" onClick={() => dispatch({ type: "closeRisk", id: r.id })}>
                  Close
                </Btn>
              )}
            </div>
            <p className="mt-1 font-sans text-xs text-smoke">
              Shared {r.shared} ·{" "}
              <span className={r.source === "file-derived" ? "text-[#D9A441]" : ""}>
                {r.source === "file-derived" ? "file-derived" : "manual"}
              </span>
              {r.taskName ? ` · linked to “${r.taskName}”` : ""}
            </p>
          </div>
        ))}
      </div>
    </Screen>
  );
}

/* ------------------------------------------------ Owners */
function InviteForm() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("owner");
  const [pw, setPw] = useState(suggestPassword());
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null); // {email, pw, name}
  // One building, one owner: the ownership record is implicit.
  const theUnit = state.team.owners.find((o) => o.unitId) ?? null;
  const ownerTaken = theUnit?.state === "active";

  if (made)
    return (
      <Card className="mb-5 border-stone/40 p-5">
        <p className="type-eyebrow text-stone">Account created — send this to {made.name}</p>
        <pre className="mt-3 whitespace-pre-wrap border border-seam bg-ink p-4 font-sans text-xs leading-relaxed text-bone/90">{`Welcome to the PMCC portal — your private window into your project.

Open: https://pmcclb.com/app
Email: ${made.email}
Password: ${made.pw}

Tip: in Chrome tap ⋮ → Add to Home screen (iPhone: Share → Add to Home Screen) to keep it as an app.`}</pre>
        <div className="mt-3 flex gap-3">
          <Btn
            onClick={() => {
              navigator.clipboard?.writeText(
                `Welcome to the PMCC portal — your private window into your project.\n\nOpen: https://pmcclb.com/app\nEmail: ${made.email}\nPassword: ${made.pw}\n\nTip: in Chrome tap ⋮ → Add to Home screen (iPhone: Share → Add to Home Screen) to keep it as an app.`,
              );
            }}
          >
            Copy message
          </Btn>
          <Btn tone="ghost" onClick={() => setMade(null)}>
            Done
          </Btn>
        </div>
      </Card>
    );

  if (!open)
    return (
      <Btn full className="mb-5" onClick={() => setOpen(true)}>
        <Icon.plus className="h-4 w-4" /> Create an account
      </Btn>
    );

  return (
    <Card className="mb-5 p-5">
      <p className="type-eyebrow text-smoke">Create an account — you hand them the keys</p>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        placeholder="their@email.com"
        className="mt-3 w-full border border-seam bg-transparent px-3 py-2.5 font-sans text-sm text-bone outline-none focus:border-stone"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        className="mt-2 w-full border border-seam bg-transparent px-3 py-2.5 font-sans text-sm text-bone outline-none focus:border-stone"
      />
      <div className="mt-3 flex gap-2">
        {["owner", "team"].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`flex-1 border px-3 py-2 font-sans text-xs uppercase tracking-wideish ${role === r ? "border-stone text-bone" : "border-seam text-smoke"}`}
          >
            {r === "owner" ? "Owner" : "PMCC team"}
          </button>
        ))}
      </div>
      {role === "owner" && ownerTaken && (
        <p className="mt-2 font-sans text-xs text-pmcc">
          This project already has its owner ({theUnit.name}).
        </p>
      )}
      <label className="mt-2 block">
        <span className="font-sans text-[0.65rem] uppercase tracking-wideish text-smoke">Password</span>
        <div className="mt-1 flex gap-2">
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="min-w-0 flex-1 border border-seam bg-transparent px-3 py-2.5 font-sans text-sm text-bone outline-none focus:border-stone"
          />
          <Btn tone="ghost" onClick={() => setPw(suggestPassword())}>
            New
          </Btn>
        </div>
      </label>
      <div className="mt-4 flex gap-3">
        <Btn
          full
          disabled={
            busy ||
            !email.includes("@") ||
            !name.trim() ||
            pw.length < 8 ||
            (role === "owner" && (!theUnit || ownerTaken))
          }
          onClick={async () => {
            if (!IS_LIVE) {
              alert("Demo mode — account creation works in the live app.");
              return;
            }
            setBusy(true);
            try {
              const { error } = await sb.from("pre_approved").insert({
                email: email.trim().toLowerCase(),
                role,
                full_name: name.trim(),
                unit_name: role === "owner" ? theUnit.unit : null,
                unit_id: role === "owner" ? theUnit.unitId : null,
              });
              if (error) throw error;
              await createAccount(email.trim().toLowerCase(), pw);
              setMade({ email: email.trim().toLowerCase(), pw, name: name.trim() });
              setOpen(false);
              setEmail("");
              setName("");
              setPw(suggestPassword());
            } catch (e) {
              alert(`Could not create the account: ${e.message ?? e}`);
            }
            setBusy(false);
          }}
        >
          {busy ? "Creating…" : "Create account"}
        </Btn>
        <Btn tone="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Btn>
      </div>
    </Card>
  );
}

export function OwnersDesk() {
  const { state } = useStore();
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Access, activity, read receipts" title="Owners & access" />
      <InviteForm />
      {state.team.owners.map((o) => (
        <Card key={o.unit} className="mb-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-sans text-sm font-semibold text-bone">{o.unit}</p>
              <p className="mt-0.5 font-sans text-xs text-smoke">{o.name}</p>
            </div>
            {o.state === "active" ? <Stamp tone="stone">active</Stamp> : <Stamp tone="smoke">available</Stamp>}
          </div>
          {o.lastSeen && (
            <p className="mt-3 border-t border-seam pt-3 font-sans text-xs leading-relaxed text-smoke">
              Last opened: <span className="text-bone">{o.lastSeen}</span>
              <br />
              {o.opened}
            </p>
          )}
          {o.state !== "active" && (
            <Btn tone="ghost" className="mt-3" onClick={() => {}}>
              <Icon.plus className="h-4 w-4" /> Invite owner on contract
            </Btn>
          )}
        </Card>
      ))}
      <p className="px-1 pb-4 font-sans text-xs leading-relaxed text-smoke">
        "Owner viewed the update on this date" is quiet legal gold — the record shows what was
        communicated, and when it was seen.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------ Project & programme */
export function ProjectDesk() {
  const { state, dispatch } = useStore();
  // One building, one owner: every project has exactly one ownership record
  // underneath, and the console never asks which.
  const units = state.team.owners.filter((o) => o.unitId);
  const single = units[0] ?? null;
  const soldUnits = units;
  const projectId = state.project.id;

  // contract indexing
  const [cUnit, setCUnit] = useState("");
  const [cText, setCText] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const [cDone, setCDone] = useState(null);

  // programme import
  const [parsed, setParsed] = useState(null);
  const [pErr, setPErr] = useState("");
  // manual risks that look like a slipping task — offered for linking
  const [riskLinks, setRiskLinks] = useState([]);
  const [applying, setApplying] = useState(false);

  // document upload
  const [dName, setDName] = useState("");
  const [dUnit, setDUnit] = useState("shared");
  const [dBusy, setDBusy] = useState(false);

  // delivery outlook
  const [outlookState, setOutlookState] = useState(state.project.outlook?.state ?? "ontrack");
  const [outlookNote, setOutlookNote] = useState(state.project.outlook?.note ?? "");

  async function indexContract(text, unitId = cUnit || single?.unitId) {
    setCBusy(true);
    try {
      const { data, error } = await sb.functions.invoke("index-contract", {
        body: { unit_id: unitId, text },
      });
      if (error) throw error;
      setCDone(data);
      setCText("");
      dispatch({
        type: "log",
        entry: {
          id: crypto.randomUUID(),
          at: "Just now",
          author: state.session?.name ?? "",
          kind: "note",
          body: `Contract indexed into the chat brain${data.paymentsCount ? ` — ${data.paymentsCount} installments captured to the payment schedule` : ""}.`,
        },
      });
      // Pull the freshly extracted payment schedule into the console.
      if (data.paymentsCount) dispatch({ type: "boot", slices: await loadTeam(projectId) });
    } catch (e) {
      alert(`Indexing failed: ${e.message ?? e}`);
    }
    setCBusy(false);
  }

  /** The whole pipeline from one tap: store the PDF, read it, index it. */
  async function onContractPdf(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = cUnit || single?.unitId;
    if (!file || !target) {
      if (file) alert("Choose the residence first.");
      return;
    }
    setCBusy(true);
    try {
      const path = await uploadDoc(file, target);
      await sb.from("documents").insert({
        project_id: projectId,
        unit_id: target,
        name: "Sale & purchase contract",
        meta: `Uploaded · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        storage_path: path,
      });
      const text = await extractPdfText(file);
      if (text.length < 200)
        throw new Error("The PDF has no readable text (it may be a scan) — paste the text below instead.");
      await indexContract(text, target);
    } catch (err) {
      alert(`${err.message ?? err}`);
      setCBusy(false);
    }
  }

  function onProgrammeFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPErr("");
    setParsed(null);
    if (/\.xer$/i.test(file.name)) {
      setPErr("Primavera XER: export the programme as MS Project XML for now — native XER support is coming.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = parseMSPDI(String(reader.result));
        // What moved? The question a re-import exists to answer.
        p.changes = p.milestones
          .map((m) => {
            const old = state.project.milestones.find(
              (o) => o.name.trim().toLowerCase() === m.name.trim().toLowerCase(),
            );
            return old && old.date !== m.date ? `${m.name}: ${old.date} → ${m.date}` : null;
          })
          .filter(Boolean);
        // The full programme-to-programme truth, against the stored snapshot,
        // classified with this project's materiality threshold.
        p.diff = diffProgramme(
          state.project.programme?.tasks,
          p.snapshot,
          state.project.thresholdDays ?? 3,
        );
        setParsed(p);
      } catch (err) {
        setPErr(String(err.message ?? err));
      }
    };
    reader.readAsText(file);
  }

  async function applyProgramme() {
    setApplying(true);
    try {
      let questionCount = 0;
      if (IS_LIVE) {
        const e1 = await sb
          .from("projects")
          .update({
            milestones: parsed.milestones,
            overall: parsed.overall,
            phases: parsed.phases.length ? parsed.phases : state.project.phases,
            programme: { importedAt: new Date().toISOString(), tasks: parsed.snapshot },
          })
          .eq("id", projectId);
        if (e1.error) throw e1.error;
        const e2 = await sb.from("lookahead").upsert({
          project_id: projectId,
          weeks: parsed.weeks,
          updated_at: new Date().toISOString(),
        });
        if (e2.error) throw e2.error;

        // The permanent record: every ingest is a snapshot; the first one
        // is the baseline.
        await saveSnapshot(projectId, parsed, !state.project.programme);

        // Material deltas become questions — anchored to the task and the
        // exact change, with learned option chips. Wobbles under the
        // threshold are deliberately left alone.
        if (parsed.diff) {
          const reasons = await fetchReasons(projectId);
          const qs = [
            ...parsed.diff.slipped
              .filter((s) => s.material)
              .map((s) => ({
                taskUid: s.u,
                taskName: s.n,
                kind: "slip",
                change: `moved out ${s.days} day${s.days > 1 ? "s" : ""} (${s.from} → ${s.to})`,
                options: learnedOptions(reasons, s.u, s.n),
              })),
            ...parsed.diff.pulled
              .filter((s) => s.material)
              .map((s) => ({
                taskUid: s.u,
                taskName: s.n,
                kind: "pull",
                change: `pulled forward ${s.days} day${s.days > 1 ? "s" : ""} (${s.from} → ${s.to})`,
                options: learnedOptions(reasons, s.u, s.n),
              })),
            ...parsed.diff.depChanged.map((c) => ({
              taskUid: c.u,
              taskName: c.n,
              kind: "dep",
              change: `dependencies changed (${c.from} → ${c.to})`,
              options: ["Resequenced on site", "Design change", "Recovery plan", "Modelling correction"],
            })),
          ];
          questionCount = qs.length;
          await queueQuestions(projectId, qs);

          // Reconciliation: open manual risks that look like a slipping
          // task get suggested links, offered in the preview panel.
          const { data: openRisks } = await sb
            .from("risks")
            .select("id, title, task_uid, source")
            .eq("project_id", projectId)
            .neq("status", "closed");
          const unlinked = (openRisks ?? []).filter((r) => r.source === "manual" && !r.task_uid);
          const words = (s) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
          const suggestions = [];
          for (const r of unlinked) {
            const rw = words(r.title);
            for (const sl of parsed.diff.slipped) {
              const overlap = [...words(sl.n)].filter((w) => rw.has(w)).length;
              if (overlap >= 1) suggestions.push({ risk: r, task: sl });
            }
          }
          setRiskLinks(suggestions);
        }

        dispatch({ type: "boot", slices: await loadTeam(projectId) });
      }
      dispatch({
        type: "log",
        entry: {
          id: crypto.randomUUID(),
          at: "Just now",
          author: state.session?.name ?? "",
          kind: "note",
          body: `Programme re-imported: ${parsed.taskCount} activities, ${parsed.milestones.length} milestones, overall ${state.project.overall}% → ${parsed.overall}%.${
            parsed.changes?.length ? ` Milestones moved — ${parsed.changes.join("; ")}.` : " No milestone dates moved."
          }${
            parsed.diff
              ? ` Completed since last: ${parsed.diff.completed.length}${
                  parsed.diff.completed.length
                    ? ` (${parsed.diff.completed.map((c) => `${c.n}${c.af ? ` on ${c.af}` : ""}`).join("; ")})`
                    : ""
                }. Activities: ${parsed.diff.moved.length} shifted${
                  parsed.diff.moved.length ? ` (${parsed.diff.moved.map((m) => m.text).join("; ")})` : ""
                }, ${parsed.diff.added.length} added, ${parsed.diff.removed.length} dropped, ${
                  parsed.diff.depChanged.length
                } dependency change${parsed.diff.depChanged.length === 1 ? "" : "s"}.`
              : " First import — comparison baseline set."
          }`,
        },
      });
      setParsed(null);
      alert(
        `Programme applied — milestones and the look-ahead now follow the file.${
          questionCount
            ? `\n\n${questionCount} question${questionCount > 1 ? "s" : ""} queued in the Site copilot — answer them to log the reasons.`
            : ""
        }`,
      );
    } catch (e) {
      alert(`Could not apply: ${e.message ?? e}`);
    }
    setApplying(false);
  }

  async function uploadDocument(e) {
    const file = e.target.files?.[0];
    if (!file || !dName.trim()) {
      if (file) alert("Give the document a name first.");
      e.target.value = "";
      return;
    }
    setDBusy(true);
    try {
      const effUnit = single ? single.unitId : dUnit;
      const folder = effUnit === "shared" ? `shared/${projectId}` : effUnit;
      const path = await uploadDoc(file, folder);
      const { error } = await sb.from("documents").insert({
        project_id: projectId,
        unit_id: effUnit === "shared" ? null : effUnit,
        name: dName.trim(),
        meta: `Uploaded · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        storage_path: path,
      });
      if (error) throw error;
      setDName("");
      alert("Document uploaded — owners see it in their Documents.");
    } catch (err) {
      alert(`Upload failed: ${err.message ?? err}`);
    }
    setDBusy(false);
    e.target.value = "";
  }

  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="The source of the record" title="Project & programme" />
      <Card className="p-5">
        <p className="type-eyebrow text-smoke">Project</p>
        <p className="type-display mt-1 text-2xl text-bone">{state.project.name}</p>
        <p className="mt-1 font-sans text-xs text-smoke">
          {state.project.location} · Delivery {state.project.delivery}
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <p className="type-eyebrow text-smoke">Programme import — MS Project XML</p>
        <label className="mt-3 block cursor-pointer border border-dashed border-seam p-5 text-center transition-colors active:border-stone">
          <input type="file" accept=".xml,.xer" className="hidden" onChange={onProgrammeFile} />
          <Icon.doc className="mx-auto h-6 w-6 text-stone" />
          <p className="mt-2 font-sans text-xs text-smoke">Tap to choose the programme file</p>
        </label>
        {pErr && <p className="mt-3 font-sans text-xs text-pmcc">{pErr}</p>}
        {parsed && (
          <div className="mt-3 border-l-2 border-stone pl-3">
            <p className="font-sans text-xs leading-relaxed text-bone/85">
              Parsed: {parsed.taskCount} activities · {parsed.milestones.length} milestones ·
              look-ahead {parsed.weeks.map((w) => w.items.length).join(" / ")} items over three weeks.
            </p>
            <p className="mt-1 font-sans text-xs text-bone/85">
              Overall progress:{" "}
              <span className={parsed.overall !== state.project.overall ? "text-[#D9A441]" : "text-[#55996A]"}>
                {state.project.overall}% → {parsed.overall}%
              </span>
              {parsed.phases.length > 0 && ` · ${parsed.phases.length} phases from the file`}
            </p>
            {parsed.changes?.length > 0 && (
              <div className="mt-2">
                <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wideish text-[#D9A441]">
                  Milestones moving
                </p>
                <ul className="mt-1 space-y-1">
                  {parsed.changes.map((c) => (
                    <li key={c} className="font-sans text-xs leading-relaxed text-bone/85">
                      {c}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-sans text-[0.65rem] leading-relaxed text-smoke">
                  If delivery is affected, update the Delivery outlook below after applying —
                  owners hear it from you, never from a silent date change.
                </p>
              </div>
            )}
            {parsed.changes?.length === 0 && (
              <p className="mt-1 font-sans text-xs text-[#55996A]">No milestone dates move.</p>
            )}
            {parsed.diff ? (
              <div className="mt-3 space-y-2">
                {parsed.diff.completed.length > 0 && (
                  <div>
                    <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wideish text-[#55996A]">
                      Completed since last import ({parsed.diff.completed.length})
                    </p>
                    <ul className="mt-1 space-y-1">
                      {parsed.diff.completed.slice(0, 6).map((c) => (
                        <li key={c.n} className="font-sans text-xs leading-relaxed text-bone/85">
                          {c.n}
                          {c.af ? ` — actual finish ${c.af} (from the file)` : " — finish date from this import"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {parsed.diff.moved.length > 0 && (
                  <div>
                    <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wideish text-[#D9A441]">
                      Activities shifted ({parsed.diff.moved.length})
                    </p>
                    <ul className="mt-1 space-y-1">
                      {parsed.diff.moved.slice(0, 8).map((m) => (
                        <li key={m.text} className="font-sans text-xs leading-relaxed text-bone/85">
                          {m.text}
                        </li>
                      ))}
                    </ul>
                    {parsed.diff.moved.length > 8 && (
                      <p className="mt-1 font-sans text-[0.65rem] text-smoke">
                        …and {parsed.diff.moved.length - 8} more (all recorded in the log on apply)
                      </p>
                    )}
                    <p className="mt-1 font-sans text-[0.65rem] leading-relaxed text-smoke">
                      Moves of {state.project.thresholdDays ?? 3}+ days queue a copilot question on
                      apply; smaller wobbles are recorded but not asked about.
                    </p>
                  </div>
                )}
                {parsed.diff.depChanged.length > 0 && (
                  <p className="font-sans text-xs text-bone/85">
                    <span className="font-semibold uppercase tracking-wideish text-[0.65rem] text-smoke">Dependencies changed:</span>{" "}
                    {parsed.diff.depChanged.slice(0, 4).map((c) => c.n).join(" · ")}
                    {parsed.diff.depChanged.length > 4 ? ` · +${parsed.diff.depChanged.length - 4} more` : ""}
                  </p>
                )}
                {parsed.diff.added.length > 0 && (
                  <p className="font-sans text-xs text-bone/85">
                    <span className="font-semibold uppercase tracking-wideish text-[0.65rem] text-smoke">New activities:</span>{" "}
                    {parsed.diff.added.slice(0, 5).map((a) => `${a.n} (${a.s} → ${a.f})`).join(" · ")}
                    {parsed.diff.added.length > 5 ? ` · +${parsed.diff.added.length - 5} more` : ""}
                  </p>
                )}
                {parsed.diff.removed.length > 0 && (
                  <p className="font-sans text-xs text-bone/85">
                    <span className="font-semibold uppercase tracking-wideish text-[0.65rem] text-smoke">Dropped:</span>{" "}
                    {parsed.diff.removed.slice(0, 5).map((r) => r.n).join(" · ")}
                    {parsed.diff.removed.length > 5 ? ` · +${parsed.diff.removed.length - 5} more` : ""}
                  </p>
                )}
                {parsed.diff.moved.length === 0 &&
                  parsed.diff.completed.length === 0 &&
                  parsed.diff.added.length === 0 &&
                  parsed.diff.removed.length === 0 &&
                  parsed.diff.depChanged.length === 0 && (
                    <p className="font-sans text-xs text-[#55996A]">No activity changes against the last import.</p>
                  )}
              </div>
            ) : (
              <p className="mt-2 font-sans text-[0.65rem] text-smoke">
                First import for this project — nothing earlier to compare against; the comparison
                starts from here.
              </p>
            )}
            <Btn className="mt-3" disabled={applying} onClick={applyProgramme}>
              {applying ? "Applying…" : "Apply to milestones & look-ahead"}
            </Btn>
          </div>
        )}
        {riskLinks.length > 0 && (
          <div className="mt-4 border-l-2 border-pmcc pl-3">
            <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wideish text-pmcc">
              Manual risks that match a slipping activity
            </p>
            {riskLinks.map((s, i) => (
              <div key={`${s.risk.id}-${s.task.n}`} className="mt-2 flex flex-wrap items-center gap-2">
                <p className="font-sans text-xs leading-relaxed text-bone/85">
                  Risk “{s.risk.title}” ↔ “{s.task.n}” (+{s.task.days}d)
                </p>
                <Btn
                  tone="ghost"
                  onClick={async () => {
                    try {
                      await linkRiskToTask(s.risk.id, s.task.u, s.task.n);
                      setRiskLinks((prev) => prev.filter((_, j) => j !== i));
                    } catch (e) {
                      alert(`Could not link: ${e.message ?? e}`);
                    }
                  }}
                >
                  Link them
                </Btn>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRiskLinks([])}
              className="mt-2 font-sans text-[0.65rem] text-smoke underline underline-offset-2"
            >
              Not related — dismiss
            </button>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <p className="type-eyebrow text-smoke">Contract → chat brain</p>
        <p className="mt-2 font-sans text-sm leading-relaxed text-bone/85">
          Paste the contract text for a residence; the AI extracts the clauses that owners ask
          about, and their "Ask PMCC" quotes the document — never memory.
        </p>
        {single && (
          <p className="mt-3 font-sans text-xs text-stone">
            {single.state === "active" ? `For ${single.name}` : "For this project's owner"}
          </p>
        )}
        <label className="mt-2 block cursor-pointer border border-dashed border-seam p-5 text-center transition-colors active:border-stone">
          <input type="file" accept=".pdf" className="hidden" onChange={onContractPdf} />
          <Icon.doc className="mx-auto h-6 w-6 text-stone" />
          <p className="mt-2 font-sans text-xs text-smoke">
            {cBusy ? "Reading & indexing…" : "Tap to upload the contract PDF — stored, read, and indexed in one go"}
          </p>
        </label>
        <details className="mt-2">
          <summary className="cursor-pointer font-sans text-xs text-smoke">Scanned PDF? Paste the text instead</summary>
          <textarea
            rows={4}
            value={cText}
            onChange={(e) => setCText(e.target.value)}
            placeholder="Paste the contract text here."
            className="mt-2 w-full border border-seam bg-transparent px-3 py-2.5 font-sans text-xs text-bone outline-none focus:border-stone"
          />
          <Btn className="mt-2" disabled={cBusy || !(cUnit || single?.unitId) || cText.trim().length < 200} onClick={() => indexContract(cText)}>
            {cBusy ? "Extracting…" : "Extract & index with AI"}
          </Btn>
        </details>
        {cDone && (
          <p className="mt-3 border-l-2 border-stone pl-3 font-sans text-xs leading-relaxed text-bone/85">
            Indexed. Delivery clause reads: “{cDone.clauses?.deliveryClause}” — the owner's chatbot
            now quotes this document.
            {cDone.paymentsCount
              ? ` ${cDone.paymentsCount} installments were captured from the contract into the Money tab (view-only, exactly as written).`
              : " No payment schedule was found in the text — the Money tab is untouched."}
          </p>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <p className="type-eyebrow text-smoke">Delivery outlook — the line owners see</p>
        <div className="mt-3 flex gap-2">
          {[["ontrack", "On track"], ["watch", "Watching"], ["atrisk", "At risk"]].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setOutlookState(k)}
              className={`flex-1 border px-2 py-2 font-sans text-xs uppercase tracking-wideish ${outlookState === k ? "border-stone text-bone" : "border-seam text-smoke"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          value={outlookNote}
          onChange={(e) => setOutlookNote(e.target.value)}
          placeholder={`e.g. On track — delivery ${state.project.delivery}. Two weeks of float in hand.`}
          className="mt-2 w-full border border-seam bg-transparent px-3 py-2.5 font-sans text-sm text-bone outline-none focus:border-stone"
        />
        <Btn
          className="mt-2"
          disabled={!outlookNote.trim()}
          onClick={() => {
            dispatch({ type: "setOutlook", outlook: { state: outlookState, note: outlookNote.trim(), updated: "today" } });
            dispatch({
              type: "log",
              entry: { id: crypto.randomUUID(), at: "Just now", author: state.session?.name ?? "", kind: "note", body: `Delivery outlook set (${outlookState}): ${outlookNote.trim()}` },
            });
            alert("Outlook updated — owners see it on Home and the Plan.");
          }}
        >
          Publish outlook
        </Btn>
      </Card>

      <Card className="mt-4 p-5">
        <p className="type-eyebrow text-smoke">Upload a document</p>
        <input
          value={dName}
          onChange={(e) => setDName(e.target.value)}
          placeholder="Document name — e.g. Finishes schedule rev B"
          className="mt-3 w-full border border-seam bg-transparent px-3 py-2.5 font-sans text-sm text-bone outline-none focus:border-stone"
        />
        {!single && (
          <select
            value={dUnit}
            onChange={(e) => setDUnit(e.target.value)}
            className="mt-2 w-full appearance-none border border-seam bg-coal px-3 py-2.5 font-sans text-sm text-bone outline-none focus:border-stone"
          >
            <option value="shared">All owners in this project</option>
            {soldUnits.map((u) => (
              <option key={u.unitId} value={u.unitId}>
                Only {u.unit}
              </option>
            ))}
          </select>
        )}
        <label className="mt-2 block cursor-pointer border border-dashed border-seam p-4 text-center transition-colors active:border-stone">
          <input type="file" accept=".pdf,image/*" className="hidden" onChange={uploadDocument} />
          <p className="font-sans text-xs text-smoke">{dBusy ? "Uploading…" : "Tap to choose the file"}</p>
        </label>
      </Card>

      <Card className="mt-4 p-5">
        <p className="type-eyebrow text-smoke">Milestones</p>
        <ul className="mt-3">
          {state.project.milestones.map((m) => (
            <li key={m.name} className="flex items-center gap-3 border-t border-seam py-2.5 first:border-t-0">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${m.done ? "border-stone text-stone" : "border-seam text-smoke/40"}`}>
                {m.done && <Icon.check className="h-3 w-3" />}
              </span>
              <span className={`flex-1 font-sans text-sm ${m.done ? "text-bone/80" : m.next ? "text-bone" : "text-smoke"}`}>
                {m.name}
              </span>
              <span className="font-sans text-xs tabular-nums text-smoke">{m.date}</span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-4 px-1 pb-4 font-sans text-xs text-smoke">
        New project, blocks, units and owner invitations live here in the wired version.
      </p>
    </Screen>
  );
}
