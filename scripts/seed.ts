/**
 * Idempotent demo seed for Spa Owner 2.0 (`npm run seed`).
 *
 * Dates are RELATIVE to runtime — today's board is always alive no matter
 * when the demo runs. Deterministic doc ids: re-running overwrites in place
 * (no duplicates). Data is labeled demo in-app; it is shaped to exercise
 * every surface: high/medium no-show risk, low stock, an overtime case,
 * quarantined + active lessons, mixed feedback.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT || "spaowner",
  });
}
const db = getFirestore(process.env.FIRESTORE_DATABASE_ID || "spa-owner-2");

const T = (d: Date) => Timestamp.fromDate(d);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const todayAt = (h: number, m = 0, dayOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
};

async function main() {
  const batch = db.batch();
  const col = (name: string, id: string) => db.collection(name).doc(id);

  /* ── Customers ───────────────────────────────────────────────────────── */
  const customers = [
    { id: "marisol-vega", name: "Marisol Vega", email: "person1@example.com", phone: "(555) 010-0101", visits: 14, noShows: 0, lateCancels: 1, avgTicket: 138, first: 410, last: 18, notes: "Prefers Saturday mornings. Sensitive scalp." },
    { id: "dana-okafor", name: "Dana Okafor", email: "person2@example.com", phone: "(555) 010-0102", visits: 6, noShows: 2, lateCancels: 1, avgTicket: 95, first: 230, last: 41, notes: "Reschedules often — text, don't call." },
    { id: "priya-raman", name: "Priya Raman", email: "person3@example.com", phone: "(555) 010-0103", visits: 22, noShows: 0, lateCancels: 0, avgTicket: 162, first: 700, last: 12, notes: "VIP. Books the 90-min ritual monthly." },
    { id: "tess-whitfield", name: "Tess Whitfield", email: "person4@example.com", phone: "(555) 010-0104", visits: 0, noShows: 0, lateCancels: 0, avgTicket: 0, first: 0, last: null, notes: "Found us on Instagram." },
    { id: "jordan-mercer", name: "Jordan Mercer", email: "person5@example.com", phone: "(555) 010-0105", visits: 3, noShows: 1, lateCancels: 0, avgTicket: 210, first: 95, last: 33, notes: "Books high-value packages; travels for work." },
    { id: "amelia-stroud", name: "Amelia Stroud", email: "person6@example.com", phone: "(555) 010-0106", visits: 9, noShows: 0, lateCancels: 2, avgTicket: 88, first: 300, last: 25, notes: "" },
    { id: "noor-haddad", name: "Noor Haddad", email: "person7@example.com", phone: "(555) 010-0107", visits: 11, noShows: 0, lateCancels: 0, avgTicket: 120, first: 380, last: 9, notes: "Refers friends constantly — referral credit running." },
    { id: "calvin-reyes", name: "Calvin Reyes", email: "person8@example.com", phone: "(555) 010-0108", visits: 1, noShows: 0, lateCancels: 0, avgTicket: 75, first: 60, last: 60, notes: "" },
    { id: "harriet-boone", name: "Harriet Boone", email: "person9@example.com", phone: "(555) 010-0109", visits: 31, noShows: 1, lateCancels: 1, avgTicket: 105, first: 1100, last: 14, notes: "Longest-standing client. Cash tipper." },
    { id: "sierra-park", name: "Sierra Park", email: "person10@example.com", phone: "(555) 010-0110", visits: 0, noShows: 0, lateCancels: 0, avgTicket: 0, first: 0, last: null, notes: "Gift card from her sister." },
  ];
  for (const c of customers) {
    batch.set(col("customers", c.id), {
      name: c.name, email: c.email, phone: c.phone,
      visits: c.visits, noShows: c.noShows, lateCancels: c.lateCancels,
      avgTicket: c.avgTicket,
      firstVisitAt: T(daysAgo(c.first)),
      lastVisitAt: c.last === null ? null : T(daysAgo(c.last)),
      notes: c.notes || null,
    });
  }

  /* ── Staff ───────────────────────────────────────────────────────────── */
  const staff = [
    { id: "renata-cole", name: "Renata Cole", role: "esthetician", onShift: true, shiftStart: "09:00", shiftEnd: "17:00", commissionRate: 0.42 },
    { id: "miguel-santana", name: "Miguel Santana", role: "stylist", onShift: true, shiftStart: "09:00", shiftEnd: "18:30", commissionRate: 0.4 },
    { id: "blair-ashby", name: "Blair Ashby", role: "massage", onShift: true, shiftStart: "10:00", shiftEnd: "19:00", commissionRate: 0.45 },
    { id: "yuki-tanabe", name: "Yuki Tanabe", role: "stylist", onShift: false, shiftStart: "—", shiftEnd: "—", commissionRate: 0.4 },
    { id: "frankie-ducane", name: "Frankie Ducane", role: "front_desk", onShift: true, shiftStart: "08:30", shiftEnd: "16:30", commissionRate: 0 },
  ];
  for (const s of staff) batch.set(col("staff", s.id), s);

  /* ── Appointments — today (relative), engineered risk mix ───────────── */
  const appts = [
    // Morning: done.
    { id: "ap-01", customer: "harriet-boone", staffId: "miguel-santana", service: "Cut + gloss", h: 9, m: 0, mins: 60, price: 110, status: "completed", depositPaid: false, confirmed: true, source: "direct", createdDaysAgo: 6 },
    { id: "ap-02", customer: "noor-haddad", staffId: "renata-cole", service: "Signature facial", h: 9, m: 30, mins: 60, price: 125, status: "completed", depositPaid: true, confirmed: true, source: "direct", createdDaysAgo: 9 },
    { id: "ap-03", customer: "calvin-reyes", staffId: "blair-ashby", service: "Deep tissue 50", h: 10, m: 30, mins: 50, price: 95, status: "completed", depositPaid: false, confirmed: true, source: "google", createdDaysAgo: 3 },
    // Midday/afternoon: live book.
    { id: "ap-04", customer: "priya-raman", staffId: "renata-cole", service: "90-min ritual", h: 13, m: 0, mins: 90, price: 185, status: "confirmed", depositPaid: true, confirmed: true, source: "direct", createdDaysAgo: 21 },
    // HIGH RISK: repeat no-shower, big ticket, booked far out, unconfirmed, no deposit.
    { id: "ap-05", customer: "dana-okafor", staffId: "miguel-santana", service: "Full balayage", h: 14, m: 0, mins: 150, price: 240, status: "booked", depositPaid: false, confirmed: false, source: "instagram", createdDaysAgo: 19 },
    // MEDIUM: first visit, unconfirmed.
    { id: "ap-06", customer: "tess-whitfield", staffId: "renata-cole", service: "Brow + lash tint", h: 15, m: 30, mins: 45, price: 78, status: "booked", depositPaid: false, confirmed: false, source: "instagram", createdDaysAgo: 4 },
    // HIGH-ish: prior no-show + high value + far lead, unconfirmed.
    { id: "ap-07", customer: "jordan-mercer", staffId: "blair-ashby", service: "Couples massage 80", h: 16, m: 30, mins: 80, price: 260, status: "booked", depositPaid: false, confirmed: false, source: "direct", createdDaysAgo: 16 },
    { id: "ap-08", customer: "amelia-stroud", staffId: "miguel-santana", service: "Blowout", h: 17, m: 30, mins: 40, price: 65, status: "confirmed", depositPaid: false, confirmed: true, source: "direct", createdDaysAgo: 2 },
    // FIRST VISIT, evening, unconfirmed.
    { id: "ap-09", customer: "sierra-park", staffId: "blair-ashby", service: "Hot stone 60", h: 18, m: 0, mins: 60, price: 130, status: "booked", depositPaid: false, confirmed: false, source: "referral", createdDaysAgo: 8 },
    // Tomorrow ×3.
    { id: "ap-10", customer: "marisol-vega", staffId: "renata-cole", service: "Dermaplane facial", h: 10, m: 0, mins: 60, price: 140, status: "confirmed", depositPaid: true, confirmed: true, source: "direct", createdDaysAgo: 12, dayOffset: 1 },
    { id: "ap-11", customer: "harriet-boone", staffId: "miguel-santana", service: "Root touch-up", h: 11, m: 30, mins: 75, price: 95, status: "booked", depositPaid: false, confirmed: false, source: "direct", createdDaysAgo: 5, dayOffset: 1 },
    { id: "ap-12", customer: "noor-haddad", staffId: "blair-ashby", service: "Swedish 60", h: 14, m: 0, mins: 60, price: 105, status: "booked", depositPaid: false, confirmed: false, source: "direct", createdDaysAgo: 1, dayOffset: 1 },
  ];
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const custById = new Map(customers.map((c) => [c.id, c]));
  for (const a of appts) {
    batch.set(col("appointments", a.id), {
      customerId: a.customer,
      customerName: custById.get(a.customer)!.name,
      staffId: a.staffId,
      staffName: staffById.get(a.staffId)!.name,
      service: a.service,
      startsAt: T(todayAt(a.h, a.m, a.dayOffset ?? 0)),
      mins: a.mins,
      price: a.price,
      status: a.status,
      depositPaid: a.depositPaid,
      depositRequired: false,
      confirmationSentAt: a.confirmed ? T(daysAgo(1)) : null,
      waitlistOffered: false,
      source: a.source,
      createdAt: T(daysAgo(a.createdDaysAgo)),
    });
  }

  /* ── Inventory — two below par, one at zero ─────────────────────────── */
  const inventory = [
    { id: "inv-keratin-mask", name: "Keratin repair mask 500ml", sku: "KRM-500", onHand: 1, parLevel: 4, unitCost: 28.5, vendor: "Aveline Pro" },
    { id: "inv-rose-oil", name: "Rose massage oil 1L", sku: "RMO-1000", onHand: 0, parLevel: 3, unitCost: 19.75, vendor: "Terra Botanica" },
    { id: "inv-dev-20", name: "Developer 20-vol 1L", sku: "DEV-20", onHand: 6, parLevel: 4, unitCost: 8.4, vendor: "Aveline Pro" },
    { id: "inv-enzyme-peel", name: "Enzyme peel 250ml", sku: "ENZ-250", onHand: 5, parLevel: 2, unitCost: 41.0, vendor: "Dermique Lab" },
    { id: "inv-towels", name: "Bamboo towels (12-pack)", sku: "TWL-12B", onHand: 7, parLevel: 5, unitCost: 34.2, vendor: "Linen & Co" },
    { id: "inv-lash-tint", name: "Lash tint kit", sku: "LTK-01", onHand: 3, parLevel: 2, unitCost: 22.9, vendor: "Dermique Lab" },
    { id: "inv-gloss-clear", name: "Clear gloss 375ml", sku: "GLS-375", onHand: 4, parLevel: 3, unitCost: 16.6, vendor: "Aveline Pro" },
    { id: "inv-stone-set", name: "Basalt stone set", sku: "BST-SET", onHand: 2, parLevel: 1, unitCost: 89.0, vendor: "Terra Botanica" },
  ];
  for (const i of inventory) {
    batch.set(col("inventory", i.id), { ...i, onOrder: false, reorderDraftedAt: null });
  }

  /* ── Metrics — organic 14-day revenue, oldest → newest ──────────────── */
  batch.set(col("metrics", "global"), {
    revenue14d: [930, 1185, 760, 1320, 1490, 880, 0, 1040, 1245, 905, 1410, 1615, 980, 1130],
    feesNeverPaidToDate: 1342.18,
  });

  /* ── Feedback + lessons — the learning loop, mid-flight ─────────────── */
  batch.set(col("lessons", "lsn-confirm-by-text"), {
    text: "Always propose text (not email) confirmations for clients under 40 or sourced from Instagram — they confirm 3x more often.",
    scope: "foh", status: "active", support: 3,
    createdAt: T(daysAgo(12)), resolvedAt: T(daysAgo(10)),
  });
  batch.set(col("lessons", "lsn-deposit-window"), {
    text: "Only ask for deposits on bookings made more than a week out — same-week bookings rarely no-show and the ask feels cold.",
    scope: "foh", status: "quarantined", support: 2,
    createdAt: T(daysAgo(3)), resolvedAt: null,
  });
  const feedback = [
    { id: "fb-01", text: "Deposit requests on day-of bookings feel aggressive — a client pushed back hard today.", source: "manager", kind: "complaint", summary: "Deposit asks on short-lead bookings create friction.", lessonId: "lsn-deposit-window", days: 3 },
    { id: "fb-02", text: "Confirmation texts are landing way better than the emails ever did.", source: "manager", kind: "praise", summary: "Text confirmations outperform email.", lessonId: "lsn-confirm-by-text", days: 11 },
    { id: "fb-03", text: "Love the waitlist backfill idea — we filled Friday's 2pm gap in 20 minutes.", source: "owner", kind: "praise", summary: "Waitlist backfill recovered a cancelled slot fast.", lessonId: null, days: 6 },
    { id: "fb-04", text: "Can the day board show service color by room? We keep double-walking clients.", source: "manager", kind: "idea", summary: "Request: room-aware day board coloring.", lessonId: null, days: 1 },
  ];
  for (const f of feedback) {
    batch.set(col("feedback", f.id), {
      text: f.text, source: f.source, createdAt: T(daysAgo(f.days)),
      triageKind: f.kind, triageSummary: f.summary, lessonId: f.lessonId,
    });
  }

  await batch.commit();
  console.log(
    `Seeded: ${customers.length} customers, ${staff.length} staff, ${appts.length} appointments (9 today / 3 tomorrow), ${inventory.length} inventory, 2 lessons, ${feedback.length} feedback.`,
  );
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
