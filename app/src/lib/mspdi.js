/**
 * MS Project (MSPDI XML) reader, in the browser. Extracts everything the
 * portal's engine needs — identity (UID, WBS), planned and ACTUAL dates,
 * baseline dates, predecessors and resources — and derives the milestone
 * arc, the three-week look-ahead and the snapshot the next import is
 * diffed against. Nothing invented — only what the file states.
 *
 * The WHAT lives here; the WHY never does. Reasons come from the team via
 * the copilot and are stored separately (task_reasons).
 */

const fmtMonth = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};
const fmtDay = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Direct-child text only — Task elements contain <Baseline> and
 *  <PredecessorLink> whose own <Start>/<UID> children would pollute a
 *  descendant search. */
function child(el, name) {
  for (const k of el.children) if (k.tagName === name) return k.textContent;
  return undefined;
}

const DEP_TYPE = { 0: "FF", 1: "FS", 2: "SF", 3: "SS" };

export function parseMSPDI(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Not a valid MS Project XML (MSPDI) file.");

  // Resources and their assignments, so a task can carry who does it.
  const resNames = new Map();
  for (const r of doc.getElementsByTagName("Resource")) {
    const uid = child(r, "UID");
    const name = child(r, "Name");
    if (uid != null && name) resNames.set(uid, name);
  }
  const taskRes = new Map();
  for (const a of doc.getElementsByTagName("Assignment")) {
    const t = child(a, "TaskUID");
    const r = child(a, "ResourceUID");
    const name = resNames.get(r);
    if (t != null && name) taskRes.set(t, [...(taskRes.get(t) ?? []), name]);
  }

  const validDate = (v) => (v && !Number.isNaN(new Date(v).getTime()) ? v.slice(0, 10) : undefined);

  const nodes = [...doc.getElementsByTagName("Task")]
    .map((t) => {
      // Predecessors, canonicalised: "5FS+2;7SS" (uid, type, lag in days).
      const preds = [...t.children]
        .filter((k) => k.tagName === "PredecessorLink")
        .map((p) => {
          const uid = child(p, "PredecessorUID");
          const type = DEP_TYPE[child(p, "Type") ?? "1"] ?? "FS";
          const lag = Number(child(p, "LinkLag") ?? 0) / 4800; // tenths of minutes → 8h days
          return `${uid}${type}${lag ? (lag > 0 ? `+${lag}` : lag) : ""}`;
        })
        .sort()
        .join(";");
      // The task's own saved baseline (number 0), if the file carries one.
      let bs;
      let bf;
      for (const k of t.children) {
        if (k.tagName === "Baseline" && (child(k, "Number") ?? "0") === "0") {
          bs = validDate(child(k, "Start"));
          bf = validDate(child(k, "Finish"));
        }
      }
      const uid = child(t, "UID");
      return {
        uid,
        name: child(t, "Name"),
        wbs: child(t, "WBS"),
        milestone: child(t, "Milestone") === "1",
        start: child(t, "Start"),
        finish: child(t, "Finish"),
        actualStart: validDate(child(t, "ActualStart")),
        actualFinish: validDate(child(t, "ActualFinish")),
        pct: Number(child(t, "PercentComplete") ?? 0),
        summary: child(t, "Summary") === "1",
        outline: Number(child(t, "OutlineLevel") ?? 0),
        active: child(t, "Active") !== "0",
        preds,
        baselineStart: bs,
        baselineFinish: bf,
        resources: (taskRes.get(uid) ?? []).join(", "),
      };
    })
    .filter((t) => t.name && t.active);
  const tasks = nodes.filter((t) => !t.summary);

  // The progress mechanism: MS Project already carries % complete per task.
  // Overall = duration-weighted average across activities; phases = the
  // file's own top-level summary bars, verbatim. The ring therefore moves
  // exactly when the programme says it moved.
  let W = 0;
  let S = 0;
  for (const t of tasks) {
    const d = Math.max(1, (new Date(t.finish) - new Date(t.start)) / 86400000 || 1);
    W += d;
    S += d * (t.pct || 0);
  }
  const overall = W ? Math.round(S / W) : 0;
  const phases = nodes
    .filter((t) => t.summary && t.outline === 1)
    .map((s) => ({ name: s.name, pct: Math.round(s.pct || 0) }));

  const milestones = tasks
    .filter((t) => t.milestone)
    .sort((a, b) => new Date(a.finish ?? a.start) - new Date(b.finish ?? b.start))
    .map((m) => ({ name: m.name, date: fmtMonth(m.finish ?? m.start), done: m.pct >= 100 }));
  const next = milestones.find((m) => !m.done);
  if (next) next.next = true;

  // Three weeks from this week's Monday, activities only, with dates.
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weeks = [0, 1, 2].map((w) => {
    const from = new Date(weekStart);
    from.setDate(weekStart.getDate() + w * 7);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    const items = tasks
      .filter((t) => {
        if (t.milestone) return false;
        const s = new Date(t.start);
        return s >= from && s <= to;
      })
      .slice(0, 8)
      .map((t) => ({
        t: t.name,
        s: t.pct >= 100 ? "done" : t.pct > 0 ? "ready" : "todo",
        d: fmtDay(new Date(t.start)),
        u: t.uid,
      }));
    return {
      label: w === 0 ? "This week" : w === 1 ? "Next week" : "Week after",
      range: `${fmtDay(from)} – ${fmtDay(to)}`,
      items,
    };
  });

  // The snapshot the next import is compared against. Facts only, short
  // keys, empty fields omitted: u uid, n name, w wbs, s/f planned dates,
  // as/af actual dates, p pct, m milestone, d predecessors, bs/bf baseline,
  // r resources.
  const snapshot = tasks.map((t) => {
    const row = {
      u: t.uid,
      n: t.name,
      s: (t.start ?? "").slice(0, 10),
      f: (t.finish ?? "").slice(0, 10),
      m: t.milestone,
      p: t.pct,
    };
    if (t.wbs) row.w = t.wbs;
    if (t.actualStart) row.as = t.actualStart;
    if (t.actualFinish) row.af = t.actualFinish;
    if (t.preds) row.d = t.preds;
    if (t.baselineStart) row.bs = t.baselineStart;
    if (t.baselineFinish) row.bf = t.baselineFinish;
    if (t.resources) row.r = t.resources;
    return row;
  });

  return { taskCount: tasks.length, milestones, weeks, snapshot, overall, phases };
}

const day = 86400000;
const fmtShort = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * The truth between two programmes, classified. Matched by task UID with a
 * name fallback (older snapshots carried no UID); no interpretation.
 *
 * Returns { completed, slipped, pulled, added, removed, depChanged, moved }
 * — slips and pulls carry day counts, from/to dates and a `material` flag
 * against the given threshold. Completed carries the file's actual finish
 * when it states one.
 */
export function diffProgramme(oldSnapshot, newSnapshot, thresholdDays = 3) {
  if (!oldSnapshot?.length) return null; // first import — baseline, nothing to compare
  const key = (t) => (t.u != null ? `u:${t.u}` : `n:${t.n.trim().toLowerCase()}`);
  const nameKey = (t) => `n:${t.n.trim().toLowerCase()}`;
  const old = new Map();
  for (const t of oldSnapshot) {
    old.set(nameKey(t), t); // fallback lane first, UID lane wins
    old.set(key(t), t);
  }
  const seen = new Set();

  const completed = [];
  const slipped = [];
  const pulled = [];
  const depChanged = [];

  for (const t of newSnapshot) {
    const o = old.get(key(t)) ?? old.get(nameKey(t));
    if (!o) continue;
    seen.add(key(o));
    seen.add(nameKey(o));

    if ((o.p ?? 0) < 100 && ((t.p ?? 0) >= 100 || t.af)) {
      completed.push({ u: t.u, n: t.n, af: t.af ?? null, pct: t.p });
    }
    const df = t.f && o.f ? Math.round((new Date(t.f) - new Date(o.f)) / day) : 0;
    const ds = t.s && o.s ? Math.round((new Date(t.s) - new Date(o.s)) / day) : 0;
    const delta = df !== 0 ? df : ds;
    if (delta !== 0 && (t.p ?? 0) < 100) {
      const entry = {
        u: t.u,
        n: t.n,
        days: Math.abs(delta),
        from: fmtShort(o.f || o.s),
        to: fmtShort(t.f || t.s),
        material: Math.abs(delta) >= thresholdDays,
        text: `${t.n}: ${delta > 0 ? "+" : "−"}${Math.abs(delta)}d (${fmtShort(o.f || o.s)} → ${fmtShort(t.f || t.s)})`,
      };
      (delta > 0 ? slipped : pulled).push(entry);
    }
    if ((o.d ?? "") !== (t.d ?? "")) {
      depChanged.push({ u: t.u, n: t.n, from: o.d || "none", to: t.d || "none" });
    }
  }

  const added = newSnapshot
    .filter((t) => !(old.has(key(t)) || old.has(nameKey(t))))
    .map((t) => ({ u: t.u, n: t.n, s: fmtShort(t.s), f: fmtShort(t.f) }));
  const removed = oldSnapshot.filter((t) => !seen.has(key(t))).map((t) => ({ u: t.u, n: t.n }));

  const bySize = (a, b) => b.days - a.days;
  slipped.sort(bySize);
  pulled.sort(bySize);

  // Back-compat: the import preview lists "moved" exactly as before.
  const moved = [...slipped, ...pulled].map((m) => ({ text: m.text, abs: m.days }));
  return { completed, slipped, pulled, added, removed, depChanged, moved };
}
