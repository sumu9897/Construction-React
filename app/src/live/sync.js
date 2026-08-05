/**
 * Live write-through: every approved interaction mirrors to Supabase.
 * The reducer stays the single source of UI truth; this module makes the
 * database agree with it. Failures are logged and surfaced once — the UI
 * never blocks on the network.
 */
import { sb, IS_LIVE } from "../lib/supabase";

let warned = false;
function fail(where, error) {
  console.error(`[live-sync] ${where}:`, error);
  if (!warned) {
    warned = true;
    alert("A change could not reach the server — check your connection. The app will keep working; retry the action.");
  }
}

const iso = () => new Date().toISOString().slice(0, 10);

/** Mirror one dispatched action to the database. Runs after the reducer. */
export function syncAction(action, nextState) {
  if (!IS_LIVE) return;
  const projectId = nextState.project?.id;
  const unitId = nextState.owner?.unitId;

  const run = async () => {
    switch (action.type) {
      case "publish":
        return sb.from("diary").insert({
          id: action.entry.id,
          project_id: projectId,
          phase: action.entry.phase,
          activity: action.entry.activity ?? null,
          photo_url: action.entry.photo,
          body: action.entry.text,
          published: true,
        });
      case "tick":
      case "setActivity":
      case "addActivity":
      case "removeActivity":
      case "moveActivity":
        return sb.from("lookahead").upsert({
          project_id: projectId,
          weeks: nextState.lookahead.weeks,
          updated_at: new Date().toISOString(),
        });
      case "choose":
        return sb
          .from("selections")
          .update({ state: "decided", chosen: action.option, chosen_name: action.name, decided_on: iso() })
          .eq("id", action.id);
      case "variation":
        return sb
          .from("variations")
          .update({ state: action.state, approved_on: action.state === "approved" ? iso() : null })
          .eq("id", action.id);
      case "book":
        return sb.from("visits").update({ state: "booked", unit_id: unitId }).eq("id", action.slot.id);
      case "pay":
        return sb.from("payments").update({ state: "paid", paid_on: iso() }).eq("id", action.id);
      case "shareRisk":
        return sb.from("risks").insert({
          id: action.risk.id,
          project_id: projectId,
          title: action.risk.title,
          body: action.risk.body,
          status: action.risk.status,
          source: action.risk.source ?? "manual",
          task_uid: action.risk.taskUid ?? null,
          task_name: action.risk.taskName ?? null,
        });
      case "addDecision":
        return sb.from("decisions").insert({
          project_id: projectId,
          body: action.decision.body,
          task_uid: action.decision.taskUid ?? null,
          task_name: action.decision.taskName ?? null,
        });
      case "closeRisk":
        return sb.from("risks").update({ status: "closed" }).eq("id", action.id);
      case "ask":
        return sb.from("questions").insert({ id: action.question.id, unit_id: unitId, q: action.question.q });
      case "answer":
        return sb.from("questions").update({ a: action.text, answered_on: iso() }).eq("id", action.id);
      case "log":
        return sb.from("project_log").insert({
          project_id: projectId,
          author: action.entry.author,
          kind: action.entry.kind,
          body: action.entry.body,
        });
      case "setOutlook":
        return sb.from("projects").update({ outlook: action.outlook }).eq("id", projectId);
      default:
        return null;
    }
  };

  Promise.resolve(run()).then((res) => {
    if (res?.error) fail(action.type, res.error);
  }).catch((e) => fail(action.type, e));
}

/**
 * Create a project server-side. Every project gets its residence (one unit —
 * the common villa case; more can be added later), and when the client's
 * name/email are given, their sign-in is pre-authorized and linked to that
 * unit — the client's first login lands them inside their project with
 * nothing else to do.
 */
export async function createProjectLive(meta) {
  const { data, error } = await sb
    .from("projects")
    .insert({ name: meta.name, location: meta.location, delivery: meta.delivery })
    .select("id, name")
    .single();
  if (error) throw error;
  await sb.from("lookahead").insert({
    project_id: data.id,
    weeks: [
      { label: "This week", range: "—", items: [] },
      { label: "Next week", range: "—", items: [] },
      { label: "Week after", range: "—", items: [] },
    ],
  });
  const unitName = meta.name;
  const { data: unit, error: uErr } = await sb
    .from("units")
    .insert({ project_id: data.id, name: unitName, level: "", area: "", extras: meta.location })
    .select("id")
    .single();
  if (uErr) throw uErr;
  if (meta.ownerEmail) {
    const { error: pErr } = await sb.from("pre_approved").insert({
      email: meta.ownerEmail.trim().toLowerCase(),
      role: "owner",
      full_name: meta.ownerName?.trim() || "Owner",
      unit_name: unitName,
      unit_id: unit.id,
    });
    if (pErr) throw pErr;
  }
  return data;
}

/** The two Groq brains, via edge functions. */
export async function askLive(question) {
  const { data, error } = await sb.functions.invoke("ask", { body: { question } });
  if (error) throw error;
  return data; // {answer, escalated}
}

export async function copilotLive(report, projectId) {
  const { data, error } = await sb.functions.invoke("copilot", { body: { report, project_id: projectId } });
  if (error) throw error;
  return data; // {actions} for reports, {answer} for questions
}

/* ------------------------------------------------------------------ */
/* The programme engine: snapshots, questions, reasons, decisions.     */

/** Append this ingest's full parsed state to the permanent history. */
export async function saveSnapshot(projectId, parsed, isBaseline) {
  const { error } = await sb.from("programme_snapshots").insert({
    project_id: projectId,
    source: "manual",
    is_baseline: isBaseline,
    task_count: parsed.taskCount,
    overall: parsed.overall,
    tasks: parsed.snapshot,
  });
  if (error) throw error;
}

export const BASE_REASONS = [
  "Material delivery",
  "Labour availability",
  "Design change",
  "Permit / approvals",
  "Weather",
  "Client decision pending",
];

/**
 * Option chips for a question, learned: reasons already logged for this
 * task lead, then the project's most frequent, then the base list.
 */
export function learnedOptions(reasons, taskUid, taskName) {
  const freq = new Map();
  const taskFreq = new Map();
  for (const r of reasons ?? []) {
    freq.set(r.reason, (freq.get(r.reason) ?? 0) + 1);
    if ((taskUid && r.task_uid === taskUid) || r.task_name === taskName) {
      taskFreq.set(r.reason, (taskFreq.get(r.reason) ?? 0) + 1);
    }
  }
  const rank = (o) => (taskFreq.get(o) ?? 0) * 1000 + (freq.get(o) ?? 0);
  const seen = new Set();
  const all = [...taskFreq.keys(), ...freq.keys(), ...BASE_REASONS].filter((o) => {
    const k = o.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return all.sort((a, b) => rank(b) - rank(a)).slice(0, 6);
}

/** Queue the post-ingest questions — one per material delta. */
export async function queueQuestions(projectId, rows) {
  if (!rows.length) return;
  const { error } = await sb.from("copilot_questions").insert(
    rows.map((q) => ({
      project_id: projectId,
      task_uid: q.taskUid ?? null,
      task_name: q.taskName,
      kind: q.kind,
      change: q.change,
      options: q.options,
    })),
  );
  if (error) throw error;
}

export async function fetchOpenQuestions(projectId) {
  const { data, error } = await sb
    .from("copilot_questions")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** The answer becomes the task's logged reason; the question closes. */
export async function answerQuestion(q, reason, author) {
  const { error: rErr } = await sb.from("task_reasons").insert({
    project_id: q.project_id,
    task_uid: q.task_uid,
    task_name: q.task_name,
    reason,
    change: q.change,
    author,
  });
  if (rErr) throw rErr;
  const { error } = await sb.from("copilot_questions").update({ status: "answered" }).eq("id", q.id);
  if (error) throw error;
}

export async function dismissQuestion(id) {
  await sb.from("copilot_questions").update({ status: "dismissed" }).eq("id", id);
}

export async function fetchReasons(projectId) {
  const { data } = await sb
    .from("task_reasons")
    .select("*")
    .eq("project_id", projectId)
    .order("at", { ascending: false })
    .limit(400);
  return data ?? [];
}

/** Connect a manual risk to the task an ingest showed slipping. */
export async function linkRiskToTask(riskId, taskUid, taskName) {
  const { error } = await sb
    .from("risks")
    .update({ task_uid: taskUid ?? null, task_name: taskName })
    .eq("id", riskId);
  if (error) throw error;
}

export async function decideDecision(id) {
  await sb
    .from("decisions")
    .update({ status: "decided", decided_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * Read receipts: the owner opened the diary — record which entries, quietly.
 * Duplicate opens are ignored, so the stored time is the FIRST view: "you saw
 * this update on that date" is the fact worth keeping.
 */
export function markDiaryRead(entryIds) {
  if (!IS_LIVE || !entryIds?.length) return;
  sb.auth.getUser().then(({ data }) => {
    if (!data?.user) return;
    const rows = entryIds.map((id) => ({ profile_id: data.user.id, item_kind: "diary", item_id: id }));
    sb.from("reads")
      .upsert(rows, { onConflict: "profile_id,item_kind,item_id", ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) console.error("[live-sync] reads:", error);
      });
  });
}

/** Presence: stamp the caller's last-seen, silently. */
export function touchPresence() {
  if (!IS_LIVE) return;
  sb.auth.getUser().then(({ data }) => {
    if (data?.user)
      sb.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", data.user.id).then(() => {});
  });
}
