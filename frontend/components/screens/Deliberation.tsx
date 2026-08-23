"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { IconArrowRight, IconBuilding, IconCheck, IconLock } from "@/components/Icon";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";

/**
 * The deliberation pause is server-timed. The surrounding workspace is built
 * from the real thesis/session state, but never invents committee outcomes.
 */
export default function Deliberation() {
  const { sessionId, config, state } = useStore();
  const [navBusy, navigate] = useNav();
  const total = config?.deliberation_seconds ?? 15;
  const [remaining, setRemaining] = useState<number>(total);
  const synced = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    api
      .get<{ remaining_seconds: number; ready: boolean }>(`/sessions/${sessionId}/deliberation`)
      .then((response) => {
        if (alive) {
          setRemaining(response.remaining_seconds);
          synced.current = true;
        }
      })
      .catch(() => {
        if (alive) synced.current = true;
      });
    return () => { alive = false; };
  }, [sessionId]);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((previous) => Math.max(0, previous - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = remaining <= 0;
  const display = done ? "Ready" : `0:${String(remaining).padStart(2, "0")}`;
  const thesisVariables = state?.thesis_variables ?? [];
  const thesisLabels = thesisVariables.map((key) => config?.variables.find((variable) => variable.key === key)?.label ?? key);
  const thesisConfidence = state?.thesis_confidence ?? {};
  const averageConfidence = thesisVariables.length
    ? Math.round(thesisVariables.reduce((sum, key) => sum + (thesisConfidence[key] ?? 0), 0) / thesisVariables.length)
    : null;
  const stageIndex = state?.rail.findIndex((stage) => stage.key === "deliberation") ?? 5;
  const stageNumber = stageIndex + 1;
  const hasFalsification = Boolean(state?.falsification?.trim());
  const completionPercent = total > 0 ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : 100;

  const submittedRows = useMemo(() => [
    { label: "Thesis submitted", value: thesisVariables.length ? `${thesisVariables.length} trait${thesisVariables.length === 1 ? "" : "s"} selected` : "No traits recorded", state: "done" },
    { label: "Confidence recorded", value: averageConfidence != null ? `${averageConfidence}% average confidence` : "Not available", state: averageConfidence != null ? "done" : "pending" },
    { label: "Falsification condition", value: hasFalsification ? "Recorded in session" : "Not recorded", state: hasFalsification ? "done" : "pending" },
    { label: "Committee review", value: done ? "Review complete" : "In progress", state: done ? "done" : "current" },
  ], [averageConfidence, done, hasFalsification, thesisVariables.length]);

  return (
    <div className="deliberation-workspace">
      <div className="deliberation-heading">
        <div>
          <div className="eyebrow">Deliberation / Stage {stageNumber} of {state?.rail.length ?? 14}</div>
          <h1 className="deliberation-title">Committee in session</h1>
          <p className="deliberation-subtitle">The partners are reviewing your submitted thesis before the next evidence set becomes available.</p>
        </div>
        <div className="deliberation-session-pill"><span className="live-dot" /> Closed session <strong>{done ? "Ready" : "Reviewing"}</strong></div>
      </div>

      <section className="deliberation-hero">
        <div className="deliberation-hero-copy">
          <div className="deliberation-status-mark"><IconBuilding size={22} /></div>
          <div><div className="eyebrow">You have been asked to wait outside</div><h2>The partners are deliberating</h2><p>The pause is part of the exercise. The committee is assessing what you chose before the hidden outcomes become available.</p></div>
        </div>
        <div className="deliberation-clock-block"><div className="deliberation-clock">{display}</div><span>{done ? "Committee review complete" : "Authoritative session timer"}</span></div>
      </section>

      <div className="deliberation-progress-wrap">
        <div className="deliberation-progress-label"><span>Committee review progress</span><strong>{done ? "Complete" : `${remaining}s remaining`}</strong></div>
        <div className="deliberation-progress-track"><i style={{ width: `${completionPercent}%` }} /></div>
        <div className="deliberation-progress-steps"><span className="is-done"><IconCheck size={12} /> Thesis received</span><span className={!done ? "is-current" : "is-done"}>{done ? <IconCheck size={12} /> : <span className="step-dot" />} Committee review</span><span className={done ? "is-current" : ""}>{done ? <IconArrowRight size={12} /> : <IconLock size={12} />} Next evidence stage</span></div>
      </div>

      <div className="deliberation-grid">
        <section className="deliberation-panel thesis-record-panel">
          <div className="deliberation-panel-header"><div><div className="eyebrow">Your submitted thesis</div><h2>What the committee received</h2></div><span className="deliberation-panel-meta">{thesisVariables.length} traits</span></div>
          <div className="deliberation-trait-list">
            {thesisLabels.length ? thesisLabels.map((label, index) => <div className="deliberation-trait" key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong><IconCheck size={13} /></div>) : <div className="deliberation-empty-record">No thesis variables are available in the current session.</div>}
          </div>
          <div className="deliberation-record-footer"><span>Confidence</span><strong>{averageConfidence != null ? `${averageConfidence}% average` : "—"}</strong><span className="record-divider" /><span>Falsification</span><strong>{hasFalsification ? "Recorded" : "—"}</strong></div>
        </section>

        <section className="deliberation-panel committee-panel">
          <div className="deliberation-panel-header"><div><div className="eyebrow">Committee status</div><h2>Review sequence</h2></div><span className="deliberation-panel-meta">Server state</span></div>
          <div className="deliberation-status-list">{submittedRows.map((row) => <div className={`deliberation-status-row ${row.state}`} key={row.label}><span className="deliberation-status-icon">{row.state === "done" ? <IconCheck size={12} /> : row.state === "current" ? <span className="step-dot" /> : <IconLock size={12} />}</span><span><strong>{row.label}</strong><small>{row.value}</small></span></div>)}</div>
          <p className="deliberation-disclaimer"><IconLock size={11} /> Committee responses and hidden outcomes remain unavailable until the server releases the next stage.</p>
        </section>
      </div>

      <section className="deliberation-note-panel"><div className="eyebrow">While you wait</div><h2>Do not revise the decision in your head yet.</h2><p>Your thesis is now fixed for this run. When the next stage opens, compare the committee’s response and newly revealed evidence with the variables and falsification condition you recorded.</p></section>

      <div className="deliberation-action-rail"><div><span className="eyebrow">Next action</span><strong>{done ? "Return to your desk" : "Stay in the deliberation pause"}</strong><span>{done ? "The next inbox stage is now available." : `${total}-second recess · the timer is controlled by the server.`}</span></div><button className="pri" disabled={!done || navBusy} onClick={() => navigate("inbox")}>{navBusy ? "Loading…" : "Return to your desk"}<IconArrowRight size={14} /></button></div>
    </div>
  );
}
