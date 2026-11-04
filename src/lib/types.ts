import type { Timestamp } from "firebase-admin/firestore";

/* ============================================================================
   Spa Owner 2.0 — data model. Numbers are computed in code (lib/facts.ts);
   the model only narrates. See PRODUCT.md "deterministic firewall".
   ============================================================================ */

export type Customer = {
  name: string;
  email: string;
  phone: string;
  visits: number;
  noShows: number;
  lateCancels: number;
  avgTicket: number;
  firstVisitAt: Timestamp;
  lastVisitAt: Timestamp | null;
  notes: string | null;
};

export type Staff = {
  name: string;
  role: "stylist" | "esthetician" | "massage" | "front_desk";
  onShift: boolean;
  shiftStart: string; // "09:00" local
  shiftEnd: string;
  commissionRate: number; // 0..1
};

export type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled";

export type Appointment = {
  customerId: string;
  customerName: string;
  staffId: string;
  staffName: string;
  service: string;
  startsAt: Timestamp;
  mins: number;
  price: number;
  status: AppointmentStatus;
  depositPaid: boolean;
  depositRequired: boolean;
  confirmationSentAt: Timestamp | null;
  waitlistOffered: boolean;
  source: "direct" | "instagram" | "google" | "walk_in" | "referral";
  createdAt: Timestamp;
};

export type InventoryItem = {
  name: string;
  sku: string;
  onHand: number;
  parLevel: number;
  unitCost: number;
  vendor: string;
  onOrder: boolean;
  reorderDraftedAt: Timestamp | null;
};

export type AgentId = "foh" | "boh";

/** CLOSED action enums — the model cannot propose outside these. */
export type FohAction = "require_deposit" | "send_confirmation" | "offer_waitlist";
export type BohAction = "reorder_stock" | "flag_payroll" | "review_pricing";
export type RecAction = FohAction | BohAction;

export type Recommendation = {
  agent: AgentId;
  action: RecAction;
  title: string;
  detail: string;
  /** Bounded target — the approve handler only ever touches this doc. */
  appointmentId: string | null;
  inventoryItemId: string | null;
  staffId: string | null;
  severity: "high" | "medium" | "low";
  status: "pending" | "approved" | "dismissed";
  createdAt: Timestamp;
  resolvedAt: Timestamp | null;
};

export type AgentRun = {
  agent: AgentId;
  startedAt: Timestamp;
  finishedAt: Timestamp;
  /** One-or-two-sentence colleague-voice narration (AI) or deterministic copy. */
  summary: string;
  recCount: number;
  aiOffline: boolean;
  lessonsApplied: number;
};

export type Feedback = {
  text: string;
  source: "owner" | "manager";
  createdAt: Timestamp;
  triageKind: "idea" | "complaint" | "bug" | "praise" | "note";
  triageSummary: string;
  lessonId: string | null;
};

export type Lesson = {
  /** The learned behavioral rule, injected into agent prompts when active. */
  text: string;
  scope: AgentId | "all";
  status: "quarantined" | "active" | "rejected";
  /** How many feedback items support this lesson (quorum signal). */
  support: number;
  createdAt: Timestamp;
  resolvedAt: Timestamp | null;
};

export type Metrics = {
  /** Last 14 days of revenue, oldest → newest, dollars. Seeded; today live. */
  revenue14d: number[];
  feesNeverPaidToDate: number;
};
