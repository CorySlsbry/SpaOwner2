import { db } from "@/lib/db";
import { loadWorld } from "@/lib/facts";
import { aiConfigured } from "@/lib/ai";
import { LessonActions, RecActions, RunAgentButton } from "@/components/actions";
import type { AgentRun, Feedback, Lesson, Recommendation } from "@/lib/types";

export const dynamic = "force-dynamic";

type Doc<T> = T & { id: string };

/**
 * Owner view — money, the two agents, what the system has learned, and the
 * "your clients are yours" surface. Every figure on this page comes from
 * lib/facts.ts (deterministic); agent text is narration over those facts.
 */
export default async function OwnerPage() {
  const [world, runsSnap, recsSnap, lessonsSnap, feedbackSnap] =
    await Promise.all([
      loadWorld(),
      db().collection("agent_runs").orderBy("startedAt", "desc").limit(6).get(),
      // Single-field filter only (auto-indexed); sort in memory to avoid a
      // composite index for a prototype. A swallowed index error here would
      // silently empty the queue — the exact trap we hit once.
      db()
        .collection("recommendations")
        .where("status", "==", "pending")
        .get()
        .catch(() => null),
      db().collection("lessons").orderBy("createdAt", "desc").limit(20).get(),
      db().collection("feedback").orderBy("createdAt", "desc").limit(5).get(),
    ]);

  const runs = runsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as AgentRun) }));
  const lastRun = (agent: "foh" | "boh") => runs.find((r) => r.agent === agent);
  const recs = (recsSnap?.docs ?? [])
    .map((d) => ({ id: d.id, ...(d.data() as Recommendation) }))
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .slice(0, 20);
  const lessons = lessonsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Lesson) }));
  const activeLessons = lessons.filter((l) => l.status === "active");
  const quarantined = lessons.filter((l) => l.status === "quarantined");
  const feedback = feedbackSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Feedback) }));

  const highRisk = world.today.filter((a) => a.band === "high").length;
  const series = world.metrics?.revenue14d ?? [];
  const feesToDate = (world.metrics?.feesNeverPaidToDate ?? 0) + world.feeAudit.totalToday;
  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-[23px] font-semibold">Owner</h1>
          <p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>{today}</p>
        </div>
        <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>
          Press <kbd className="num">⌘K</kbd> for anything
        </span>
      </header>

      {/* ── Pulse — one panel, hairline cells (not a card grid) ── */}
      <section className="panel grid grid-cols-4 divide-x" style={{ borderColor: "var(--line)" }}>
        <Pulse label="Booked today" value={`$${world.todayRevenueBooked.toLocaleString()}`} />
        <Pulse label="Completed so far" value={`$${world.todayRevenueCompleted.toLocaleString()}`} tone="ok" />
        <Pulse
          label="High no-show risk"
          value={String(highRisk)}
          tone={highRisk > 0 ? "risk" : undefined}
          sub={highRisk > 0 ? "agent has proposals below" : "book is healthy"}
        />
        <Pulse
          label="Fees never paid"
          value={`$${feesToDate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`+$${world.feeAudit.totalToday.toFixed(2)} today vs per-feature platforms`}
        />
      </section>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {/* ── Agents ── */}
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">Agents</h2>
              <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                propose → you approve · nothing applies itself
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <AgentRow
                title="Front of house"
                blurb="works the book — risk, confirmations, deposits, backfill"
                run={lastRun("foh")}
                button={<RunAgentButton agent="foh" label="Run front of house" />}
              />
              <div style={{ borderTop: "1px solid var(--line)" }} />
              <AgentRow
                title="Back of house"
                blurb="works the business — stock, payroll sanity, fee audit"
                run={lastRun("boh")}
                button={<RunAgentButton agent="boh" label="Run back of house" />}
              />
            </div>

            {/* Pending queue */}
            <div className="mt-5">
              <h3 className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-3)", letterSpacing: "0.04em" }}>
                Waiting on you · {recs.length}
              </h3>
              {recs.length === 0 ? (
                <p className="mt-2 text-[13px]" style={{ color: "var(--ink-2)" }}>
                  Queue is clear. Run an agent and proposals land here for one-click approval.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col">
                  {recs.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-4 py-2.5"
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <SeverityDot severity={r.severity} />
                          <span className="text-[13.5px] font-medium truncate">{r.title}</span>
                          <span className="chip" style={{ background: "var(--panel)", color: "var(--ink-3)" }}>
                            {r.agent === "foh" ? "front" : "back"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                          {r.detail}
                        </p>
                      </div>
                      <RecActions id={r.id} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* ── Learning ── */}
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">What it&apos;s learned</h2>
              <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                feedback → proposed lesson → your approval → agent behavior
              </span>
            </div>

            {quarantined.length > 0 && (
              <div className="mt-4">
                <h3 className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--warn)", letterSpacing: "0.04em" }}>
                  Proposed · awaiting your call
                </h3>
                <ul className="mt-1.5 flex flex-col gap-2.5">
                  {quarantined.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-start justify-between gap-4 rounded-[10px] px-3 py-2.5"
                      style={{ background: "var(--warn-wash)" }}
                    >
                      <div>
                        <p className="text-[13px]">{l.text}</p>
                        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                          {l.scope === "all" ? "both agents" : l.scope === "foh" ? "front of house" : "back of house"} ·
                          supported by {l.support} piece{l.support === 1 ? "" : "s"} of feedback
                        </p>
                      </div>
                      <LessonActions id={l.id} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4">
              <h3 className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-3)", letterSpacing: "0.04em" }}>
                Active rules · {activeLessons.length}
              </h3>
              {activeLessons.length === 0 ? (
                <p className="mt-2 text-[13px]" style={{ color: "var(--ink-2)" }}>
                  Nothing approved yet — leave feedback and approve the lessons that ring true.
                </p>
              ) : (
                <ul className="mt-1.5 flex flex-col">
                  {activeLessons.map((l) => (
                    <li key={l.id} className="py-2 text-[13px]" style={{ borderTop: "1px solid var(--line)" }}>
                      {l.text}
                      <span className="ml-2 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                        {l.scope === "all" ? "both" : l.scope}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {feedback.length > 0 && (
              <p className="mt-4 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                Latest feedback: “{feedback[0].text.slice(0, 90)}
                {feedback[0].text.length > 90 ? "…" : ""}” — triaged as {feedback[0].triageKind}.
              </p>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          {/* ── Revenue ── */}
          <section className="panel p-5">
            <h2 className="text-[16px] font-semibold">Last 14 days</h2>
            <Sparkline series={series} />
            <div className="mt-2 flex justify-between text-[12px]" style={{ color: "var(--ink-2)" }}>
              <span>
                total <span className="num font-medium" style={{ color: "var(--ink)" }}>${series.reduce((a, b) => a + b, 0).toLocaleString()}</span>
              </span>
              <span>
                best day <span className="num font-medium" style={{ color: "var(--ink)" }}>${Math.max(0, ...series).toLocaleString()}</span>
              </span>
            </div>
          </section>

          {/* ── Your clients are yours ── */}
          <section className="panel p-5">
            <h2 className="text-[16px] font-semibold">Your clients are yours</h2>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--ink-2)" }}>
              No marketplace. No “new client” fee on people who found you through your
              own Instagram or Google. And the full book exports any time — leaving has
              to be easy for staying to mean anything.
            </p>
            <a href="/api/export/clients" className="btn mt-3.5">
              Export client book (CSV)
            </a>
            <div className="mt-4" style={{ borderTop: "1px solid var(--line)" }}>
              <h3 className="mt-3 text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-3)", letterSpacing: "0.04em" }}>
                Today, elsewhere, you&apos;d have paid
              </h3>
              <ul className="mt-1.5 flex flex-col gap-1 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                <FeeLine label="Marketplace “new client” fees (20%)" amount={world.feeAudit.marketplaceNewClientFees} />
                <FeeLine label="Per-text confirmation fees" amount={world.feeAudit.perTextFees} />
                <FeeLine label="Forms · marketing · website add-ons" amount={world.feeAudit.addOnDailyShare} />
                <FeeLine label="Per-stylist calendar pricing" amount={world.feeAudit.perCalendarDailyShare} />
                <li className="flex justify-between pt-1.5 font-medium" style={{ borderTop: "1px solid var(--line)", color: "var(--ink)" }}>
                  <span>Kept in your pocket today</span>
                  <span className="num">${world.feeAudit.totalToday.toFixed(2)}</span>
                </li>
              </ul>
            </div>
          </section>

          {!aiConfigured() && (
            <section className="panel p-4" style={{ background: "var(--warn-wash)", borderColor: "var(--warn)" }}>
              <p className="text-[12.5px]" style={{ color: "var(--ink)" }}>
                <strong>AI is offline</strong> — set <code className="num">ANTHROPIC_API_KEY</code>.
                Agents still queue deterministic proposals; narration resumes when the key lands.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Pulse({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "risk";
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11.5px] font-medium" style={{ color: "var(--ink-3)" }}>{label}</div>
      <div
        className="num mt-0.5 text-[22px] font-semibold tracking-tight"
        style={{ color: tone === "risk" ? "var(--risk)" : tone === "ok" ? "var(--ok)" : "var(--ink)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-3)" }}>{sub}</div>
      )}
    </div>
  );
}

function AgentRow({
  title,
  blurb,
  run,
  button,
}: {
  title: string;
  blurb: string;
  run: (AgentRun & { id: string }) | undefined;
  button: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium">{title}</span>
          <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>{blurb}</span>
        </div>
        {run ? (
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
            {run.summary}
            <span className="ml-2 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              {run.startedAt.toDate().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              {run.lessonsApplied > 0 && ` · ${run.lessonsApplied} learned rule${run.lessonsApplied === 1 ? "" : "s"} applied`}
              {run.aiOffline && " · ran without AI"}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
            Hasn&apos;t run yet today.
          </p>
        )}
      </div>
      {button}
    </div>
  );
}

function SeverityDot({ severity }: { severity: "high" | "medium" | "low" }) {
  const color =
    severity === "high" ? "var(--risk)" : severity === "medium" ? "var(--warn)" : "var(--ink-3)";
  return <span className="inline-block size-1.5 rounded-full shrink-0" style={{ background: color }} />;
}

function FeeLine({ label, amount }: { label: string; amount: number }) {
  return (
    <li className="flex justify-between">
      <span>{label}</span>
      <span className="num">${amount.toFixed(2)}</span>
    </li>
  );
}

/** Pure-SVG sparkline — deterministic, no charting dep for one line. */
function Sparkline({ series }: { series: number[] }) {
  if (series.length < 2) {
    return <div className="skeleton mt-3 h-[64px]" />;
  }
  const w = 320;
  const h = 64;
  const max = Math.max(...series, 1);
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - (v / max) * (h - 6) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" role="img" aria-label="Revenue, last 14 days">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--cherry)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {series.map((v, i) => {
        const x = (i / (series.length - 1)) * w;
        const y = h - (v / max) * (h - 6) - 2;
        return i === series.length - 1 ? (
          <circle key={i} cx={x} cy={y} r="3" fill="var(--cherry)" />
        ) : null;
      })}
    </svg>
  );
}
