"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { IconArrowRight, IconChevronDown, IconLock, IconUnlock } from "@/components/Icon";

interface Row {
  id: string; status: string; current_screen: string;
  total_score: number | null; band: string | null; hits: number | null; created_at: string;
}

export default function ProfileMenu({ onViewRun }: { onViewRun?: () => void }) {
  const router = useRouter();
  const { state, startSession, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    api.get<Row[]>("/sessions").then(setRows).catch(() => setRows([]));
  }, [open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const best = rows.reduce<number | null>(
    (acc, r) => (r.total_score != null && (acc == null || r.total_score > acc) ? r.total_score : acc),
    null,
  );
  const reachedCount = state?.rail.filter((step) => step.state !== "pending").length ?? 0;
  const current = state?.rail.find((step) => step.state === "current");
  const totalStages = state?.rail.length ?? 14;
  const currentIndex = state?.rail.findIndex((step) => step.state === "current") ?? 0;
  const runStatus = state?.status === "complete" ? "Complete" : "In progress";

  return (
    <div ref={ref} className="profile-menu-root">
      <button className="profile-trigger" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className="profile-avatar">AR</span>
        <span className="profile-progress-mini" aria-label={`${reachedCount} of ${totalStages} stages reached`}>{reachedCount}/{totalStages}</span>
        <IconChevronDown size={13} />
      </button>

      {open && (
        <div className="profile-dropdown" role="menu">
          <div className="pd-header profile-identity-row">
            <div className="pd-avatar">AR</div>
            <div>
              <div className="pd-name">Arjun</div>
              <div className="pd-email">Student · Analyst terminal</div>
            </div>
          </div>
          <div className="pd-body">
            <div className="run-summary">
              <div className="eyebrow">My run</div>
              <div className="run-summary-line"><strong>{runStatus}</strong><span>{current ? `Stage ${currentIndex + 1} · ${current.label}` : "Preparing session"}</span></div>
              <div className="run-progress-track" aria-label={`${reachedCount} of ${totalStages} stages reached`}>
                {state?.rail.map((step) => <i key={step.key} className={step.state} />)}
              </div>
              <div className="run-progress-caption"><span>{reachedCount} of {totalStages} stages reached</span><span>{state?.thesis_locked ? <><IconLock size={11} /> Thesis locked</> : <><IconUnlock size={11} /> Thesis open</>}</span></div>
            </div>

            <button className="profile-run-action" onClick={() => { setOpen(false); onViewRun?.(); }}>
              View full run status <IconArrowRight size={13} />
            </button>

            <div className="pd-divider" />
            <div className="eyebrow" style={{ marginBottom: 8 }}>Session history</div>
            <div className="pd-stats">
              <div className="pd-stat"><div className="sk">Sessions</div><div className="sv">{rows.length}</div></div>
              <div className="pd-stat"><div className="sk">Best score</div><div className="sv">{best != null ? best : "—"}</div></div>
              <div className="pd-stat"><div className="sk">Traits</div><div className="sv">{state?.thesis_variables?.length ?? 0}</div></div>
              <div className="pd-stat"><div className="sk">Cheques</div><div className="sv">{state?.picks?.length ?? 0}</div></div>
            </div>

            <button style={{ width: "100%", marginBottom: 8 }} onClick={() => { setOpen(false); router.push("/terminal/history"); }}>
              Session history {rows.length > 0 && <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{rows.length}</span>} <IconArrowRight size={13} />
            </button>
            <button style={{ width: "100%", background: "var(--orange)", color: "var(--on-accent)", borderColor: "var(--orange)" }} onClick={async () => { await startSession(); setOpen(false); toast("New session", "Terminal cleared. A fresh run has started."); }}>
              New session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
