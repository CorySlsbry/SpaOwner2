import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db, now } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The learning loop's human gate: a quarantined lesson becomes `active`
 * (injected into agent prompts on every future run) or `rejected`. Only
 * the owner's click flips this — never the model.
 */
const Body = z.object({
  id: z.string().min(1).max(100),
  decision: z.enum(["active", "rejected"]),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const ref = db().collection("lessons").doc(parsed.data.id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (snap.data()?.status !== "quarantined") {
    return NextResponse.json({ error: "already_resolved" }, { status: 409 });
  }
  await ref.update({ status: parsed.data.decision, resolvedAt: now() });
  return NextResponse.json({ ok: true });
}
