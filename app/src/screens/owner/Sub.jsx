/**
 * The owner's deeper rooms: risks, selections, variations, visits,
 * documents, questions. Each one exists to end an argument before it starts —
 * a recorded choice, a priced change, a shared risk, a booked visit.
 */
import { useState } from "react";
import { useStore, usd } from "../../store";
import { Screen, TopBar, Card, Stamp, Btn, Back, Row, Icon } from "../../ui";
import { openDoc } from "../../lib/storage";

export function Risks() {
  const { state } = useStore();
  return (
    <Screen>
      <Back to="/more" />
      <TopBar eyebrow="Shared openly, on the record" title="Risks & notices" />
      {state.risks.map((r, i) => (
        <Card key={r.id} className={`mb-4 p-5 rise rise-${Math.min(i + 1, 4)}`}>
          <div className="flex items-start justify-between gap-3">
            <p className="font-sans text-sm font-semibold text-bone">{r.title}</p>
            <Stamp tone={r.status === "closed" ? "stone" : "red"}>{r.status}</Stamp>
          </div>
          <p className="mt-2 font-sans text-sm leading-relaxed text-bone/80">{r.body}</p>
          <p className="mt-3 font-sans text-xs text-smoke">Shared {r.shared}</p>
        </Card>
      ))}
      <p className="px-1 pb-4 font-sans text-xs leading-relaxed text-smoke">
        We share what we're watching before you have to ask. A risk on this page is being managed —
        silence is the thing to worry about, and there is none here.
      </p>
    </Screen>
  );
}

export function Selections() {
  const { state, dispatch } = useStore();
  const [confirm, setConfirm] = useState(null); // {selection, option}
  return (
    <Screen>
      <Back to="/more" />
      <TopBar eyebrow="Choices that make it yours" title="Selections" />
      {state.selections.map((s) => (
        <Card key={s.id} className="mb-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-sans text-sm font-semibold text-bone">{s.title}</p>
            {s.state === "open" ? <Stamp tone="red">choose by {s.due}</Stamp> : <Stamp tone="stone">decided</Stamp>}
          </div>
          {s.state === "open" ? (
            <>
              <p className="mt-2 font-sans text-xs leading-relaxed text-smoke">{s.body}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {s.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setConfirm({ selection: s, option: o })}
                    className="border border-seam text-left transition-colors active:border-stone"
                  >
                    <img src={o.img} alt="" className="aspect-square w-full object-cover" />
                    <p className="p-3 font-sans text-xs leading-snug text-bone/90">{o.name}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 font-sans text-sm text-bone/80">
              {s.chosenName} <span className="text-smoke">· recorded {s.decidedOn}</span>
            </p>
          )}
        </Card>
      ))}
      <p className="px-1 pb-4 font-sans text-xs leading-relaxed text-smoke">
        Every choice is recorded with its date. "You chose this, on this day" — in writing, for both of us.
      </p>

      {confirm && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/85 backdrop-blur-sm">
          <div className="w-full max-w-md border-t border-seam bg-coal p-6 pb-10">
            <p className="type-eyebrow text-smoke">Confirm your selection</p>
            <p className="type-display mt-2 text-2xl text-bone">{confirm.option.name}</p>
            <p className="mt-2 font-sans text-sm text-smoke">
              {confirm.selection.title} — this will be recorded and issued to site.
            </p>
            <div className="mt-6 flex gap-3">
              <Btn
                full
                onClick={() => {
                  dispatch({ type: "choose", id: confirm.selection.id, option: confirm.option.id, name: confirm.option.name });
                  setConfirm(null);
                }}
              >
                Confirm choice
              </Btn>
              <Btn tone="ghost" onClick={() => setConfirm(null)}>
                Not yet
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

export function Variations() {
  const { state, dispatch } = useStore();
  return (
    <Screen>
      <Back to="/more" />
      <TopBar eyebrow="Changes, priced before they happen" title="Variations" />
      {state.variations.map((v) => (
        <Card key={v.id} className="mb-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-sans text-sm font-semibold text-bone">{v.title}</p>
            <Stamp tone={v.state === "approved" ? "stone" : v.state === "declined" ? "smoke" : "red"}>
              {v.state === "offered" ? "your decision" : v.state}
            </Stamp>
          </div>
          <p className="mt-2 font-sans text-sm leading-relaxed text-bone/80">{v.body}</p>
          <div className="mt-4 flex items-baseline justify-between border-t border-seam pt-3">
            <p className="font-sans text-xs text-smoke">{v.time}</p>
            <p className="type-display text-xl text-bone">+{usd(v.price)}</p>
          </div>
          {v.state === "offered" && (
            <div className="mt-4 flex gap-3">
              <Btn full onClick={() => dispatch({ type: "variation", id: v.id, state: "approved" })}>
                Approve — add to contract
              </Btn>
              <Btn tone="ghost" onClick={() => dispatch({ type: "variation", id: v.id, state: "declined" })}>
                Decline
              </Btn>
            </div>
          )}
          {v.state === "approved" && v.approvedOn && (
            <p className="mt-3 font-sans text-xs text-smoke">Approved {v.approvedOn} — reflected in your payment schedule.</p>
          )}
        </Card>
      ))}
      <p className="px-1 pb-4 font-sans text-xs leading-relaxed text-smoke">
        No change is built until it's priced here and approved by you. No surprises at handover — that's the deal.
      </p>
    </Screen>
  );
}

export function Visits() {
  const { state, dispatch } = useStore();
  const { visits } = state;
  return (
    <Screen>
      <Back to="/more" />
      <TopBar eyebrow="Walk your floor" title="Site visits" />
      {visits.booked && (
        <Card className="rise rise-1 border-stone/40 p-5">
          <p className="type-eyebrow text-stone">Your next visit</p>
          <p className="type-display mt-2 text-2xl text-bone">{visits.booked.date}</p>
          <p className="mt-1 font-sans text-sm text-bone/80">{visits.booked.time} · at the site gate</p>
          <p className="mt-3 font-sans text-xs text-smoke">{visits.booked.note}</p>
        </Card>
      )}
      <p className="type-eyebrow mt-8 text-smoke">Offered slots</p>
      <div className="mt-2">
        {visits.slots.map((s) => (
          <div key={s.id} className="flex items-center justify-between border-b border-seam py-4">
            <div>
              <p className="font-sans text-sm font-semibold text-bone">{s.date}</p>
              <p className="font-sans text-xs text-smoke">{s.time}</p>
            </div>
            <Btn tone="ghost" onClick={() => dispatch({ type: "book", slot: s })}>
              Book
            </Btn>
          </div>
        ))}
      </div>
      <p className="mt-6 pb-4 font-sans text-xs leading-relaxed text-smoke">
        Visits are guided by the site engineer — you'll see your own floor, not a viewing gallery.
      </p>
    </Screen>
  );
}

export function Documents() {
  const { state } = useStore();
  return (
    <Screen>
      <Back to="/more" />
      <TopBar eyebrow="One place, always" title="Documents" />
      <div className="rise rise-1">
        {state.documents.map((d) => (
          <Row
            key={d.id}
            icon={Icon.doc}
            title={d.name}
            meta={d.meta}
            href={d.href ?? undefined}
            onClick={
              d.href
                ? undefined
                : d.path
                  ? () => openDoc(d.path).catch((e) => alert(`Could not open: ${e.message ?? e}`))
                  : () => {}
            }
          />
        ))}
      </div>
      <p className="mt-6 pb-4 font-sans text-xs leading-relaxed text-smoke">
        Your contract, plans and schedules — the papers that matter, never lost in an inbox.
        (Demo: linked documents open; PDFs are placeholders until the live system.)
      </p>
    </Screen>
  );
}

export function Questions() {
  const { state, dispatch } = useStore();
  const [text, setText] = useState("");
  return (
    <Screen>
      <Back to="/more" />
      <TopBar eyebrow="Your thread with the team" title="Questions" />
      <div className="mb-6">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Ask anything about your residence…"
          className="w-full border border-seam bg-transparent px-4 py-3 font-sans text-sm text-bone outline-none placeholder:text-smoke/50 focus:border-stone"
        />
        <Btn
          className="mt-2"
          disabled={!text.trim()}
          onClick={() => {
            dispatch({
              type: "ask",
              question: { id: crypto.randomUUID(), from: state.owner.name, asked: "Today", q: text.trim(), a: null },
            });
            setText("");
          }}
        >
          Send to the team
        </Btn>
      </div>
      {state.questions.map((q) => (
        <Card key={q.id} className="mb-4 p-5">
          <p className="font-sans text-sm leading-relaxed text-bone">{q.q}</p>
          <p className="mt-1.5 font-sans text-xs text-smoke">Asked {q.asked}</p>
          {q.a ? (
            <div className="mt-4 border-l-2 border-pmcc pl-4">
              <p className="font-sans text-sm leading-relaxed text-bone/85">{q.a}</p>
              <p className="mt-1.5 font-sans text-xs text-smoke">PMCC · {q.answered}</p>
            </div>
          ) : (
            <p className="mt-3 font-sans text-xs text-stone">With the team — you'll be notified here.</p>
          )}
        </Card>
      ))}
    </Screen>
  );
}
