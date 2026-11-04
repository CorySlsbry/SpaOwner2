"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/* ============================================================================
   App shell — left rail (panel neutral), ⌘K command palette, feedback dialog.

   Motion discipline (DESIGN.md): the palette opens with NO animation
   (keyboard-initiated, constant use). The feedback dialog — occasional —
   gets the 160ms origin-aware pop. Every pressable scales 0.97 on press.
   ============================================================================ */

const VIEWS = [
  { href: "/owner", label: "Owner", hint: "money · agents · learning" },
  { href: "/manager", label: "Manager", hint: "today · risk · coverage" },
] as const;

export function Shell({
  aiOnline,
  children,
}: {
  aiOnline: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setFeedbackOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen w-full">
      {/* ── Rail ── */}
      <aside
        className="w-[232px] shrink-0 flex flex-col border-r"
        style={{ background: "var(--panel)", borderColor: "var(--line)" }}
      >
        <div className="px-5 pt-5 pb-4 flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight">
            Spa Owner
          </span>
          <span
            className="num text-[11px] px-1.5 py-0.5 rounded-md"
            style={{ background: "var(--cherry-wash-2)", color: "var(--cherry-deep)" }}
          >
            2.0
          </span>
        </div>

        <nav className="px-3 flex flex-col gap-0.5">
          {VIEWS.map((v) => {
            const active = pathname.startsWith(v.href);
            return (
              <Link
                key={v.href}
                href={v.href}
                className="rounded-[10px] px-3 py-2 transition-colors"
                style={{
                  background: active ? "var(--cherry-wash)" : "transparent",
                  color: active ? "var(--cherry-deep)" : "var(--ink-2)",
                }}
              >
                <span className="block text-[13.5px] font-medium">{v.label}</span>
                <span className="block text-[11.5px]" style={{ color: active ? "var(--cherry)" : "var(--ink-3)" }}>
                  {v.hint}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-5 pb-5 flex flex-col gap-3">
          <button type="button" className="btn w-full justify-center" onClick={() => setFeedbackOpen(true)}>
            Leave feedback
          </button>
          <div className="flex items-center justify-between text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-1.5 rounded-full"
                style={{ background: aiOnline ? "var(--ok)" : "var(--warn)" }}
              />
              {aiOnline ? "AI online" : "AI offline"}
            </span>
            <span className="chip" style={{ background: "var(--panel-2)", color: "var(--ink-2)" }}>
              Demo data
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center justify-between text-[11.5px] rounded-[8px] border px-2 py-1.5"
            style={{ borderColor: "var(--line)", color: "var(--ink-3)", background: "var(--bg)" }}
          >
            <span>Command palette</span>
            <kbd className="num">⌘K</kbd>
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="flex-1 min-w-0 px-8 py-7 max-w-[1240px]">{children}</main>

      {paletteOpen && <CommandPalette close={() => setPaletteOpen(false)} openFeedback={() => { setPaletteOpen(false); setFeedbackOpen(true); }} />}
      {feedbackOpen && <FeedbackDialog close={() => setFeedbackOpen(false)} />}
    </div>
  );
}

/* ── ⌘K palette — no entrance animation (keyboard-initiated, hot path) ── */

function CommandPalette({ close, openFeedback }: { close: () => void; openFeedback: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const run = useCallback(
    async (id: string) => {
      if (id === "owner") router.push("/owner");
      if (id === "manager") router.push("/manager");
      if (id === "feedback") return openFeedback();
      if (id === "export") window.location.href = "/api/export/clients";
      if (id === "run-foh" || id === "run-boh") {
        await fetch("/api/agents/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agent: id === "run-foh" ? "foh" : "boh" }),
        });
        router.refresh();
      }
      close();
    },
    [router, close, openFeedback],
  );

  const commands = [
    { id: "manager", label: "Go to Manager — today board" },
    { id: "owner", label: "Go to Owner — money & agents" },
    { id: "run-foh", label: "Run front-of-house agent" },
    { id: "run-boh", label: "Run back-of-house agent" },
    { id: "export", label: "Export client book (CSV)" },
    { id: "feedback", label: "Leave feedback" },
  ].filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-[18vh]"
      style={{ zIndex: "var(--z-modal)", background: "oklch(0.2 0.01 350 / 0.25)" }}
      onClick={close}
    >
      <div
        className="w-[480px] rounded-[14px] overflow-hidden"
        style={{ background: "var(--bg)", boxShadow: "var(--shadow-pop)", border: "1px solid var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a command…"
          className="w-full px-4 py-3 text-[13.5px] outline-none border-b"
          style={{ borderColor: "var(--line)" }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && commands[0]) void run(commands[0].id);
          }}
        />
        <ul className="py-1.5 max-h-[300px] overflow-y-auto">
          {commands.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => void run(c.id)}
                className="w-full text-left px-4 py-2 text-[13px] hover:bg-(--panel) transition-colors"
              >
                {c.label}
              </button>
            </li>
          ))}
          {commands.length === 0 && (
            <li className="px-4 py-3 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
              No matching command.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

/* ── Feedback dialog — the learning loop's intake ── */

function FeedbackDialog({ close }: { close: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [source, setSource] = useState<"owner" | "manager">("owner");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(t);
  }, []);

  async function submit() {
    if (text.trim().length < 4 || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.trim(), source }),
      });
      const j = (await res.json().catch(() => ({}))) as { triage?: string };
      setDone(j.triage ?? "Logged. The system will propose a lesson if a pattern forms.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: "var(--z-modal)", background: "oklch(0.2 0.01 350 / 0.25)" }}
      onClick={close}
    >
      <div
        className="pop-enter w-[440px] rounded-[14px] p-5"
        data-open={open}
        style={{ background: "var(--bg)", boxShadow: "var(--shadow-pop)", border: "1px solid var(--line)", ["--pop-origin" as string]: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold">Teach the system</h2>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
          Feedback becomes a proposed lesson. Nothing changes agent behavior until you approve it.
        </p>
        {done ? (
          <div className="mt-4 rounded-[10px] px-3 py-2.5 text-[13px]" style={{ background: "var(--ok-wash)", color: "var(--ok)" }}>
            {done}
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="e.g. Stop proposing deposits for regulars — it reads as distrust."
              className="input mt-4"
              style={{ resize: "vertical" }}
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1">
                {(["owner", "manager"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSource(s)}
                    className="chip"
                    style={{
                      background: source === s ? "var(--cherry-wash-2)" : "var(--panel)",
                      color: source === s ? "var(--cherry-deep)" : "var(--ink-2)",
                      cursor: "pointer",
                    }}
                  >
                    as {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-quiet" onClick={close}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" disabled={busy || text.trim().length < 4} onClick={() => void submit()}>
                  {busy ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </>
        )}
        {done && (
          <div className="mt-3 flex justify-end">
            <button type="button" className="btn" onClick={close}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
