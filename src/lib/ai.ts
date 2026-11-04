import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import type { AgentId, Lesson } from "@/lib/types";

/* ============================================================================
   AI core. Three hard rules (brain-derived):
   1. The model NARRATES facts computed in code — it never originates numbers
      or actions outside the closed candidate set it is handed.
   2. No silent fallbacks: offline/errors are returned as state and logged
      loudly; the UI shows an honest "AI offline" — never fake output.
   3. LLM JSON is parsed leniently (fences, trailing commas, outer-object
      extraction) — never raw JSON.parse on resp text.
   ============================================================================ */

const MODEL = "claude-opus-4-7";

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!client) client = new Anthropic({ apiKey: key });
  return client;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Active lessons for an agent — the learning loop's output, prompt-injected. */
export async function activeLessons(scope: AgentId): Promise<Array<Lesson & { id: string }>> {
  const snap = await db()
    .collection("lessons")
    .where("status", "==", "active")
    .get()
    .catch(() => null);
  const all = (snap?.docs ?? []).map((d) => ({ id: d.id, ...(d.data() as Lesson) }));
  return all.filter((l) => l.scope === scope || l.scope === "all");
}

/** Strip fences + trailing commas, extract the outermost object. */
export function extractJson(text: string): unknown | null {
  let t = text.trim();
  t = t.replace(/```(?:json)?/gi, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  t = t.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export type AiJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; offline: boolean; error: string };

/**
 * One JSON-mode call. System prompt is cached (identical across a run's
 * calls); retries once on transient overload.
 */
export async function aiJson(args: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<AiJsonResult> {
  const c = anthropic();
  if (!c) {
    console.warn("[ai] ANTHROPIC_API_KEY absent — honest offline mode");
    return { ok: false, offline: true, error: "ai_offline" };
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const resp = await c.messages.create({
        model: MODEL,
        max_tokens: args.maxTokens ?? 1200,
        system: [
          {
            type: "text",
            text: args.system,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: args.prompt }],
      });
      let text = "";
      for (const block of resp.content) {
        if (block.type === "text") text += block.text;
      }
      const data = extractJson(text);
      if (data === null) {
        console.error("[ai] unparseable JSON reply:", text.slice(0, 200));
        return { ok: false, offline: false, error: "unparseable_reply" };
      }
      return { ok: true, data };
    } catch (err) {
      const msg = (err as Error).message;
      const transient = /overloaded|529|503|429/i.test(msg);
      console.error(`[ai] call failed (attempt ${attempt}): ${msg}`);
      if (!transient || attempt === 2) {
        return { ok: false, offline: false, error: msg };
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return { ok: false, offline: false, error: "unreachable" };
}
