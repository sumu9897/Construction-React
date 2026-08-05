// "Ask PMCC" — the owner chatbot, live version.
// Paste into Supabase: Edge Functions → Deploy new function → name: ask
// Secrets required: GROQ_API_KEY (Edge Functions → Manage secrets)
//
// The contract this function keeps, verbatim from the demo: answer ONLY from
// the caller's own shared record (diary, plan, milestones, their payments,
// risks, their contract clauses). Anything outside it becomes a question for
// the team, never a guess. The record is fetched with the CALLER's identity,
// so row-level security decides what the model is even allowed to see.

import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
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

    const { question } = await req.json();
    if (!question?.trim()) return new Response("bad request", { status: 400, headers: cors });

    // Everything below runs under the owner's own RLS — the model can only
    // ever see what this owner is entitled to see.
    const [unit, project, diaryQ, look, risksQ, paymentsQ, contractQ, selQ, varQ] = await Promise.all([
      supabase.from("units").select("*").limit(1).single(),
      supabase.from("projects").select("*").limit(1).single(),
      supabase.from("diary").select("entry_date, phase, body").order("entry_date", { ascending: false }).limit(10),
      supabase.from("lookahead").select("weeks, updated_at").limit(1).maybeSingle(),
      supabase.from("risks").select("title, body, status, shared_on"),
      supabase.from("payments").select("name, milestone, amount, state, paid_on").order("ord"),
      supabase.from("contract_index").select("clauses").maybeSingle(),
      supabase.from("selections").select("title, state, chosen_name, due, decided_on"),
      supabase.from("variations").select("title, price, state, approved_on"),
    ]);

    const record = {
      unit: unit.data,
      project: project.data, // includes the delivery outlook the team publishes
      diary: diaryQ.data,
      lookahead: look.data,
      risks: risksQ.data,
      payments: paymentsQ.data,
      selections: selQ.data,
      variations: varQ.data,
      contract: contractQ.data?.clauses ?? null,
    };

    const system = [
      "You are Ask PMCC, the private assistant inside PMCC's owner portal.",
      "Answer ONLY from the JSON project record provided. Quote contract clauses with the preface 'From your contract:'.",
      "Never invent dates, amounts, measurements or commitments. Never speculate.",
      "If the answer is not in the record, reply exactly: ESCALATE",
      "Tone: calm, precise, warm — a trusted builder speaking to a client. 2-4 sentences.",
    ].join("\n");

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `RECORD:\n${JSON.stringify(record)}\n\nQUESTION: ${question}` },
        ],
      }),
    });
    const out = await res.json();
    let answer: string = out.choices?.[0]?.message?.content?.trim() ?? "ESCALATE";

    let escalated = false;
    if (answer.includes("ESCALATE")) {
      escalated = true;
      answer =
        "That one isn't in the shared record, so I won't guess — I've passed it to the team as a question. You'll find their answer under More → Questions.";
      if (unit.data) {
        await supabase.from("questions").insert({ unit_id: unit.data.id, q: question.trim() });
      }
    }

    return new Response(JSON.stringify({ answer, escalated }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
