/**
 * The Site Copilot: the engineer reports in plain words — "concrete pour
 * delayed two days, pump broke down" — and the copilot translates it into
 * proposed actions: re-state the activity, note the delay, open a risk.
 * Nothing applies until a human taps Apply — the same publish discipline as
 * everywhere else in this console.
 *
 * Demo: a local parser plays the brain. Live: Groq receives the message plus
 * the project record and returns the same structured action list — the UI
 * and the approval step do not change.
 */
import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store";
import { Screen, TopBar, Btn, Icon, Back, Card, Stamp } from "../../ui";
import { IS_LIVE } from "../../lib/supabase";
import {
  copilotLive,
  fetchOpenQuestions,
  answerQuestion,
  dismissQuestion,
} from "../../live/sync";

/** The model speaks in words ("delayed"); the store speaks in codes. */
const S_MAP = {
  done: "done", completed: "done", complete: "done", finished: "done",
  ready: "ready", ontrack: "ready", "on track": "ready",
  blocked: "blocked", delayed: "blocked", late: "blocked", stuck: "blocked",
  todo: "todo", "not started": "todo", notstarted: "todo",
};

/** Shape one AI-returned action into the card the UI applies. */
function fromAI(a) {
  if (a.kind === "activity") {
    // Keep the activity's NAME — indices from the model can be off, and the
    // name is what lets apply() find the real row instead of failing silently.
    const name = a.name ?? (a.label?.match(/"([^"]+)"/) || [])[1] ?? null;
    const s = S_MAP[String(a.s ?? "").toLowerCase()] ?? "blocked";
    const moveTo = a.moveTo ?? a.move_to;
    const base = { week: Number(a.week), item: Number(a.item), s, note: a.note, name };
    return {
      kind: "activity",
      label: a.label,
      detail: a.detail,
      payload:
        moveTo != null
          ? { type: "moveActivity", ...base, to: Number(moveTo) }
          : { type: "setActivity", ...base },
    };
  }
  if (a.kind === "risk")
    return {
      kind: "risk",
      label: a.label,
      detail: a.detail,
      payload: {
        type: "shareRisk",
        risk: { id: crypto.randomUUID(), title: a.title, body: a.body, status: "watching", shared: "Today" },
      },
    };
  if (a.kind === "outlook")
    return {
      kind: "outlook",
      label: a.label,
      detail: a.detail,
      payload: { type: "setOutlook", outlook: { state: a.state ?? "watch", note: a.note ?? a.detail, updated: "today" } },
    };
  if (a.kind === "decision")
    return {
      kind: "decision",
      label: a.label,
      detail: a.detail,
      payload: { type: "addDecision", decision: { body: a.body ?? a.detail, taskName: a.task || null } },
    };
  return { kind: "note", label: a.label, detail: a.detail, payload: null };
}

const STOP = new Set(["the", "a", "an", "of", "for", "to", "on", "in", "at", "and", "by", "has", "have", "been", "was", "is", "are", "with", "day", "days", "week", "delayed", "delay", "done", "complete", "completed", "finished", "because"]);

function tokens(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
}

/** Find the lookahead activity that best matches the message. */
function matchActivity(msg, weeks) {
  const mt = new Set(tokens(msg));
  let best = null;
  weeks.forEach((w, wi) =>
    w.items.forEach((it, ii) => {
      const score = tokens(it.t).filter((tk) => mt.has(tk)).length;
      if (score > 0 && (!best || score > best.score)) best = { week: wi, item: ii, it, score };
    }),
  );
  return best && best.score >= 1 ? best : null;
}

/** Turn one site report into a list of proposed, structured actions. */
function propose(msg, state) {
  const s = msg.toLowerCase();
  const acts = [];
  const hit = matchActivity(msg, state.lookahead.weeks);
  const delay = s.match(/delay\w*(?:\s+by)?\s+(\w+)\s+days?/) || (/(delay|late|slip|stuck|blocked|waiting)/.test(s) ? ["", null] : null);
  const done = /(done|complete|completed|finished|poured|closed|achieved)/.test(s);
  const reasonM = msg.match(/because\s+(?:of\s+)?(.+)$/i) || msg.match(/[—–-]\s*(.+)$/);
  const reason = reasonM ? reasonM[1].trim().replace(/\.$/, "") : null;
  const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  const delayDays = delay && delay[1] ? NUM[delay[1]] ?? (parseInt(delay[1], 10) || null) : null;

  if (hit && done && !delay) {
    acts.push({
      kind: "activity",
      label: `Mark "${hit.it.t}" as done`,
      detail: "Owners see it ticked on the plan immediately.",
      payload: { type: "setActivity", week: hit.week, item: hit.item, s: "done" },
    });
  }
  if (hit && delay) {
    const note = `Delayed${delayDays ? ` ${delayDays} day${delayDays > 1 ? "s" : ""}` : ""}${reason ? ` — ${reason}` : ""}`;
    acts.push({
      kind: "activity",
      label: `Mark "${hit.it.t}" as delayed`,
      detail: `Plan note: "${note}"`,
      payload: { type: "setActivity", week: hit.week, item: hit.item, s: "blocked", note },
    });
  }
  if (delay && (reason || delayDays)) {
    const title = reason
      ? reason.charAt(0).toUpperCase() + reason.slice(1)
      : `Programme slippage${delayDays ? ` — ${delayDays} days` : ""}`;
    acts.push({
      kind: "risk",
      label: `Share a risk: "${title}"`,
      detail: "Status watching · visible to owners with the mitigation once you edit it.",
      payload: {
        type: "shareRisk",
        risk: {
          id: `r${Date.now()}`,
          title,
          body: `${msg.trim()} — logged from the site copilot${delayDays ? `; current assessment ${delayDays} day${delayDays > 1 ? "s" : ""}, to be absorbed in float where possible` : ""}.`,
          status: "watching",
          shared: "Today",
        },
      },
    });
  }
  if (delay && delayDays) {
    const note = `A ${delayDays}-day slip is being absorbed in programme float — delivery ${state.project.delivery} unchanged.`;
    acts.push({
      kind: "outlook",
      label: "Update the delivery outlook",
      detail: `Owners will see: "${note}"`,
      payload: { type: "setOutlook", outlook: { state: "watch", note, updated: "today" } },
    });
  }
  return acts;
}

/** What each action kind IS, and where the owner meets it. */
const KIND_INFO = {
  activity: { tag: "Plan update", tone: "stone", dest: "Owner sees it on their Plan tab" },
  risk: { tag: "Risk", tone: "red", dest: "Owner sees it under More → Risks & notices" },
  outlook: { tag: "Delivery outlook", tone: "stone", dest: "Owner sees it on Home and the Plan" },
  decision: { tag: "Decision needed", tone: "red", dest: "Logged — feeds the Report's decisions list" },
  note: { tag: "FYI", tone: "smoke", dest: "Only for you — owners see nothing" },
};

const HINTS = [
  "Concrete pour delayed by two days because the pump broke down",
  "Level 1 column reinforcement is done",
  "Stone sample panel stuck — supplier truck held at customs",
];

/**
 * One queued post-ingest question: the task, the exact change, learned
 * option chips, free text, and an optional owner-facing risk. The answer
 * becomes the task's logged reason — the WHY joining the WHAT.
 */
function QuestionCard({ q, author, onDone, dispatch }) {
  const [free, setFree] = useState("");
  const [alsoRisk, setAlsoRisk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function answer(reason) {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await answerQuestion(q, reason.trim(), author);
      dispatch({
        type: "log",
        entry: {
          id: crypto.randomUUID(),
          at: "Just now",
          author,
          kind: "note",
          body: `Reason — "${q.task_name}" ${q.change}: ${reason.trim()}.`,
        },
      });
      if (alsoRisk) {
        dispatch({
          type: "shareRisk",
          risk: {
            id: crypto.randomUUID(),
            title: `${q.task_name} ${q.change.split(" (")[0]}`,
            body: `${q.task_name} ${q.change}. Reason: ${reason.trim()}.`,
            status: "watching",
            shared: "Today",
            source: "file-derived",
            taskUid: q.task_uid,
            taskName: q.task_name,
          },
        });
      }
      onDone(q.id);
    } catch (e) {
      alert(`Could not save: ${e.message ?? e}`);
    }
    setBusy(false);
  }

  const tone = q.kind === "pull" ? "stone" : "red";
  return (
    <Card className="mb-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Stamp tone={tone}>{q.kind === "pull" ? "Pulled forward" : q.kind === "dep" ? "Sequence change" : "Slip"}</Stamp>
          <p className="mt-2 font-sans text-sm font-semibold text-bone">
            “{q.task_name}” {q.change}
          </p>
          <p className="mt-1 font-sans text-xs leading-relaxed text-smoke">
            Why? The answer is logged as this task's reason.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await dismissQuestion(q.id);
            onDone(q.id);
          }}
          aria-label="Dismiss"
          className="shrink-0 px-1 font-sans text-sm text-smoke/60"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(q.options ?? []).map((o) => (
          <button
            key={o}
            type="button"
            disabled={busy}
            onClick={() => answer(o)}
            className="border border-seam px-3 py-1.5 font-sans text-xs text-bone/85 transition-colors active:border-stone"
          >
            {o}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={free}
          onChange={(e) => setFree(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && answer(free)}
          placeholder="Or type the reason…"
          className="min-w-0 flex-1 border border-seam bg-transparent px-3 py-2 font-sans text-xs text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
        />
        <Btn tone="ghost" disabled={busy || !free.trim()} onClick={() => answer(free)}>
          Log
        </Btn>
      </div>
      {q.kind !== "pull" && (
        <label className="mt-2 flex items-center gap-2 font-sans text-[0.65rem] text-smoke">
          <input type="checkbox" checked={alsoRisk} onChange={(e) => setAlsoRisk(e.target.checked)} />
          Also share as a risk to the owner (tagged file-derived)
        </label>
      )}
    </Card>
  );
}

export default function Copilot() {
  const { state, dispatch } = useStore();
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [queue, setQueue] = useState([]);
  const bottom = useRef(null);
  const feed = state.copilot ?? [];

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed.length, thinking]);

  // The proactive queue: material deltas from the last ingest, waiting for
  // their reasons. Live mode only — the demo has no server queue.
  useEffect(() => {
    if (!IS_LIVE || !state.project?.id) return;
    fetchOpenQuestions(state.project.id).then(setQueue).catch(() => {});
  }, [state.project?.id]);

  async function send(text) {
    const q = text.trim();
    if (!q) return;
    setInput("");
    dispatch({ type: "copilot", messages: [{ role: "user", text: q }] });
    // The report itself is site history — into the permanent log, verbatim.
    dispatch({
      type: "log",
      entry: { id: crypto.randomUUID(), at: "Just now", author: state.session?.name ?? "", kind: "report", body: q },
    });
    setThinking(true);

    let actions;
    if (IS_LIVE) {
      try {
        const data = await copilotLive(q, state.project.id);
        if (data.answer) {
          // A question, not a report — answered from the record.
          dispatch({ type: "copilot", messages: [{ role: "ai", text: data.answer }] });
          setThinking(false);
          return;
        }
        actions = (data.actions ?? []).map(fromAI);
      } catch (e) {
        console.error(e);
        actions = propose(q, state); // local parser as the fallback brain
      }
    } else {
      await new Promise((r) => setTimeout(r, 700));
      actions = propose(q, state);
    }

    dispatch({
      type: "copilot",
      messages: [
        actions.length
          ? { role: "ai", text: "Here's what I'd do with that — apply what's right:", actions, applied: [] }
          : { role: "ai", text: "I couldn't map that to the plan. Name the activity closer to how it's written in the look-ahead — or add it there first, then report against it." },
      ],
    });
    setThinking(false);
  }

  /**
   * Re-anchor an activity payload against the live look-ahead by NAME first,
   * indices second — the plan may have changed since the card was drafted,
   * and a model index that misses must fail loudly, never silently.
   */
  function resolveActivity(p, weeks) {
    let week = Number(p.week);
    let item = Number(p.item);
    if (p.name) {
      const key = p.name.trim().toLowerCase();
      for (let wi = 0; wi < weeks.length; wi++) {
        const ii = weeks[wi].items.findIndex((it) => it.t.trim().toLowerCase() === key);
        if (ii >= 0) {
          week = wi;
          item = ii;
          break;
        }
      }
    }
    return weeks[week]?.items?.[item] ? { ...p, week, item } : null;
  }

  function apply(mi, ai) {
    const m = feed[mi];
    const a = m.actions[ai];
    let payload = a.payload;
    if (payload && (payload.type === "setActivity" || payload.type === "moveActivity")) {
      payload = resolveActivity(payload, state.lookahead.weeks);
      if (!payload) {
        alert(
          `Couldn't find "${a.payload.name ?? "that activity"}" in the look-ahead — it may have been renamed or removed. Update it from the Plan editor instead.`,
        );
        return;
      }
    }
    if (payload) dispatch(payload);
    dispatch({
      type: "log",
      entry: { id: crypto.randomUUID(), at: "Just now", author: state.session?.name ?? "", kind: "action", body: a.label },
    });
    // record the application on the message itself
    const updated = feed.map((msg, i) =>
      i !== mi ? msg : { ...msg, applied: [...(msg.applied ?? []), ai] },
    );
    dispatch({ type: "copilotReplace", feed: updated });
  }

  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Say it — the copilot drafts the actions" title="Site copilot" />
      {queue.length > 0 && (
        <div className="mb-6">
          <p className="type-eyebrow text-pmcc">
            From the last import — {queue.length} question{queue.length > 1 ? "s" : ""}
          </p>
          <div className="mt-3">
            {queue.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                author={state.session?.name ?? ""}
                dispatch={dispatch}
                onDone={(id) => setQueue((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        </div>
      )}
      {feed.length === 0 && (
        <div className="rise rise-1">
          <p className="font-sans text-sm leading-relaxed text-smoke">
            Report the site in plain words. I'll translate it into plan updates and risks —
            nothing happens until you press Apply.
          </p>
          <div className="mt-5 space-y-2">
            {HINTS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => send(h)}
                className="block w-full border border-seam px-4 py-3 text-left font-sans text-xs leading-relaxed text-bone/85 transition-colors active:border-stone"
              >
                "{h}"
              </button>
            ))}
          </div>
        </div>
      )}
      {feed.map((m, mi) => (
        <div key={mi} className={`mb-4 ${m.role === "user" ? "flex justify-end" : ""}`}>
          {m.role === "user" ? (
            <div className="max-w-[85%] bg-bone px-4 py-3 font-sans text-sm leading-relaxed text-ink">{m.text}</div>
          ) : (
            <div>
              <div className="max-w-[92%] border border-seam bg-coal px-4 py-3 font-sans text-sm leading-relaxed text-bone/90">
                {m.text}
              </div>
              {m.actions?.map((a, ai) => {
                const isApplied = (m.applied ?? []).includes(ai);
                const info = KIND_INFO[a.kind] ?? KIND_INFO.note;
                return (
                  <Card key={ai} className="mt-2 max-w-[92%] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Stamp tone={info.tone}>{info.tag}</Stamp>
                        <p className="mt-2 font-sans text-sm font-semibold text-bone">{a.label}</p>
                        <p className="mt-1 font-sans text-xs leading-relaxed text-smoke">{a.detail}</p>
                        <p className="mt-2 font-sans text-[0.65rem] leading-relaxed text-stone">
                          {a.payload ? `On apply → ${info.dest}` : info.dest}
                        </p>
                      </div>
                      {a.payload ? (
                        isApplied ? (
                          <Stamp tone="stone">applied</Stamp>
                        ) : (
                          <Btn tone="ghost" onClick={() => apply(mi, ai)}>
                            Apply
                          </Btn>
                        )
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ))}
      {thinking && <div className="mb-4 inline-block border border-seam bg-coal px-4 py-3 font-sans text-sm text-smoke">…</div>}
      <div ref={bottom} />
      <div className="sticky bottom-24 mt-4 flex gap-2 bg-ink pb-2 pt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Report from site…"
          className="min-w-0 flex-1 border border-seam bg-coal px-4 py-3.5 font-sans text-sm text-bone outline-none placeholder:text-smoke/50 focus:border-stone"
        />
        <Btn onClick={() => send(input)} aria-label="Send">
          <Icon.chat className="h-4 w-4" />
        </Btn>
      </div>
    </Screen>
  );
}
