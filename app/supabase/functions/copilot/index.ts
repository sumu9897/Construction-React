// Site Copilot — the team's natural-language console, live version.
// Paste into Supabase: Edge Functions → Deploy new function → name: copilot
// Secrets required: GROQ_API_KEY
//
// The engineer reports in plain words; the model returns STRUCTURED proposed
// actions. It never writes to the database — the client applies each action
// through normal (RLS-guarded) writes only after a human taps Apply. Team-only.

import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Open-weights reasoning model on Groq's free tier — much stronger at
// reading the log and understanding intent than llama-3.3-70b.
const MODEL = "openai/gpt-oss-120b";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return new Response("unauthorized", { status: 401, headers: cors });
    const { data: me } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    if (me?.role !== "team") return new Response("forbidden", { status: 403, headers: cors });

    const { report, project_id } = await req.json();
    if (!report?.trim() || !project_id) return new Response("bad request", { status: 400, headers: cors });

    const [look, risks, project, logQ] = await Promise.all([
      supabase.from("lookahead").select("weeks").eq("project_id", project_id).maybeSingle(),
      supabase.from("risks").select("title, status, shared_on").eq("project_id", project_id),
      supabase.from("projects").select("milestones, delivery, outlook").eq("id", project_id).single(),
      supabase.from("project_log").select("at, author, kind, body").eq("project_id", project_id)
        .order("at", { ascending: false }).limit(150),
    ]);

    // The log as readable lines, not raw JSON — models trace history far
    // better this way, and the timestamp sits right next to the event.
    const logLines = (logQ.data ?? [])
      .map((l) => `${String(l.at).slice(0, 16).replace("T", " ")} | ${l.author} | ${l.kind} | ${l.body}`)
      .join("\n");
    const today = new Date().toISOString().slice(0, 10);

    const system = [
      "You are the Site Copilot inside PMCC's construction console. The site engineer either REPORTS site events in plain, sometimes messy words (typos included), or ASKS about the project.",
      'If the message is a QUESTION (when/what/who/how/status/history — anything seeking information rather than reporting news), return ONLY {"answer":"<2-4 sentences>"}. HOW TO ANSWER:',
      '- The LOG is the project\'s permanent history, newest first, one event per line: "timestamp | author | kind | text". A line like [Look-ahead: "X" → Completed] is the record that X was marked completed at that line\'s timestamp.',
      '- For "when did X happen?": find the LOG lines mentioning that item (match loosely — typos, partial names, different word order) and quote the date and time of the newest relevant line, e.g. "It was marked completed on Aug 4 at 14:12 by Nadim."',
      "- Items may cycle through several states as the team taps (Delayed or Not started lines can appear between others); the NEWEST line for an item is its truth. Older lines are history you may summarize if asked.",
      "- Answer strictly from the provided data. If the exact fact is not in it, say what IS known (e.g. the item's current state in the LOOKAHEAD) and state plainly that the exact date was not logged. Never guess a date, number, or name.",
      'If the message is a REPORT, return ONLY a JSON object: {"actions": [...]}. Action shapes:',
      '{"kind":"risk","label":"Share a risk: <short title>","detail":"<one line>","title":"<short title>","body":"<what happened, its impact, and mitigation if stated — faithful to the report>"}',
      '{"kind":"outlook","label":"Update the delivery outlook","detail":"<one line>","state":"ontrack|watch|atrisk","note":"<ONE sentence the OWNER reads about delivery impact, keeping any number of days the engineer stated>"}',
      '{"kind":"activity","label":"Mark \\"<exact activity name>\\" as delayed|completed","detail":"<one line>","name":"<the item\'s EXACT name copied from the lookahead>","week":<0|1|2>,"item":<index>,"s":"done|ready|blocked","note":"<days + reason, e.g. Delayed 5 days — supplier failure>","moveTo":<0|1|2, ONLY if the work shifts to a different week>}',
      '{"kind":"decision","label":"Log a decision needed: <short>","detail":"<one line>","body":"<exactly what the owner/client must decide or approve>","task":"<related activity name, or empty>"}',
      '{"kind":"note","label":"...","detail":"..."} (informational only, nothing published)',
      "RULES:",
      "1. ANY delay, failure, shortage or problem reported => ALWAYS include a risk action, even when no lookahead activity matches.",
      "2. Include an activity action ONLY when the report clearly refers to one of the provided lookahead items (match by meaning; copy the item's exact name into \"name\" and \"label\", plus its indices). s=blocked means delayed. Never force a weak match.",
      "2b. When the engineer says the work is pushed/moved to another week ('pushed to next week'), set moveTo to that week's index (weeks are 0=this week, 1=next week, 2=week after) and keep s=blocked with the note explaining why. Omit moveTo when the item stays in its week. Say the move in the label, e.g. 'Move \"<name>\" to next week — delayed'.",
      "3. If the report states or implies impact on project delivery (e.g. 'will delay delivery by 5 days') => ALWAYS include an outlook action: state=atrisk if delivery moves, watch if float may absorb it; repeat the engineer's number of days plainly.",
      "4. Good news works the same: completed work => activity s=done; if it recovers the programme, an outlook update.",
      "4b. If the report says the site is waiting on the owner/client to choose or approve something (a selection, a variation, a sample sign-off, a payment) => include a decision action so it lands in the decision log.",
      "5. Never invent activities, dates or figures not in the report or the provided data. Never move milestone dates.",
      "6. Return {\"actions\":[]} only when the report is not about the site at all.",
    ].join("\n");

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `TODAY: ${today}\nLOOKAHEAD: ${JSON.stringify(look.data?.weeks ?? [])}\nRISKS: ${JSON.stringify(risks.data ?? [])}\nMILESTONES: ${JSON.stringify(project.data?.milestones ?? [])}\nDELIVERY: ${project.data?.delivery}\nOUTLOOK: ${JSON.stringify(project.data?.outlook ?? null)}\nLOG (newest first, timestamps are real):\n${logLines}\n\nMESSAGE: ${report}`,
          },
        ],
      }),
    });
    const out = await res.json();
    if (out.error) throw new Error(out.error.message ?? "Groq error");
    const raw = out.choices?.[0]?.message?.content ?? "{}";
    let parsed: { actions?: unknown[]; answer?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/); // salvage JSON if the model wrapped it in prose
      try {
        parsed = m ? JSON.parse(m[0]) : {};
      } catch {
        parsed = {};
      }
    }

    return new Response(JSON.stringify({ actions: parsed.actions ?? [], answer: parsed.answer }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
