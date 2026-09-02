"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";
import type { ScreenKey } from "@/lib/api";

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
import Report from "@/components/screens/Report";
import Scorecard from "@/components/screens/Scorecard";

const SCREENS: Partial<Record<ScreenKey, React.ComponentType>> = {
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
  report: Report,
  scorecard: Scorecard,
};

export default function TerminalPage() {
  const { state, sessionId, startSession } = useStore();
  const [, navigate] = useNav();

  // If there's no session yet, start one
  useEffect(() => {
    if (!sessionId) {
      void startSession();
    }
  }, [sessionId, startSession]);

  if (!state) {
    // The layout already handles the loading state, so this is just a fallback
    return null;
  }

  const Screen = SCREENS[state.current_screen];

  if (!Screen) {
    return (
      <div className="screen-error">
        <p>Unknown screen: <code>{state.current_screen}</code></p>
      </div>
    );
  }

  return <Screen />;
}
