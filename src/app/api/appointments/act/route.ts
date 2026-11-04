import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { applyBoundedAction } from "@/lib/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manager quick actions — same bounded mutations, applied directly. */
const Body = z.object({
  appointmentId: z.string().min(1).max(100),
  action: z.enum(["require_deposit", "send_confirmation", "offer_waitlist"]),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const result = await applyBoundedAction({
    action: parsed.data.action,
    appointmentId: parsed.data.appointmentId,
    inventoryItemId: null,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
