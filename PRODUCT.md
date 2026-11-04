# Spa Owner 2.0

**register: product**

The AI-native operations OS for independent spas, salons, and studios — rebuilt
from Spa Owner HQ 1.0 around one idea: **two agents run the shop, two humans
steer it.** A front-of-house agent works the book (no-shows, confirmations,
waitlist backfill). A back-of-house agent works the business (stock, payroll
math, fee audit, end-of-day). The owner approves; the system learns from every
piece of feedback.

## Who it's for

- **Owner** — sees money, agent activity, and what the system has learned.
  Approves agent proposals and "lessons." Cares about margin and trust.
- **Manager** — runs today. One screen: the day board, at-risk appointments,
  staff coverage, low stock. Cares about speed: every action ≤ 2 clicks.

## The five pain points 2.0 exists to fix

Researched across owner communities (Reddit threads surfaced via salon-software
review aggregators, Trustpilot, comparison studies) for Mindbody, Vagaro,
Booksy, Fresha, GlossGenius:

1. **No-shows & late cancellations** — 15–30% no-show rates; 5–10% of annual
   profit lost; existing deposit tools are weak and manual.
   → **No-Show Shield**: every appointment gets a deterministic risk score
   (history, lead time, new-client, value, deposit). The FOH agent proposes
   deposits / confirmations / waitlist backfill. Human approves; one click.
2. **Per-feature nickel-and-diming** — Vagaro's per-calendar pricing, paid
   add-ons stacking a $30 plan to $100+; Fresha's per-team-member fees.
   → **Everything included + a live Fee Audit tile**: the BOH agent computes
   what *today's activity* would have cost on per-feature platforms. Pricing
   transparency as a product surface, not a sales page.
3. **Marketplaces charging "new client" fees on YOUR clients** — Fresha's
   20% New Customer Introduction Fee, charged even when the client came from
   the salon's own Google/Instagram/word-of-mouth.
   → **No marketplace, ever.** Direct booking only. The Owner view states the
   principle and counts the fees never paid.
4. **Client data held hostage** — platforms restricting export/migration when
   an owner tries to leave.
   → **Your Data, One Click**: a real, always-on CSV export of the full client
   book. On the Owner view, not buried in settings.
5. **Support black holes + clunky front desk** — quote-only pricing, contract
   lock-in regret, slow many-click calendars.
   → **The product learns from feedback**: in-app feedback is triaged by AI
   into quarantined "lessons"; the owner approves; active lessons change how
   the agents behave (narration-side learning, quorum-gated, human-approved —
   never silent). Front desk is command-palette-first (⌘K), 2-click actions,
   no load choreography.

## Architecture stance (AI-native, deterministic firewall)

- **Numbers come from code, never the model.** Risk scores, commission math,
  stock levels, fee audit — all deterministic in `lib/facts.ts`.
- **The model narrates and proposes** from a CLOSED action enum; every state
  change passes a human approval gate (recommendation queue).
- **Learning lives on the narration side**: feedback → quarantined lesson →
  owner approval → injected into agent prompts. Reward-hacking the numbers is
  impossible by construction.
- AI offline (no key) = honest UI state, never fake output, never silent stubs.

## Stack

Next.js 16 (App Router, `proxy.ts` not middleware) · React 19 · Tailwind 4 ·
Firestore named DB `spa-owner-2` (Admin SDK, project `spaowner`) ·
@anthropic-ai/sdk (claude-opus-4-7, prompt caching, lenient JSON) · zod at
every API boundary. Prototype scope: no auth yet (view switcher), no deploy
yet; seeded demo data with relative dates so the day board is always alive.
