import { db, now } from "@/lib/db";
import type { RecAction, Recommendation } from "@/lib/types";

/* ============================================================================
   Bounded mutations — the ONLY writes an approved agent action can perform.
   Each action touches exactly one known doc with a fixed field set. Shared
   by the recommendation-approve route (owner gate) and the manager's
   inline quick actions. No code/pricing/permission paths exist here.
   ============================================================================ */

export async function applyBoundedAction(args: {
  action: RecAction;
  appointmentId: string | null;
  inventoryItemId: string | null;
}): Promise<{ ok: boolean; applied: string }> {
  const { action, appointmentId, inventoryItemId } = args;

  if (action === "require_deposit" && appointmentId) {
    await db().collection("appointments").doc(appointmentId).update({
      depositRequired: true,
    });
    return { ok: true, applied: "Deposit now required on the booking." };
  }
  if (action === "send_confirmation" && appointmentId) {
    await db().collection("appointments").doc(appointmentId).update({
      status: "confirmed",
      confirmationSentAt: now(),
    });
    return { ok: true, applied: "Confirmation sent; booking marked confirmed." };
  }
  if (action === "offer_waitlist" && appointmentId) {
    await db().collection("appointments").doc(appointmentId).update({
      waitlistOffered: true,
    });
    return { ok: true, applied: "Slot offered to the waitlist as backfill." };
  }
  if (action === "reorder_stock" && inventoryItemId) {
    await db().collection("inventory").doc(inventoryItemId).update({
      onOrder: true,
      reorderDraftedAt: now(),
    });
    return { ok: true, applied: "Reorder drafted with the vendor." };
  }
  if (action === "flag_payroll" || action === "review_pricing") {
    // Review-only actions: approving acknowledges; nothing mutates.
    return { ok: true, applied: "Flag acknowledged." };
  }
  return { ok: false, applied: "Nothing to apply — target missing." };
}

export async function resolveRecommendation(args: {
  id: string;
  decision: "approved" | "dismissed";
}): Promise<{ ok: boolean; applied: string | null; error?: string }> {
  const ref = db().collection("recommendations").doc(args.id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, applied: null, error: "not_found" };
  const rec = snap.data() as Recommendation;
  if (rec.status !== "pending") {
    return { ok: false, applied: null, error: "already_resolved" };
  }

  let applied: string | null = null;
  if (args.decision === "approved") {
    const result = await applyBoundedAction({
      action: rec.action,
      appointmentId: rec.appointmentId,
      inventoryItemId: rec.inventoryItemId,
    });
    applied = result.applied;
  }
  await ref.update({ status: args.decision, resolvedAt: now() });
  return { ok: true, applied };
}
