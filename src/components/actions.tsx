"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/* Client-side action buttons. All POST → refresh; busy states inline;
   errors surface in place (never silent). */

export function RunAgentButton({ agent, label }: { agent: "foh" | "boh"; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const res = await fetch("/api/agents/run", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ agent }),
            });
            if (!res.ok) setErr(`Run failed (${res.status})`);
            router.refresh();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working…" : label}
      </button>
      {err && (
        <span className="text-[12px]" style={{ color: "var(--risk)" }}>
          {err}
        </span>
      )}
    </span>
  );
}

export function RecActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "approved" | "dismissed">(null);
  async function act(decision: "approved" | "dismissed") {
    setBusy(decision);
    try {
      await fetch("/api/recommendations/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }
  return (
    <span className="inline-flex gap-1.5 shrink-0">
      <button type="button" className="btn" disabled={busy !== null} onClick={() => void act("dismissed")}>
        {busy === "dismissed" ? "…" : "Dismiss"}
      </button>
      <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void act("approved")}>
        {busy === "approved" ? "…" : "Approve"}
      </button>
    </span>
  );
}

export function LessonActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | string>(null);
  async function act(decision: "active" | "rejected") {
    setBusy(decision);
    try {
      await fetch("/api/lessons/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }
  return (
    <span className="inline-flex gap-1.5 shrink-0">
      <button type="button" className="btn" disabled={busy !== null} onClick={() => void act("rejected")}>
        {busy === "rejected" ? "…" : "Reject"}
      </button>
      <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void act("active")}>
        {busy === "active" ? "…" : "Approve lesson"}
      </button>
    </span>
  );
}

/** Manager inline quick action — applies the bounded mutation immediately. */
export function QuickAction({
  appointmentId,
  action,
  label,
}: {
  appointmentId: string;
  action: "require_deposit" | "send_confirmation" | "offer_waitlist";
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/appointments/act", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ appointmentId, action }),
          });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "…" : label}
    </button>
  );
}
