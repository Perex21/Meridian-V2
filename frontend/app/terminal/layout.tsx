"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";
import { IconCheck, IconLock } from "@/components/Icon";
import ProfileMenu from "@/components/ProfileMenu";
import RunPanel from "@/components/RunPanel";
import WaveCanvas from "@/components/WaveCanvas";
import AmbientAudio from "@/components/AmbientAudio";
import Methodology from "@/components/Methodology";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  const { ready, state } = useStore();
  const [runOpen, setRunOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [navBusy, navigate] = useNav();
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (ready && !minElapsed) {
      const elapsed = Date.now() - mountedAt.current;
      const remaining = Math.max(0, 1500 - elapsed);
      if (remaining === 0) setMinElapsed(true);
      else {
        const id = setTimeout(() => setMinElapsed(true), remaining);
        return () => clearTimeout(id);
      }
    }
  }, [ready, minElapsed]);

  if (!ready || !minElapsed) {
    return (
      <div className="terminal-loading">
        <WaveCanvas variant="dark" />
        <div className="terminal-loading-inner">
          <div className="terminal-loading-brand"><div className="mark" /><span>Meridian Partners</span></div>
          <div className="terminal-loading-spinner" aria-hidden="true" />
          <p className="terminal-loading-text">Loading terminal…</p>
          <p className="terminal-loading-sub">Connecting to analyst environment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-app-shell">
      <aside className="terminal-sidebar" aria-label="Meridian stages">
          <div className="sidebar-brand">
            <img className="sidebar-brand-logo" src="/brand/meridian-partners-logo.png" alt="Meridian Partners" />
          </div>
        <nav className="sidebar-nav">
          {state?.rail.map((stage) => {
            const isPending = stage.state === "pending";
            const isCurrent = stage.state === "current";
            return (
              <button
                key={stage.key}
                type="button"
                className={`stage-nav-item ${stage.state}`}
                disabled={isPending || navBusy}
                onClick={() => void navigate(stage.key)}
                aria-current={isCurrent ? "page" : undefined}
                title={isPending ? "This stage is locked until the preceding stage is complete." : undefined}
              >
                <span className="stage-nav-icon">
                  {isPending ? <IconLock size={14} /> : stage.state === "done" ? <IconCheck size={14} /> : <span className="stage-nav-index">{state.rail.indexOf(stage) + 1}</span>}
                </span>
                <span className="stage-nav-label">{stage.label}</span>
                {isCurrent && <span className="stage-nav-current-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-profile-summary">
          <div className="profile-avatar">AR</div>
          <div><strong>Arjun</strong><span>Student</span></div>
        </div>
      </aside>

      <div className="terminal-main-column">
        <header className="terminal-header">
          <div className="header-inner">
            <div className="header-context"><span className="header-eyebrow">Meridian Partners</span><span className="header-separator">/</span><span className="header-page">Analyst terminal</span></div>
            <div className="header-actions">
              {state && <div className="rail-mini" aria-label="Run progress">{state.rail.map((r) => <i key={r.key} className={r.state} />)}</div>}
              <button className="methodology-header-button" type="button" onClick={() => setMethodologyOpen(true)}>Methodology</button>
              <AmbientAudio />
              <ProfileMenu onViewRun={() => setRunOpen(true)} />
            </div>
          </div>
        </header>
        <main className="wrap">{methodologyOpen ? <Methodology onClose={() => setMethodologyOpen(false)} /> : children}</main>
      </div>
      <RunPanel open={runOpen} />
    </div>
  );
}
