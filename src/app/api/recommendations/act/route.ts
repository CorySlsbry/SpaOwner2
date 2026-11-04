import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveRecommendation } from "@/lib/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  id: z.string().min(1).max(100),
  decision: z.enum(["approved", "dismissed"]),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const result = await resolveRecommendation(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, applied: result.applied });
}
