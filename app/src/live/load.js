/**
 * Live loaders: read the caller's world from Supabase (RLS decides what that
 * is) and shape it exactly like the demo seed, so every screen works
 * unchanged in either mode.
 */
import { sb } from "../lib/supabase";

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return Number.isNaN(dt.getTime())
    ? String(d)
    : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function mapProject(row) {
  return row
    ? {
        id: row.id,
        name: row.name,
        short: row.name,
        location: row.location,
        delivery: row.delivery,
        hero: row.hero_url ?? "/im/hero-reveal-1280.webp",
        overall: row.overall ?? 0,
        phases: row.phases ?? [],
        milestones: row.milestones ?? [],
        outlook: row.outlook ?? null,
        programme: row.programme ?? null,
        thresholdDays: row.threshold_days ?? 3,
      }
    : null;
}

function mapContent({ diary, lookahead, risks, questions }) {
  return {
    diary: (diary ?? []).map((d) => ({
      id: d.id,
      date: fmtDate(d.entry_date),
      phase: d.phase,
      activity: d.activity ?? null,
      photo: d.photo_url,
      text: d.body,
    })),
    lookahead: lookahead
      ? { updated: fmtDate(String(lookahead.updated_at).slice(0, 10)), weeks: lookahead.weeks ?? [] }
      : { updated: "not yet", weeks: [] },
    risks: (risks ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      status: r.status,
      shared: fmtDate(r.shared_on),
      source: r.source ?? "manual",
      taskName: r.task_name ?? null,
    })),
    questions: (questions ?? []).map((q) => ({
      id: q.id,
      from: q.from_name ?? "Owner",
      q: q.q,
      a: q.a,
      asked: fmtDate(q.asked_on),
      answered: fmtDate(q.answered_on),
    })),
  };
}

async function loadProjectContent(projectId) {
  const [diary, look, risks, questions] = await Promise.all([
    sb.from("diary").select("*").eq("project_id", projectId).order("entry_date", { ascending: false }),
    sb.from("lookahead").select("*").eq("project_id", projectId).maybeSingle(),
    sb.from("risks").select("*").eq("project_id", projectId).order("shared_on", { ascending: false }),
    sb
      .from("questions")
      .select("*, units!inner(project_id, users:profiles!owner_id(full_name))")
      .eq("units.project_id", projectId)
      .order("asked_on", { ascending: false }),
  ]);
  return mapContent({
    diary: diary.data,
    lookahead: look.data,
    risks: risks.data,
    questions: (questions.data ?? []).map((q) => ({ ...q, from_name: q.units?.users?.full_name })),
  });
}

async function loadUnitWorld(unit) {
  const [payments, selections, variations, contract] = await Promise.all([
    sb.from("payments").select("*").eq("unit_id", unit.id).order("ord"),
    sb.from("selections").select("*").eq("unit_id", unit.id),
    sb.from("variations").select("*").eq("unit_id", unit.id),
    sb.from("contract_index").select("clauses").eq("unit_id", unit.id).maybeSingle(),
  ]);
  return {
    payments: (payments.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      link: p.milestone,
      amount: Number(p.amount),
      state: p.state === "due" ? "upcoming" : p.state,
      date: fmtDate(p.paid_on),
      receipt: Boolean(p.receipt_url),
      receiptPath: p.receipt_url ?? null,
    })),
    selections: (selections.data ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      body: s.body,
      due: s.state === "decided" ? "decided" : fmtDate(s.due),
      state: s.state,
      options: s.options ?? [],
      chosen: s.chosen,
      chosenName: s.chosen_name,
      decidedOn: fmtDate(s.decided_on),
    })),
    variations: (variations.data ?? []).map((v) => ({
      id: v.id,
      title: v.title,
      body: v.body,
      price: Number(v.price),
      time: v.time_impact,
      state: v.state,
      approvedOn: fmtDate(v.approved_on),
    })),
    contract: contract.data?.clauses ?? null,
  };
}

async function loadVisitsDocs(projectId, unitId) {
  const [visits, documents] = await Promise.all([
    sb.from("visits").select("*").eq("project_id", projectId),
    sb.from("documents").select("*").eq("project_id", projectId),
  ]);
  const booked = (visits.data ?? []).find((v) => v.state === "booked" && (!v.unit_id || v.unit_id === unitId));
  return {
    visits: {
      booked: booked ? { id: booked.id, date: booked.visit_date, time: booked.visit_time, note: booked.note } : null,
      slots: (visits.data ?? [])
        .filter((v) => v.state === "offered")
        .map((v) => ({ id: v.id, date: v.visit_date, time: v.visit_time })),
    },
    documents: (documents.data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      meta: d.meta,
      href: d.url,
      path: d.storage_path ?? null,
    })),
  };
}

/** Everything an owner's session needs, in the demo's shape. */
export async function loadOwner(profile) {
  const { data: unit } = await sb.from("units").select("*, projects(*)").limit(1).single();
  if (!unit) throw new Error("no-unit");
  const [content, world, vd] = await Promise.all([
    loadProjectContent(unit.project_id),
    loadUnitWorld(unit),
    loadVisitsDocs(unit.project_id, unit.id),
  ]);
  return {
    project: mapProject(unit.projects),
    owner: {
      name: profile.full_name,
      unit: unit.name,
      level: unit.level,
      plan: unit.plan_url,
      photo: unit.photo_url ?? "/im/hero-three-quarter-1280.webp",
      area: unit.area,
      extras: unit.extras,
      price: Number(unit.price),
      memberSince: unit.member_since,
      unitId: unit.id,
      contract: world.contract ?? {},
    },
    ...content,
    payments: world.payments,
    selections: world.selections,
    variations: world.variations,
    ...vd,
    team: { members: [], owners: [] },
  };
}

/** Everything the team console needs for one project. */
export async function loadTeam(projectId) {
  const { data: projects } = await sb.from("projects").select("id, name").order("created_at");
  if (!projects?.length) throw new Error("no-projects");
  const active = projects.find((p) => p.id === projectId) ?? projects[0];
  const [{ data: proj }, { data: units }, content] = await Promise.all([
    sb.from("projects").select("*").eq("id", active.id).single(),
    sb.from("units").select("*, users:profiles!owner_id(full_name, email, last_seen)").eq("project_id", active.id),
    loadProjectContent(active.id),
  ]);
  const sold = (units ?? []).find((u) => u.owner_id);
  const world = sold ? await loadUnitWorld(sold) : { payments: [], selections: [], variations: [], contract: null };
  const vd = await loadVisitsDocs(active.id, sold?.id);
  const { data: logRows } = await sb
    .from("project_log")
    .select("*")
    .eq("project_id", active.id)
    .order("at", { ascending: false })
    .limit(80);
  // Read receipts: for each owner, the latest diary entry they actually opened.
  const ownerIds = (units ?? []).map((u) => u.owner_id).filter(Boolean);
  const readsByOwner = {};
  if (ownerIds.length) {
    const { data: readRows } = await sb
      .from("reads")
      .select("profile_id, item_id, read_at")
      .eq("item_kind", "diary")
      .in("profile_id", ownerIds)
      .order("read_at", { ascending: false });
    const diaryById = new Map(content.diary.map((d) => [d.id, d]));
    for (const r of readRows ?? []) {
      const entry = diaryById.get(r.item_id);
      if (!entry || readsByOwner[r.profile_id]) continue;
      const seen = new Date(r.read_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      readsByOwner[r.profile_id] = `Saw the ${entry.date} update on ${seen}`;
    }
  }
  return {
    activeProjectId: active.id,
    projectsMeta: projects.map((p) => ({ id: p.id, name: p.name })),
    project: mapProject(proj),
    owner: sold
      ? {
          name: sold.users?.full_name ?? "—",
          unit: sold.name,
          level: sold.level,
          plan: sold.plan_url,
          photo: sold.photo_url,
          area: sold.area,
          extras: sold.extras,
          price: Number(sold.price),
          memberSince: sold.member_since,
          unitId: sold.id,
          contract: world.contract ?? {},
        }
      : { name: "—", unit: "No owners yet", level: "", price: 0, contract: {}, unitId: null },
    ...content,
    payments: world.payments,
    selections: world.selections,
    variations: world.variations,
    ...vd,
    log: (logRows ?? []).map((l) => ({
      id: l.id,
      at: new Date(l.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      author: l.author,
      kind: l.kind,
      body: l.body,
    })),
    team: {
      members: [],
      owners: (units ?? []).map((u) => ({
        unitId: u.id,
        unit: u.name,
        name: u.users?.full_name ?? "— unsold —",
        state: u.owner_id ? "active" : "available",
        lastSeen: u.users?.last_seen ? new Date(u.users.last_seen).toLocaleString() : null,
        opened: (u.owner_id && readsByOwner[u.owner_id]) || null,
      })),
    },
  };
}
