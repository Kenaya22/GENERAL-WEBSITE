// Ask Tara — AI answers for questions the built-in helper can't handle.
// Supabase Edge Function (Deno). The Claude API key stays here as a secret:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy ask-tara --no-verify-jwt
// Then put the function URL in js/config.js → backend.askUrl.
import Anthropic from "npm:@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

const SYSTEM = `You are Tara, the friendly travel helper inside the Tara app — a travel guide for commuters and travelers in the Philippines (Metro Manila, Calabarzon and nearby provinces).
Answer in the language the user writes in (English, Tagalog or Taglish). Keep answers short: 2–6 sentences or a few bullet points, plain text, no headings.
Be practical: what to ride, where to go, what to bring, what it costs, when to go. Fares, hours and fees change — give ranges and say they are estimates; when the app's guide data is provided, prefer it.
For exact routes, step-by-step commute plans and budgets, tell the user to tap "Plan a trip" in the app.
If you don't know something, say so instead of guessing. For emergencies, tell them to call 911.
Only help with travel, places, food, transport, culture and using the Tara app; politely decline anything else.`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// best-effort limit per visitor (resets when the function instance restarts)
const hits = new Map<string, { n: number; at: number }>();
function limited(ip: string) {
  const now = Date.now(), h = hits.get(ip);
  if (!h || now - h.at > 3_600_000) { hits.set(ip, { n: 1, at: now }); return false; }
  h.n++;
  return h.n > 30; // 30 questions per hour per visitor
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (limited(ip)) return json({ error: "Too many questions — try again in a while." }, 429);

  let input: { question?: string; context?: string; history?: { who: string; text: string }[] };
  try { input = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const question = String(input.question || "").trim().slice(0, 400);
  if (!question) return json({ error: "Ask a question" }, 400);
  const context = String(input.context || "").slice(0, 3000);

  // last few turns of the chat, oldest first, alternating user/assistant
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of (input.history || []).slice(-6)) {
    const role = m.who === "me" ? "user" : "assistant";
    const text = String(m.text || "").slice(0, 800);
    if (!text) continue;
    if (messages.length && messages[messages.length - 1].role === role) continue;
    if (!messages.length && role === "assistant") continue;
    messages.push({ role, content: text });
  }
  if (messages.length && messages[messages.length - 1].role === "user") messages.pop();
  messages.push({ role: "user", content: (context ? `Tara guide data that may help:\n${context}\n\n` : "") + `Question: ${question}` });

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1024, // short chat answers
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages,
    });
    if (response.stop_reason === "refusal") return json({ answer: "Sorry, I can't help with that one. Ask me about places, routes or trips!" });
    const answer = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    return json({ answer: answer || "Sorry, I don't have an answer for that yet." });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Tara is busy — try again in a minute." }, 429);
    if (err instanceof Anthropic.APIConnectionError) return json({ error: "Couldn't reach the AI service." }, 502);
    if (err instanceof Anthropic.APIError) return json({ error: "AI service error (" + err.status + ")." }, 502);
    return json({ error: "Something went wrong." }, 500);
  }
});
