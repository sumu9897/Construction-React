// index-contract — team pastes the contract text; Groq extracts the clauses
// owners ask about PLUS the payment schedule, exactly as the contract states
// it. Clauses feed the chatbot; the schedule replaces the unit's payments
// rows (view-only, illustrative — no payment links, no invented figures).
// Deploy as: index-contract. Requires secret GROQ_API_KEY.

import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
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

    const { unit_id, text } = await req.json();
    if (!unit_id || !text || text.trim().length < 200)
      return new Response("bad request", { status: 400, headers: cors });

    const system = [
      "You extract clauses and the payment schedule from a real-estate sale contract for a client-facing assistant.",
      'Return ONLY JSON: {"signedOn":"...","parties":"...","unitClause":"...","paymentClause":"...","deliveryClause":"...","variationClause":"...","warrantyClause":"...","price":<number or null>,"payments":[{"name":"...","milestone":"...","amount":<number>}]}',
      "Each clause value: 1-3 sentences, faithful to the contract text, plain language, keep exact figures and dates.",
      'If a clause is genuinely absent from the text, use "Not specified in the contract." — never invent terms.',
      '"price": the total contract price as a plain number, no currency symbols or separators; null if the contract does not state one.',
      '"payments": every installment of the payment schedule, in the contract\'s order. "name" is the installment\'s label (e.g. "On signature", "2nd installment"); "milestone" is the event or date it is tied to, verbatim; "amount" is a plain number. If an amount is stated as a percentage of the price, convert it only when the price is stated too — otherwise skip that installment.',
      'If the contract has no payment schedule, return "payments": []. NEVER invent an installment, an amount, or a date — these figures appear on the client\'s Money screen.',
    ].join("\n");

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `CONTRACT TEXT:\n${text.slice(0, 24000)}` },
        ],
      }),
    });
    const out = await res.json();
    const parsed = JSON.parse(out.choices?.[0]?.message?.content ?? "{}");
    const { payments, price, ...clauses } = parsed;

    // The schedule replaces what was there — the contract is the truth.
    const rows = (Array.isArray(payments) ? payments : []).filter(
      (p: { name?: string; amount?: number }) => p && p.name && Number(p.amount) > 0,
    );
    if (rows.length) {
      const { error: dErr } = await supabase.from("payments").delete().eq("unit_id", unit_id);
      if (dErr) throw dErr;
      const { error: iErr } = await supabase.from("payments").insert(
        rows.map((p: { name: string; milestone?: string; amount: number }, i: number) => ({
          unit_id,
          name: String(p.name),
          milestone: String(p.milestone ?? ""),
          amount: Number(p.amount),
          state: "upcoming",
          ord: i + 1,
        })),
      );
      if (iErr) throw iErr;
    }
    if (Number(price) > 0) {
      await supabase.from("units").update({ price: Number(price) }).eq("id", unit_id);
    }

    const { error } = await supabase.from("contract_index").upsert({ unit_id, clauses });
    if (error) throw error;

    return new Response(JSON.stringify({ clauses, paymentsCount: rows.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
