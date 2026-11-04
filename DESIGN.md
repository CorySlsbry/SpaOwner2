# Spa Owner 2.0 — Design System

**Register: product** (impeccable product register — earned familiarity; the
tool disappears into the task). Mood sentence: *"after-hours salon — black
cherry lacquer, chrome, the chair under one warm lamp."* Scene sentence that
forced the light theme: *a sunlit front desk at 9am; the manager glances
between a walk-in and the screen — the screen must match the room.*

Deliberate departure from 1.0 (dark "Aurora" glass, rainbow gradients, paired
display fonts): 2.0 is a **pure-white, single-family, cherry-accent product
tool**. Calm surface; the color is in the work.

## Color — OKLCH, Restrained strategy

Brand seed: `oklch(0.65 0.16 0)` (hue 0). Taken DARK (black-cherry lacquer),
not spa-blush — dodging the category reflex.

| Token | Value | Role |
|---|---|---|
| `--bg` | `oklch(1 0 0)` | Body. Literal pure white (Stripe/Notion/Linear). |
| `--panel` | `oklch(0.975 0.0035 250)` | Rail/toolbars — second neutral, slightly cool. |
| `--ink` | `oklch(0.21 0.015 350)` | Primary text (≥ 12:1 on bg). |
| `--ink-2` | `oklch(0.45 0.015 350)` | Secondary text (≥ 4.5:1 on bg + panel). |
| `--ink-3` | `oklch(0.60 0.012 350)` | Tertiary/meta only (large/bold or non-essential). |
| `--line` | `oklch(0.915 0.004 350)` | Hairlines. |
| `--cherry` | `oklch(0.46 0.165 12)` | Primary actions, selection, focus. AA on white. |
| `--cherry-deep` | `oklch(0.38 0.15 12)` | Hover/active of primary. |
| `--cherry-wash` | `oklch(0.97 0.012 12)` | Selected-row/active-nav wash. |
| `--ok` | `oklch(0.55 0.12 155)` | Success. |
| `--warn` | `oklch(0.62 0.13 75)` | Caution (amber, earned only). |
| `--risk` | `oklch(0.55 0.19 25)` | Danger/no-show risk high. |
| `--info` | `oklch(0.52 0.10 250)` | Informational. |

Accent budget ≤ 10% of any screen. Semantic colors appear ONLY on state.

## Typography — one family

**Geist** everywhere (UI, headings, body) + **Geist Mono** for numbers, money,
times, IDs (tabular-nums). Fixed rem scale, ratio ~1.2:
`12.5 / 13.5(base) / 16 / 19 / 23 / 28`. Page titles 23–28px / 600. Labels
13.5px / 500. No display fonts in UI. `text-wrap: balance` on headings.

## Space, radius, depth, z

- 4px grid; section rhythm 24/32; card padding 16/20.
- Radius: `10px` controls, `14px` panels. No pill buttons except chips.
- Shadows: one level only — `0 1px 2px oklch(0.2 0.01 350 / 0.05)`; structure
  comes from hairlines + the panel neutral, not drop shadows. No glass.
- Z scale (semantic only): `--z-dropdown:100 --z-sticky:200 --z-overlay:300
  --z-modal:400 --z-toast:500 --z-tooltip:600`.

## Motion — Emil's framework, product register

- Tokens: `--ease-out: cubic-bezier(0.23,1,0.32,1)`;
  `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`.
- Durations: press 120ms · popover 160ms · panel/modal 220ms. Under 300 always.
- ⌘K palette opens **with no animation** (keyboard-initiated, used constantly).
- Every pressable: `:active { transform: scale(0.97) }` (120ms ease-out).
- Popovers scale from trigger origin, start at `scale(0.97) + opacity 0`,
  never `scale(0)`. Transitions (interruptible), not keyframes.
- No page-load choreography. Skeletons for loading, never center spinners.
- `@media (prefers-reduced-motion: reduce)` → instant/crossfade. Mandatory.

## Bans in force

Side-stripe borders · gradient text · glassmorphism · hero-metric template ·
identical icon-card grids · uppercase tracked eyebrows on every section ·
01/02/03 scaffolding · decorative motion · modal-as-first-thought · fake data
presented as real (demo data is labeled "Demo").

## Voice

Labels are verbs ("Require deposit", "Backfill slot"). Empty states teach.
Errors say what happened + the next action. The agents speak like a sharp
colleague, one or two sentences, never marketing.
