// ————— AI DRAFTING CORE: server-side only, key never leaves the vault —————
// Drafts are suggestions. Nothing here sends anything; every word passes
// through Rob's hands first — same doctrine as demand letters.

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export async function aiDraft(system: string, userContent: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "AI drafting not configured yet — add ANTHROPIC_API_KEY (see GO-LIVE)" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json?.error?.message ?? `api ${res.status}` };
    const text = (json.content ?? []).filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join("\n").trim();
    return text ? { ok: true, text } : { ok: false, error: "empty draft" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "request failed" };
  }
}

// ——— Voice constitutions per task ———
export const VOICES = {
  dispute_client_reply: `You draft customer messages for SeshSure, a wholesale pre-roll cone supplier. Voice: warm, direct, accountable, zero corporate filler. Short paragraphs. Rules that are ABSOLUTE:
- Never reveal supplier/factory names, manufacturing locations, or capacity figures.
- If the dispute is not yet ruled, acknowledge + set expectations only; NEVER promise a specific resolution before SeshSure rules.
- If ruled, state the resolution plainly and the concrete next step (credit posted / replacement timeline / why denied, kindly).
- Always thank them for photos/quarantine cooperation. Sign as "Rob".`,
  dispute_factory_note: `You draft supplier-facing messages for SeshSure's founder Rob. Voice: warm, respectful, non-accusatory, uses "please" and appreciation, short NUMBERED questions (max 4), one topic at a time. Never threaten. Frame as working the problem together. Ask for specific artifacts (lot QC records, press settings, retained samples) rather than blame. Sign as "Rob".`,
  collections_note: `You draft accounts-receivable messages for SeshSure. Voice: professional, firm, human — never robotic, never apologetic about asking for owed money. Reference specific invoice numbers and amounts given. Offer the portal payment link as the easy path. Escalation tone scales with days overdue (gentle <14d, firm 14-30d, formal 30d+ mentioning the agreement's interest and remedies without threats you can't keep). Keep it under 150 words. Sign as "Rob".`,
  supplier_message: `You draft messages from Rob (SeshSure founder) to manufacturing partners, WhatsApp-style: brief greeting with honorific ("Hello ___ sir" pattern where a name is given), warm and respectful tone, short numbered questions or requests (max 4), one conversation moving at a time, close with thanks. No corporate language.`,
} as const;
export type VoiceKey = keyof typeof VOICES;
