"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import WaveCanvas from "@/components/WaveCanvas";

import Brief from "@/components/screens/Brief";
import Dashboard from "@/components/screens/Dashboard";
import Research from "@/components/screens/Research";
import Thesis from "@/components/screens/Thesis";
import Committee from "@/components/screens/Committee";
import Deliberation from "@/components/screens/Deliberation";
import Inbox from "@/components/screens/Inbox";
import Evidence from "@/components/screens/Evidence";
import ModelBuilder from "@/components/screens/ModelBuilder";
import DealFlow from "@/components/screens/DealFlow";
import Results from "@/components/screens/Results";
import Debrief from "@/components/screens/Debrief";
import Scorecard from "@/components/screens/Scorecard";
import Report from "@/components/screens/Report";

const SCREENS = {
  brief: Brief,
  dashboard: Dashboard,
  research: Research,
  thesis: Thesis,
  committee: Committee,
  deliberation: Deliberation,
  inbox: Inbox,
  evidence: Evidence,
  model: ModelBuilder,
  dealflow: DealFlow,
  results: Results,
  debrief: Debrief,
  scorecard: Scorecard,
  report: Report,
} as const;

export default function Terminal() {
  const { state, sessionId, startSession, ready } = useStore();
  const [minElapsed, setMinElapsed] = useState(false);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (ready && !sessionId) void startSession();
  }, [ready, sessionId, startSession]);

  // Minimum display time so the loading screen doesn't flash
  useEffect(() => {
    if (state && !minElapsed) {
      const elapsed = Date.now() - mountedAt.current;
      const remaining = Math.max(0, 1500 - elapsed);
      if (remaining === 0) {
        setMinElapsed(true);
      } else {
        const id = setTimeout(() => setMinElapsed(true), remaining);
        return () => clearTimeout(id);
      }
    }
  }, [state, minElapsed]);

  if (!state || !minElapsed) {
    return (
      <div className="terminal-loading">
        <WaveCanvas variant="dark" />
        <div className="terminal-loading-inner">
          <div className="terminal-loading-brand">
            <div className="mark" />
            <span>Meridian Partners</span>
          </div>
          <div className="terminal-loading-spinner" aria-hidden="true" />
          <p className="terminal-loading-text">Opening your session…</p>
          <p className="terminal-loading-sub">Preparing your analyst terminal</p>
        </div>
      </div>
    );
  }

  const Screen = SCREENS[state.current_screen] ?? Brief;
  return (
    <section className="fade" key={state.current_screen}>
      <Screen />
    </section>
  );
}
