import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Customer } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Your clients are yours" — full client book as CSV, always on, no gate.
 * The anti-hostage answer to platforms that lock export behind support
 * tickets and retention calls.
 */
function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(): Promise<NextResponse> {
  const snap = await db().collection("customers").orderBy("name").get();
  const rows = [
    [
      "name",
      "email",
      "phone",
      "visits",
      "no_shows",
      "late_cancels",
      "avg_ticket",
      "first_visit",
      "last_visit",
      "notes",
    ].join(","),
  ];
  for (const d of snap.docs) {
    const c = d.data() as Customer;
    rows.push(
      [
        c.name,
        c.email,
        c.phone,
        String(c.visits),
        String(c.noShows),
        String(c.lateCancels),
        String(c.avgTicket),
        c.firstVisitAt?.toDate?.()?.toISOString().slice(0, 10) ?? "",
        c.lastVisitAt?.toDate?.()?.toISOString().slice(0, 10) ?? "",
        c.notes ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="client-book-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
