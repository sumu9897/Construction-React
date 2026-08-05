/**
 * The Report: a period roll-up assembled from the permanent record — the
 * snapshot diffs (WHAT), the logged reasons (WHY), risks, and decisions
 * needed. Two flavours of the same truth:
 *
 *   Internal — everything, raw: every move with day counts, wobbles under
 *   the threshold, dependency changes, source tags, missing reasons named
 *   as missing.
 *
 *   Client — clean and forward-looking: completed with dates, material
 *   moves with their logged reason, decisions needed from the owner, and
 *   what is coming up. No internal noise; nothing is ever sent
 *   automatically — print or copy, and a human sends it.
 */
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../store";
import { Screen, TopBar, Card, Btn, Stamp, Back } from "../../ui";
import { IS_LIVE, sb } from "../../lib/supabase";
import { diffProgramme } from "../../lib/mspdi";
import { decideDecision } from "../../live/sync";

const fmtTs = (ts) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function Report() {
  const { state, dispatch } = useStore();
  const projectId = state.project?.id;
  const threshold = state.project?.thresholdDays ?? 3;

  const [snaps, setSnaps] = useState([]);
  const [sinceId, setSinceId] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [risks, setRisks] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [flavor, setFlavor] = useState("internal");
  const [decisionText, setDecisionText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!IS_LIVE || !projectId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const [s, r, k, d] = await Promise.all([
        sb.from("programme_snapshots").select("id, taken_at, is_baseline, overall, task_count, tasks").eq("project_id", projectId).order("taken_at", { ascending: false }).limit(12),
        sb.from("task_reasons").select("*").eq("project_id", projectId).order("at", { ascending: false }).limit(400),
        sb.from("risks").select("*").eq("project_id", projectId).order("shared_on", { ascending: false }),
        sb.from("decisions").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);
      setSnaps(s.data ?? []);
      setSinceId((s.data ?? [])[1]?.id ?? null);
      setReasons(r.data ?? []);
      setRisks(k.data ?? []);
      setDecisions(d.data ?? []);
      setLoading(false);
    })();
  }, [projectId]);

  const latest = snaps[0] ?? null;
  const since = snaps.find((s) => s.id === sinceId) ?? null;

  const diff = useMemo(
    () => (latest && since ? diffProgramme(since.tasks, latest.tasks, threshold) : null),
    [latest, since, threshold],
  );

  // Latest logged reason per task, for the period.
  const reasonFor = (uid, name) =>
    reasons.find((r) => (uid && r.task_uid === uid) || r.task_name === name)?.reason ?? null;

  const periodRisks = since ? risks.filter((r) => new Date(r.shared_on) >= new Date(since.taken_at.slice(0, 10))) : risks;
  const openDecisions = decisions.filter((d) => d.status === "open");
  const upcoming = state.lookahead?.weeks?.[0]?.items ?? [];

  if (!IS_LIVE) {
    return (
      <Screen>
        <Back to="/team" label="Console" />
        <TopBar eyebrow="Roll-up of the period" title="Report" />
        <p className="font-sans text-sm leading-relaxed text-smoke">
          The Report reads the permanent record — snapshots, reasons, risks, decisions — which
          lives on the server. Open the live app to use it.
        </p>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="print:hidden">
        <Back to="/team" label="Console" />
      </div>
      <TopBar eyebrow="Assembled from the record — nothing sent without you" title="Report" />

      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex border border-seam">
          {["internal", "client"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFlavor(f)}
              className={`px-4 py-2 font-sans text-xs uppercase tracking-wideish transition-colors ${
                flavor === f ? "bg-bone text-ink" : "text-smoke"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {snaps.length > 1 && (
          <select
            value={sinceId ?? ""}
            onChange={(e) => setSinceId(e.target.value)}
            className="border border-seam bg-coal px-3 py-2 font-sans text-xs text-bone outline-none"
          >
            {snaps.slice(1).map((s) => (
              <option key={s.id} value={s.id}>
                Since {fmtTs(s.taken_at)}{s.is_baseline ? " (baseline)" : ""}
              </option>
            ))}
          </select>
        )}
        <Btn tone="ghost" onClick={() => window.print()}>
          Print / PDF
        </Btn>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-smoke">Reading the record…</p>
      ) : !latest ? (
        <p className="font-sans text-sm leading-relaxed text-smoke">
          No programme snapshots yet. Import the MS Project file in Project &amp; programme —
          the first import becomes the baseline, and every one after it feeds this report.
        </p>
      ) : !since ? (
        <p className="font-sans text-sm leading-relaxed text-smoke">
          One snapshot on record ({fmtTs(latest.taken_at)}, the baseline). The report comes to
          life on the second import, when there is a period to roll up.
        </p>
      ) : (
        <div className="space-y-4">
          <Card className="p-5">
            <p className="type-eyebrow text-smoke">
              {state.project.name} · {fmtTs(since.taken_at)} → {fmtTs(latest.taken_at)}
            </p>
            <p className="mt-2 font-sans text-sm leading-relaxed text-bone/85">
              Overall {since.overall}% → {latest.overall}%
              {state.project.outlook?.note ? ` · ${state.project.outlook.note}` : ""}
            </p>
          </Card>

          {/* Completed */}
          <Card className="p-5">
            <p className="type-eyebrow text-[#55996A]">Completed this period</p>
            {diff?.completed.length ? (
              <ul className="mt-3 space-y-2">
                {diff.completed.map((c) => (
                  <li key={c.n} className="font-sans text-sm leading-relaxed text-bone/85">
                    {c.n} —{" "}
                    {c.af
                      ? `${c.af} (actual finish, from the file)`
                      : `${fmtTs(latest.taken_at)} (import date — no actual finish in the file)`}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 font-sans text-sm text-smoke">Nothing marked complete this period.</p>
            )}
          </Card>

          {/* Moves */}
          <Card className="p-5">
            <p className="type-eyebrow text-[#D9A441]">Dates that moved</p>
            {diff?.slipped.filter((s) => flavor === "internal" || s.material).length ? (
              <ul className="mt-3 space-y-2.5">
                {diff.slipped
                  .filter((s) => flavor === "internal" || s.material)
                  .map((s) => {
                    const why = reasonFor(s.u, s.n);
                    return (
                      <li key={s.n} className="font-sans text-sm leading-relaxed text-bone/85">
                        {s.n} — {flavor === "internal" ? `+${s.days}d (${s.from} → ${s.to})` : `new date ${s.to}`}
                        {why ? (
                          <span className="text-smoke"> · {why}</span>
                        ) : flavor === "internal" ? (
                          <span className="text-pmcc"> · no reason logged</span>
                        ) : null}
                        {flavor === "internal" && !s.material && (
                          <span className="text-smoke"> · below threshold</span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="mt-2 font-sans text-sm text-smoke">No material moves this period.</p>
            )}
            {diff?.pulled.length > 0 && (
              <>
                <p className="type-eyebrow mt-4 text-[#55996A]">Pulled forward</p>
                <ul className="mt-2 space-y-2">
                  {diff.pulled.map((s) => (
                    <li key={s.n} className="font-sans text-sm leading-relaxed text-bone/85">
                      {s.n} — {flavor === "internal" ? `−${s.days}d (${s.from} → ${s.to})` : `now ${s.to}`}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {flavor === "internal" && (diff?.added.length > 0 || diff?.removed.length > 0 || diff?.depChanged.length > 0) && (
              <div className="mt-4 space-y-1.5 border-t border-seam pt-3">
                {diff.added.length > 0 && (
                  <p className="font-sans text-xs text-bone/85">
                    <span className="uppercase tracking-wideish text-[0.65rem] text-smoke">Added:</span>{" "}
                    {diff.added.map((a) => `${a.n} (${a.s} → ${a.f})`).join(" · ")}
                  </p>
                )}
                {diff.removed.length > 0 && (
                  <p className="font-sans text-xs text-bone/85">
                    <span className="uppercase tracking-wideish text-[0.65rem] text-smoke">Removed:</span>{" "}
                    {diff.removed.map((r) => r.n).join(" · ")}
                  </p>
                )}
                {diff.depChanged.length > 0 && (
                  <p className="font-sans text-xs text-bone/85">
                    <span className="uppercase tracking-wideish text-[0.65rem] text-smoke">Dependencies:</span>{" "}
                    {diff.depChanged.map((c) => `${c.n} (${c.from} → ${c.to})`).join(" · ")}
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Risks */}
          <Card className="p-5">
            <p className="type-eyebrow text-pmcc">Risks {flavor === "internal" ? "this period" : ""}</p>
            {periodRisks.length ? (
              <ul className="mt-3 space-y-2">
                {periodRisks
                  .filter((r) => flavor === "internal" || r.status !== "closed")
                  .map((r) => (
                    <li key={r.id} className="font-sans text-sm leading-relaxed text-bone/85">
                      {r.title}
                      {flavor === "internal" && (
                        <span className="text-smoke">
                          {" "}
                          · {r.source ?? "manual"}
                          {r.task_name ? ` · ${r.task_name}` : ""} · {r.status}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-2 font-sans text-sm text-smoke">No new risks this period.</p>
            )}
          </Card>

          {/* Decisions needed */}
          <Card className="p-5">
            <p className="type-eyebrow text-bone">Decisions needed {flavor === "client" ? "from you" : "from the owner"}</p>
            {openDecisions.length ? (
              <ul className="mt-3 space-y-2.5">
                {openDecisions.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-3 font-sans text-sm leading-relaxed text-bone/85">
                    <span>
                      {d.body}
                      {d.task_name ? <span className="text-smoke"> · {d.task_name}</span> : ""}
                      {flavor === "internal" && <span className="text-smoke"> · logged {fmtTs(d.created_at)}</span>}
                    </span>
                    {flavor === "internal" && (
                      <Btn
                        tone="ghost"
                        onClick={async () => {
                          await decideDecision(d.id);
                          setDecisions((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: "decided" } : x)));
                        }}
                      >
                        Decided
                      </Btn>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 font-sans text-sm text-smoke">No open decisions.</p>
            )}
            {flavor === "internal" && (
              <div className="mt-4 flex gap-2 border-t border-seam pt-3 print:hidden">
                <input
                  value={decisionText}
                  onChange={(e) => setDecisionText(e.target.value)}
                  placeholder="Log a decision needed…"
                  className="min-w-0 flex-1 border border-seam bg-transparent px-3 py-2 font-sans text-xs text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
                />
                <Btn
                  tone="ghost"
                  disabled={!decisionText.trim()}
                  onClick={async () => {
                    const body = decisionText.trim();
                    const { data, error } = await sb
                      .from("decisions")
                      .insert({ project_id: projectId, body })
                      .select()
                      .single();
                    if (error) {
                      alert(`Could not log: ${error.message}`);
                      return;
                    }
                    setDecisions((prev) => [data, ...prev]);
                    setDecisionText("");
                    dispatch({
                      type: "log",
                      entry: {
                        id: crypto.randomUUID(),
                        at: "Just now",
                        author: state.session?.name ?? "",
                        kind: "note",
                        body: `Decision needed logged: ${body}`,
                      },
                    });
                  }}
                >
                  Log
                </Btn>
              </div>
            )}
          </Card>

          {/* Coming up */}
          <Card className="p-5">
            <p className="type-eyebrow text-smoke">Coming up this week</p>
            {upcoming.length ? (
              <ul className="mt-3 space-y-1.5">
                {upcoming.map((it) => (
                  <li key={it.t} className="font-sans text-sm text-bone/85">
                    {it.t}
                    {it.d ? <span className="text-smoke"> · {it.d}</span> : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 font-sans text-sm text-smoke">Nothing scheduled to start this week.</p>
            )}
          </Card>

          <p className="pb-2 font-sans text-[0.65rem] leading-relaxed text-smoke print:hidden">
            {flavor === "client"
              ? "Client flavour: clean and forward-looking. Print it, or read from it — nothing is sent automatically."
              : "Internal flavour: the raw record, including what has no reason logged yet."}
          </p>
        </div>
      )}
    </Screen>
  );
}
