import { db, Timestamp } from "@/lib/db";
import type {
  Appointment,
  Customer,
  InventoryItem,
  Metrics,
  Staff,
} from "@/lib/types";

/* ============================================================================
   Deterministic facts layer — the firewall.

   Every number the product shows (risk scores, money, stock, fee audit)
   is computed HERE, in tested code, from Firestore state. The AI layer
   (lib/ai.ts) receives these facts read-only and narrates/prioritizes;
   it can never originate a figure. (Brain rule: learning + language live
   on the narration side; reward-hacking the numbers is impossible by
   construction.)
   ============================================================================ */

export type Doc<T> = T & { id: string };

export type RiskBand = "high" | "medium" | "low";

export type ScoredAppointment = Doc<Appointment> & {
  risk: number; // 0..100
  band: RiskBand;
  reasons: string[];
};

/** Local-day window [start, end) for "today + N days". */
export function dayWindow(offsetDays = 0): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * No-show risk — transparent, rule-based, explainable. Each factor carries
 * its plain-English reason so the UI and the agent can show WHY.
 */
export function scoreRisk(
  appt: Doc<Appointment>,
  customer: Doc<Customer> | undefined,
): { risk: number; band: RiskBand; reasons: string[] } {
  let risk = 0;
  const reasons: string[] = [];

  const visits = customer?.visits ?? 0;
  const noShows = customer?.noShows ?? 0;
  const lateCancels = customer?.lateCancels ?? 0;

  if (visits === 0) {
    risk += 22;
    reasons.push("first visit");
  } else if (noShows + lateCancels > 0) {
    const ratio = (noShows + 0.5 * lateCancels) / Math.max(visits, 1);
    const pts = Math.min(45, Math.round(ratio * 90));
    if (pts > 0) {
      risk += pts;
      reasons.push(
        `${noShows} no-show${noShows === 1 ? "" : "s"}${lateCancels ? ` + ${lateCancels} late cancel${lateCancels === 1 ? "" : "s"}` : ""} in ${visits} visits`,
      );
    }
  }

  const leadDays =
    (appt.startsAt.toMillis() - appt.createdAt.toMillis()) / 86_400_000;
  if (leadDays >= 14) {
    risk += 12;
    reasons.push(`booked ${Math.round(leadDays)} days out`);
  }

  if (appt.price >= 120) {
    risk += 10;
    reasons.push(`high-value ($${appt.price})`);
  }

  if (!appt.depositPaid && !appt.depositRequired) {
    risk += 14;
    reasons.push("no deposit on file");
  }

  if (appt.status === "confirmed" || appt.confirmationSentAt) {
    risk -= 25;
    reasons.push("confirmed");
  }

  risk = Math.max(0, Math.min(100, risk));
  const band: RiskBand = risk >= 55 ? "high" : risk >= 30 ? "medium" : "low";
  return { risk, band, reasons };
}

export type FeeAudit = {
  /** What today's activity would have cost on per-feature competitors. */
  marketplaceNewClientFees: number; // 20% of new-client revenue
  perTextFees: number; // confirmations/reminders billed per-SMS
  addOnDailyShare: number; // forms+marketing+website add-ons, daily share
  perCalendarDailyShare: number; // per-staff calendar pricing, daily share
  totalToday: number;
};

/** Competitor-model fee audit. Inputs are today's real activity. */
export function computeFeeAudit(args: {
  todaysAppointments: Doc<Appointment>[];
  customersById: Map<string, Doc<Customer>>;
  staffCount: number;
}): FeeAudit {
  const { todaysAppointments, customersById, staffCount } = args;

  const newClientRevenue = todaysAppointments
    .filter((a) => {
      const c = customersById.get(a.customerId);
      return (c?.visits ?? 0) === 0 && a.status !== "cancelled";
    })
    .reduce((sum, a) => sum + a.price, 0);
  const marketplaceNewClientFees = round2(newClientRevenue * 0.2);

  const messagesSent = todaysAppointments.filter(
    (a) => a.confirmationSentAt !== null,
  ).length;
  const perTextFees = round2(messagesSent * 2 * 0.035); // confirm + reminder

  const addOnDailyShare = round2((10 + 20 + 25) / 30); // forms+marketing+site, $/day
  const perCalendarDailyShare = round2(
    (30 + Math.max(0, staffCount - 1) * 10) / 30,
  );

  return {
    marketplaceNewClientFees,
    perTextFees,
    addOnDailyShare,
    perCalendarDailyShare,
    totalToday: round2(
      marketplaceNewClientFees +
        perTextFees +
        addOnDailyShare +
        perCalendarDailyShare,
    ),
  };
}

export type StaffDay = {
  staff: Doc<Staff>;
  bookedMins: number;
  bookedRevenue: number;
  completedRevenue: number;
  commission: number;
  overbooked: boolean; // > 8h booked
};

export function computeStaffDays(
  staff: Doc<Staff>[],
  todaysAppointments: Doc<Appointment>[],
): StaffDay[] {
  return staff.map((s) => {
    const mine = todaysAppointments.filter(
      (a) => a.staffId === s.id && a.status !== "cancelled",
    );
    const bookedMins = mine.reduce((sum, a) => sum + a.mins, 0);
    const bookedRevenue = mine.reduce((sum, a) => sum + a.price, 0);
    const completedRevenue = mine
      .filter((a) => a.status === "completed")
      .reduce((sum, a) => sum + a.price, 0);
    return {
      staff: s,
      bookedMins,
      bookedRevenue: round2(bookedRevenue),
      completedRevenue: round2(completedRevenue),
      commission: round2(completedRevenue * s.commissionRate),
      overbooked: bookedMins > 8 * 60,
    };
  });
}

export function lowStock(items: Doc<InventoryItem>[]): Doc<InventoryItem>[] {
  return items.filter((i) => i.onHand <= i.parLevel && !i.onOrder);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ---------------------------------------------------------------------------
   Loaders — one snapshot of the world, shared by pages and agents.
   --------------------------------------------------------------------------- */

export type WorldSnapshot = {
  customers: Doc<Customer>[];
  customersById: Map<string, Doc<Customer>>;
  staff: Doc<Staff>[];
  today: ScoredAppointment[];
  tomorrowCount: number;
  inventory: Doc<InventoryItem>[];
  metrics: Metrics | null;
  todayRevenueBooked: number;
  todayRevenueCompleted: number;
  feeAudit: FeeAudit;
  staffDays: StaffDay[];
};

export async function loadWorld(): Promise<WorldSnapshot> {
  const { start, end } = dayWindow(0);
  const { start: tStart, end: tEnd } = dayWindow(1);

  const [custSnap, staffSnap, apptSnap, tmrwSnap, invSnap, metricsSnap] =
    await Promise.all([
      db().collection("customers").get(),
      db().collection("staff").get(),
      db()
        .collection("appointments")
        .where("startsAt", ">=", Timestamp.fromDate(start))
        .where("startsAt", "<", Timestamp.fromDate(end))
        .get(),
      db()
        .collection("appointments")
        .where("startsAt", ">=", Timestamp.fromDate(tStart))
        .where("startsAt", "<", Timestamp.fromDate(tEnd))
        .get(),
      db().collection("inventory").get(),
      db().collection("metrics").doc("global").get(),
    ]);

  const customers = custSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Customer) }),
  );
  const customersById = new Map(customers.map((c) => [c.id, c]));
  const staff = staffSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Staff) }),
  );

  const today: ScoredAppointment[] = apptSnap.docs
    .map((d) => {
      const a = { id: d.id, ...(d.data() as Appointment) };
      return { ...a, ...scoreRisk(a, customersById.get(a.customerId)) };
    })
    .sort((a, b) => a.startsAt.toMillis() - b.startsAt.toMillis());

  const inventory = invSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as InventoryItem) }),
  );

  const active = today.filter((a) => a.status !== "cancelled");
  const todayRevenueBooked = active.reduce((s, a) => s + a.price, 0);
  const todayRevenueCompleted = active
    .filter((a) => a.status === "completed")
    .reduce((s, a) => s + a.price, 0);

  return {
    customers,
    customersById,
    staff,
    today,
    tomorrowCount: tmrwSnap.size,
    inventory,
    metrics: metricsSnap.exists ? (metricsSnap.data() as Metrics) : null,
    todayRevenueBooked: Math.round(todayRevenueBooked),
    todayRevenueCompleted: Math.round(todayRevenueCompleted),
    feeAudit: computeFeeAudit({
      todaysAppointments: today,
      customersById,
      staffCount: staff.length,
    }),
    staffDays: computeStaffDays(staff, today),
  };
}
