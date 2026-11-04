import { db, now } from "@/lib/db";
import { activeLessons, aiConfigured, aiJson } from "@/lib/ai";
import { loadWorld, lowStock, type WorldSnapshot } from "@/lib/facts";
import type { AgentId, RecAction, Recommendation } from "@/lib/types";

/* ============================================================================
   The two agents.

   Pipeline (identical for both):
     1. facts        — loadWorld() computes every number deterministically.
     2. candidates   — code derives the FULL set of possible actions (closed
                       enum, each bound to a real doc id). The model cannot
                       add to this set.
     3. narration    — Claude (with active lessons injected) picks which
                       candidates matter, writes the one-line "why", and a
                       two-sentence run summary. AI offline → all candidates
                       ship with their deterministic copy, summary says so.
     4. human gate   — candidates land in `recommendations` (pending). The
                       approve handler applies one bounded mutation per action.
   ============================================================================ */

export type Candidate = {
  action: RecAction;
  title: string;
  detail: string; // deterministic copy; AI may sharpen, never invent
  appointmentId: string | null;
  inventoryItemId: string | null;
  staffId: string | null;
  severity: "high" | "medium" | "low";
};

function fohCandidates(world: WorldSnapshot): Candidate[] {
  const out: Candidate[] = [];
  for (const a of world.today) {
    if (a.status === "completed" || a.status === "cancelled" || a.status === "no_show")
      continue;
    const why = a.reasons.join(" · ");
    if (a.band === "high" && !a.depositPaid && !a.depositRequired) {
      out.push({
        action: "require_deposit",
        title: `Require a deposit — ${a.customerName}, ${fmtTime(a)}`,
        detail: `${a.service} ($${a.price}). Risk ${a.risk}/100: ${why}.`,
        appointmentId: a.id,
        inventoryItemId: null,
        staffId: null,
        severity: "high",
      });
    }
    if (
      (a.band === "high" || a.band === "medium") &&
      a.status === "booked" &&
      !a.confirmationSentAt
    ) {
      out.push({
        action: "send_confirmation",
        title: `Send confirmation — ${a.customerName}, ${fmtTime(a)}`,
        detail: `${a.service} with ${a.staffName}. Risk ${a.risk}/100: ${why}.`,
        appointmentId: a.id,
        inventoryItemId: null,
        staffId: null,
        severity: a.band === "high" ? "high" : "medium",
      });
    }
    if (a.band === "high" && !a.waitlistOffered) {
      out.push({
        action: "offer_waitlist",
        title: `Line up a backfill — ${fmtTime(a)} ${a.staffName}`,
        detail: `If ${a.customerName} falls through (risk ${a.risk}/100), offer the slot to the waitlist so the chair doesn't sit empty.`,
        appointmentId: a.id,
        inventoryItemId: null,
        staffId: null,
        severity: "medium",
      });
    }
  }
  return out;
}

function bohCandidates(world: WorldSnapshot): Candidate[] {
  const out: Candidate[] = [];
  for (const item of lowStock(world.inventory)) {
    out.push({
      action: "reorder_stock",
      title: `Reorder ${item.name}`,
      detail: `${item.onHand} on hand vs par ${item.parLevel}. ${item.vendor}, ~$${item.unitCost}/unit.`,
      appointmentId: null,
      inventoryItemId: item.id,
      staffId: null,
      severity: item.onHand === 0 ? "high" : "medium",
    });
  }
  for (const sd of world.staffDays) {
    if (sd.overbooked) {
      out.push({
        action: "flag_payroll",
        title: `Overtime risk — ${sd.staff.name}`,
        detail: `${(sd.bookedMins / 60).toFixed(1)}h booked today ($${sd.bookedRevenue} revenue). Check break coverage and OT.`,
        appointmentId: null,
        inventoryItemId: null,
        staffId: sd.staff.id,
        severity: "medium",
      });
    }
  }
  return out;
}

const AGENT_PERSONA: Record<AgentId, string> = {
  foh: `You are the front-of-house agent for an independent spa/salon. You work the appointment book: no-show risk, confirmations, deposits, waitlist backfill.`,
  boh: `You are the back-of-house agent for an independent spa/salon. You work the business behind the chairs: stock, payroll sanity, margins, end-of-day.`,
};

type NarrationReply = {
  summary: string;
  keep: number[]; // indices of candidates worth surfacing
  sharpened: Record<string, string>; // index -> improved one-line detail
};

function parseNarration(data: unknown, candidateCount: number): NarrationReply | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  const summary = typeof d.summary === "string" ? d.summary.trim().slice(0, 400) : "";
  if (!summary) return null;
  const keep = Array.isArray(d.keep)
    ? d.keep
        .filter((n): n is number => typeof n === "number")
        .filter((n) => n >= 0 && n < candidateCount)
    : [];
  const sharpened: Record<string, string> = {};
  if (typeof d.sharpened === "object" && d.sharpened !== null) {
    for (const [k, v] of Object.entries(d.sharpened as Record<string, unknown>)) {
      const idx = Number(k);
      if (Number.isInteger(idx) && idx >= 0 && idx < candidateCount && typeof v === "string") {
        sharpened[k] = v.trim().slice(0, 280);
      }
    }
  }
  return { summary, keep, sharpened };
}

export type AgentRunResult = {
  agent: AgentId;
  summary: string;
  recCount: number;
  aiOffline: boolean;
  lessonsApplied: number;
};

export async function runAgent(agent: AgentId): Promise<AgentRunResult> {
  const startedAt = now();
  const world = await loadWorld();
  const candidates = agent === "foh" ? fohCandidates(world) : bohCandidates(world);
  const lessons = await activeLessons(agent);

  // Skip candidates that already have an identical pending recommendation.
  // Single-field filter (auto-indexed) + in-memory narrowing — no composite
  // index needed, and no silent empty-on-missing-index.
  const pendingSnap = await db()
    .collection("recommendations")
    .where("agent", "==", agent)
    .get()
    .catch(() => null);
  const pendingKeys = new Set(
    (pendingSnap?.docs ?? [])
      .map((d) => d.data() as Recommendation)
      .filter((r) => r.status === "pending")
      .map(
        (r) =>
          `${r.action}:${r.appointmentId ?? r.inventoryItemId ?? r.staffId ?? ""}`,
      ),
  );
  const fresh = candidates.filter(
    (c) =>
      !pendingKeys.has(
        `${c.action}:${c.appointmentId ?? c.inventoryItemId ?? c.staffId ?? ""}`,
      ),
  );

  let summary: string;
  let toWrite = fresh;
  let aiOffline = !aiConfigured();

  if (!aiOffline && (fresh.length > 0 || true)) {
    const factsDigest = buildFactsDigest(agent, world, fresh);
    const lessonBlock =
      lessons.length > 0
        ? `\n\nLEARNED RULES (approved by the owner — apply them):\n${lessons
            .map((l) => `- ${l.text}`)
            .join("\n")}`
        : "";
    const system = `${AGENT_PERSONA[agent]}
You receive FACTS computed by tested code and a numbered CANDIDATE list of possible actions. You may only select from the candidates — never invent actions, names, or numbers.${lessonBlock}

Reply with ONLY a JSON object:
{"summary":"<1-2 sentences, sharp colleague voice, grounded ONLY in the facts>","keep":[<candidate indices worth the owner's attention>],"sharpened":{"<index>":"<tighter one-line detail, same facts>"}}`;

    const result = await aiJson({ system, prompt: factsDigest });
    if (result.ok) {
      const parsed = parseNarration(result.data, fresh.length);
      if (parsed) {
        summary = parsed.summary;
        toWrite = parsed.keep.length > 0 ? parsed.keep.map((i) => fresh[i]) : fresh;
        for (const [k, v] of Object.entries(parsed.sharpened)) {
          const c = fresh[Number(k)];
          if (c && toWrite.includes(c)) c.detail = v;
        }
      } else {
        console.error("[agents] narration parse failed — deterministic copy ships");
        summary = deterministicSummary(agent, world, fresh);
      }
    } else {
      aiOffline = result.offline;
      summary = `${deterministicSummary(agent, world, fresh)}${
        result.offline ? "" : " (AI narration unavailable this run.)"
      }`;
    }
  } else {
    summary = deterministicSummary(agent, world, fresh);
  }

  const batch = db().batch();
  for (const c of toWrite) {
    const ref = db().collection("recommendations").doc();
    const rec: Recommendation = {
      agent,
      action: c.action,
      title: c.title,
      detail: c.detail,
      appointmentId: c.appointmentId,
      inventoryItemId: c.inventoryItemId,
      staffId: c.staffId,
      severity: c.severity,
      status: "pending",
      createdAt: now(),
      resolvedAt: null,
    };
    batch.set(ref, rec);
  }
  const runRef = db().collection("agent_runs").doc();
  batch.set(runRef, {
    agent,
    startedAt,
    finishedAt: now(),
    summary,
    recCount: toWrite.length,
    aiOffline,
    lessonsApplied: lessons.length,
  });
  await batch.commit();

  return { agent, summary, recCount: toWrite.length, aiOffline, lessonsApplied: lessons.length };
}

function buildFactsDigest(
  agent: AgentId,
  world: WorldSnapshot,
  candidates: Candidate[],
): string {
  const lines: string[] = [];
  if (agent === "foh") {
    lines.push(
      `Today: ${world.today.length} appointments, $${world.todayRevenueBooked} booked, $${world.todayRevenueCompleted} completed so far. Tomorrow: ${world.tomorrowCount} booked.`,
    );
    const high = world.today.filter((a) => a.band === "high");
    lines.push(`High no-show risk: ${high.length}.`);
  } else {
    lines.push(
      `Staff on today: ${world.staffDays.filter((s) => s.staff.onShift).length}/${world.staff.length}. Completed revenue $${world.todayRevenueCompleted}; commissions accrued $${world.staffDays.reduce((s, d) => s + d.commission, 0).toFixed(2)}.`,
    );
    lines.push(
      `Low stock items: ${lowStock(world.inventory).length}. Fees a per-feature platform would have charged today: $${world.feeAudit.totalToday}.`,
    );
  }
  lines.push(`\nCANDIDATES:`);
  candidates.forEach((c, i) => {
    lines.push(`${i}. [${c.action}] ${c.title} — ${c.detail}`);
  });
  if (candidates.length === 0) lines.push("(none — quiet day)");
  return lines.join("\n");
}

function deterministicSummary(
  agent: AgentId,
  world: WorldSnapshot,
  fresh: Candidate[],
): string {
  if (agent === "foh") {
    const high = world.today.filter((a) => a.band === "high").length;
    return `${world.today.length} appointments today, ${high} high no-show risk. ${fresh.length} action${fresh.length === 1 ? "" : "s"} queued for review.`;
  }
  const low = lowStock(world.inventory).length;
  return `$${world.todayRevenueCompleted} completed today. ${low} item${low === 1 ? "" : "s"} at or below par. ${fresh.length} action${fresh.length === 1 ? "" : "s"} queued for review.`;
}

function fmtTime(a: { startsAt: { toDate(): Date } }): string {
  return a.startsAt
    .toDate()
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
