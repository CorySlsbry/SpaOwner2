import { loadWorld, lowStock } from "@/lib/facts";
import { QuickAction, RunAgentButton } from "@/components/actions";
import type { ScoredAppointment } from "@/lib/facts";

export const dynamic = "force-dynamic";

/**
 * Manager view — runs today on one screen. The 2-click promise: every
 * at-risk booking has its fix inline (deposit / confirm / backfill), no
 * navigation, no modal. Risk scores are deterministic and explained.
 */
export default async function ManagerPage() {
  const world = await loadWorld();
  const onShift = world.staffDays.filter((s) => s.staff.onShift);
  const atRisk = world.today.filter(
    (a) =>
      (a.band === "high" || a.band === "medium") &&
      (a.status === "booked" || a.status === "confirmed"),
  );
  const low = lowStock(world.inventory);
  const nowMs = Date.now();
  const upNext = world.today.find(
    (a) => a.startsAt.toMillis() > nowMs && a.status !== "cancelled" && a.status !== "completed",
  );
  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-[23px] font-semibold">Today</h1>
          <p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>
            {today} · {world.today.length} appointments · ${world.todayRevenueBooked.toLocaleString()} on the book
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {onShift.map((s) => (
            <span key={s.staff.id} className="chip" style={{ background: "var(--panel)", color: "var(--ink-2)" }}>
              {s.staff.name.split(" ")[0]}
              <span className="num" style={{ color: s.overbooked ? "var(--warn)" : "var(--ink-3)" }}>
                {(s.bookedMins / 60).toFixed(1)}h
              </span>
            </span>
          ))}
        </div>
      </header>

      {/* ── Needs a decision — the agent's risk surface, actions inline ── */}
      <section className="panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Needs a decision</h2>
          <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            risk is rule-based and explained — two clicks max
          </span>
        </div>
        {atRisk.length === 0 ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--ink-2)" }}>
            Nothing at risk right now. New bookings are scored the moment they land.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {atRisk.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0"
                style={{ borderTop: "1px solid var(--line)" }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <RiskChip risk={a.risk} band={a.band} />
                    <span className="text-[13.5px] font-medium">
                      {fmtTime(a)} · {a.customerName}
                    </span>
                    <span className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                      {a.service} · {a.staffName} · <span className="num">${a.price}</span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--ink-2)" }}>
                    {a.reasons.join(" · ")}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {!a.confirmationSentAt && (
                    <QuickAction appointmentId={a.id} action="send_confirmation" label="Confirm" />
                  )}
                  {!a.depositPaid && !a.depositRequired && a.band === "high" && (
                    <QuickAction appointmentId={a.id} action="require_deposit" label="Require deposit" />
                  )}
                  {!a.waitlistOffered && a.band === "high" && (
                    <QuickAction appointmentId={a.id} action="offer_waitlist" label="Backfill" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6 items-start">
        {/* ── The book ── */}
        <section className="panel p-5">
          <h2 className="text-[16px] font-semibold">The book</h2>
          <ul className="mt-3 flex flex-col">
            {world.today.map((a) => {
              const isNext = upNext?.id === a.id;
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-[10px] first:pt-2.5"
                  style={{
                    borderTop: "1px solid var(--line)",
                    background: isNext ? "var(--cherry-wash)" : "transparent",
                  }}
                >
                  <span className="num w-[64px] shrink-0 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                    {fmtTime(a)}
                  </span>
                  <span className="w-[88px] shrink-0 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                    {a.staffName.split(" ")[0]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">
                    <span className="font-medium">{a.customerName}</span>
                    <span style={{ color: "var(--ink-3)" }}> · {a.service}</span>
                  </span>
                  <span className="num text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                    ${a.price}
                  </span>
                  <StatusChip status={a.status} />
                  {isNext && (
                    <span className="chip" style={{ background: "var(--cherry-wash-2)", color: "var(--cherry-deep)" }}>
                      up next
                    </span>
                  )}
                </li>
              );
            })}
            {world.today.length === 0 && (
              <li className="py-4 text-[13px]" style={{ color: "var(--ink-2)" }}>
                No appointments today. The book fills from your direct link — never a marketplace.
              </li>
            )}
          </ul>
        </section>

        {/* ── Back of house ── */}
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Back of house</h2>
            <RunAgentButton agent="boh" label="Run check" />
          </div>
          <h3 className="mt-4 text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-3)", letterSpacing: "0.04em" }}>
            Low stock · {low.length}
          </h3>
          {low.length === 0 ? (
            <p className="mt-2 text-[13px]" style={{ color: "var(--ink-2)" }}>
              Everything at or above par.
            </p>
          ) : (
            <ul className="mt-1.5 flex flex-col">
              {low.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between py-2 text-[13px]"
                  style={{ borderTop: "1px solid var(--line)" }}
                >
                  <span className="min-w-0 truncate">{i.name}</span>
                  <span className="num text-[12.5px]" style={{ color: i.onHand === 0 ? "var(--risk)" : "var(--warn)" }}>
                    {i.onHand}/{i.parLevel}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            Run the check to draft reorders — the owner approves before anything is sent.
          </p>

          <h3 className="mt-5 text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-3)", letterSpacing: "0.04em" }}>
            Tomorrow
          </h3>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
            <span className="num font-medium" style={{ color: "var(--ink)" }}>{world.tomorrowCount}</span>{" "}
            booked so far.
          </p>
        </section>
      </div>
    </div>
  );
}

function fmtTime(a: ScoredAppointment): string {
  return a.startsAt
    .toDate()
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function RiskChip({ risk, band }: { risk: number; band: "high" | "medium" | "low" }) {
  const bg = band === "high" ? "var(--risk-wash)" : "var(--warn-wash)";
  const fg = band === "high" ? "var(--risk)" : "var(--warn)";
  return (
    <span className="chip num" style={{ background: bg, color: fg }}>
      {risk}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    booked: { label: "booked", bg: "var(--panel)", fg: "var(--ink-2)" },
    confirmed: { label: "confirmed", bg: "var(--info-wash)", fg: "var(--info)" },
    completed: { label: "done", bg: "var(--ok-wash)", fg: "var(--ok)" },
    no_show: { label: "no-show", bg: "var(--risk-wash)", fg: "var(--risk)" },
    cancelled: { label: "cancelled", bg: "var(--panel)", fg: "var(--ink-3)" },
  };
  const s = map[status] ?? map.booked;
  return (
    <span className="chip shrink-0" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}
