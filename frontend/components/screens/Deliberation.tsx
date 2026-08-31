"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { IconArrowRight, IconCheck, IconLock } from "@/components/Icon";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";

/**
 * Drop-in deliberation screen replacement.
 * The timer remains server-derived; the radar and review activity are visual
 * layers only and never reveal hidden outcomes.
 */
export default function Deliberation() {
  const { sessionId, config, state } = useStore();
  const [navBusy, navigate] = useNav();
  const total = config?.deliberation_seconds ?? 15;
  const [remaining, setRemaining] = useState<number>(total);
  const synced = useRef(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const REVIEW_PHRASES = [
    "Cross-referencing evidence",
    "Weighing confidence signals",
    "Checking falsification condition",
    "Reconciling thesis variables",
  ];

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
    const id = setInterval(() => setRemaining((previous) => Math.max(0, previous - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setPhraseIndex((i) => (i + 1) % REVIEW_PHRASES.length), 3800);
    return () => clearInterval(id);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = remaining <= 0;
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
  const reviewStage = done ? 3 : remaining <= 5 ? 2 : remaining <= 11 ? 1 : 0;
  const signalPulse = done ? "Review complete" : reviewStage === 0 ? "Growth signal under review" : reviewStage === 1 ? "Retention signal under review" : "Founder signal under review";

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

      <section className={`deliberation-radar-hero${done ? " is-complete" : ""}`} aria-live="polite">
        <div className="radar-hero-kicker">You have been asked to wait outside <span>•</span> Signal radar / Real-time review</div>
        <div className="radar-hero-body">
          <div className="radar-stage">
            <svg className="radar-svg" viewBox="0 0 430 285" role="img" aria-label="Committee signal radar reviewing growth, retention, and founder quality">
              <defs>
                <linearGradient id="radar-sweep-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#58e8d0" stopOpacity="0" /><stop offset="1" stopColor="#58e8d0" stopOpacity=".42" /></linearGradient>
                <filter id="radar-glow"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              <g className="radar-grid"><circle cx="188" cy="142" r="109" /><circle cx="188" cy="142" r="82" /><circle cx="188" cy="142" r="55" /><path d="M188 33V251M79 142H297M111 65L265 219M111 219L265 65" /></g>
              <path className="radar-sweep" d="M188 142 L188 33 A109 109 0 0 1 283 89 Z" fill="url(#radar-sweep-gradient)" />
              <path className="radar-shape" d="M188 67 L258 106 L235 192 L148 181 L118 122 Z" />
              <g className="radar-points"><circle cx="188" cy="67" r="4" /><circle cx="258" cy="106" r="4" /><circle cx="235" cy="192" r="4" /><circle cx="148" cy="181" r="4" /><circle cx="118" cy="122" r="4" /></g>
              <circle className="radar-core" cx="188" cy="142" r="28" /><text x="188" y="138" textAnchor="middle">THESIS</text><text x="188" y="152" textAnchor="middle">REVIEW</text>
              <text className="radar-axis-label" x="188" y="18" textAnchor="middle">GROWTH</text><text className="radar-axis-label" x="323" y="150">RETENTION</text><text className="radar-axis-label" x="53" y="150" textAnchor="end">FOUNDER QUALITY</text>
            </svg>
            <div className="radar-readout"><span className="step-dot" /> {REVIEW_PHRASES[phraseIndex]}…</div>
          </div>
          <div className="radar-clock-block">
            <span className="radar-clock-label">Committee review</span>
            <strong>{done ? "Ready" : `0:${String(remaining).padStart(2, "0")}`}</strong>
            <span>{done ? "Committee review complete" : "Authoritative session timer"}</span>
            <div className="radar-progress-track"><i style={{ width: `${completionPercent}%` }} /></div>
            <small>{signalPulse}</small>
          </div>
        </div>
        <div className="radar-sequence">
          <div className="radar-sequence-step is-done"><span>1</span><strong>Thesis received</strong><small>Complete</small></div>
          <div className={`radar-sequence-step ${reviewStage >= 1 ? "is-current" : ""} ${reviewStage >= 2 ? "is-done" : ""}`}><span>{reviewStage >= 2 ? "✓" : "2"}</span><strong>Signal scan</strong><small>{reviewStage >= 2 ? "Complete" : reviewStage === 1 ? "In progress" : "Pending"}</small></div>
          <div className={`radar-sequence-step ${done ? "is-done" : ""} ${reviewStage === 2 ? "is-current" : ""}`}><span>{done ? "✓" : "3"}</span><strong>Committee synthesis</strong><small>{done ? "Complete" : reviewStage === 2 ? "In progress" : "Pending"}</small></div>
        </div>
      </section>

      <div className="deliberation-progress-wrap">
        <div className="deliberation-progress-label"><span>Committee review progress</span><strong>{done ? "Complete" : `${remaining}s remaining`}</strong></div>
        <div className={`deliberation-progress-track${done ? "" : " is-active"}`}><i style={{ width: `${completionPercent}%` }} /></div>
        <div className="deliberation-progress-steps"><span className="is-done"><IconCheck size={12} /> Thesis received</span><span className={!done ? "is-current" : "is-done"}>{done ? <IconCheck size={12} /> : <span className="step-dot" />} Committee review</span><span className={done ? "is-current" : ""}>{done ? <IconArrowRight size={12} /> : <IconLock size={12} />} Next evidence stage</span></div>
      </div>

      <div className="deliberation-grid">
        <section className="deliberation-panel thesis-record-panel">
          <div className="deliberation-panel-header"><div><div className="eyebrow">Your submitted thesis</div><h2>What the committee received</h2></div><span className="deliberation-panel-meta">{thesisVariables.length} traits</span></div>
          <div className="deliberation-trait-list">{thesisLabels.length ? thesisLabels.map((label, index) => <div className="deliberation-trait" key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong><IconCheck size={13} /></div>) : <div className="deliberation-empty-record">No thesis variables are available in the current session.</div>}</div>
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

      <style jsx>{`
        .deliberation-radar-hero{position:relative;overflow:hidden;margin:0 0 14px;border:1px solid rgba(100,215,191,.25);border-radius:6px;background:linear-gradient(120deg,rgba(11,58,46,.94),rgba(4,32,26,.98));box-shadow:0 16px 50px rgba(0,0,0,.14)}
        .deliberation-radar-hero:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 40% 38%,rgba(73,204,181,.1),transparent 25%),linear-gradient(90deg,transparent,rgba(88,232,208,.025),transparent)}
        .radar-hero-kicker{position:relative;z-index:1;padding:19px 24px 0;color:#89aaa0;font:10px var(--mono,monospace);text-transform:uppercase;letter-spacing:.15em}.radar-hero-kicker span{color:#58e8d0;padding:0 7px}
        .radar-hero-body{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 265px;min-height:280px;padding:8px 24px 0}.radar-stage{position:relative;min-height:268px}.radar-svg{position:absolute;width:min(100%,520px);height:270px;left:50%;top:0;transform:translateX(-50%);overflow:visible}.radar-grid{fill:none;stroke:rgba(105,210,190,.21);stroke-width:1}.radar-grid path{stroke-dasharray:3 6}.radar-sweep{transform-origin:188px 142px;animation:radarSweep 4.8s linear infinite;opacity:.74}.radar-shape{fill:rgba(88,232,208,.11);stroke:#58e8d0;stroke-width:1.4;stroke-dasharray:4 5;filter:url(#radar-glow);animation:radarShape 2.4s cubic-bezier(.23,1,.32,1) infinite alternate}.radar-points circle{fill:#58e8d0;filter:url(#radar-glow);animation:radarPoint 1.8s ease-in-out infinite}.radar-points circle:nth-child(2){animation-delay:.25s}.radar-points circle:nth-child(3){animation-delay:.5s}.radar-points circle:nth-child(4){animation-delay:.75s}.radar-points circle:nth-child(5){animation-delay:1s}.radar-core{fill:rgba(4,34,27,.94);stroke:#58e8d0;stroke-width:1.2;filter:url(#radar-glow)}.radar-svg text{fill:#d4eee4;font-family:var(--mono,monospace);font-size:9px;letter-spacing:.13em}.radar-svg .radar-axis-label{fill:#9bd1c1;font-size:9px}.radar-readout{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:max-content;color:#82a99d;font:9px var(--mono,monospace);display:flex;align-items:center;gap:8px}.radar-clock-block{border-left:1px solid rgba(111,203,184,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 20px;text-align:center}.radar-clock-label,.radar-clock-block>span:last-of-type{color:#789b90;font:9px var(--mono,monospace);text-transform:uppercase;letter-spacing:.13em}.radar-clock-block strong{font:500 clamp(43px,5vw,64px)/1 var(--mono,monospace);letter-spacing:-.1em;color:#58e8d0;margin:14px 0 5px;text-shadow:0 0 28px rgba(88,232,208,.18)}.radar-progress-track{width:100%;height:4px;background:rgba(113,183,166,.16);margin:18px 0 12px;overflow:hidden}.radar-progress-track i{display:block;height:100%;background:linear-gradient(90deg,#58e8d0,#8cf3e0);box-shadow:0 0 9px rgba(88,232,208,.5);transition:width .7s linear}.radar-clock-block small{color:#9bcbbd;font:9px var(--mono,monospace);margin-top:19px}.radar-clock-block small:before{content:"";display:inline-block;width:5px;height:5px;background:#58e8d0;border-radius:50%;margin-right:7px;box-shadow:0 0 10px #58e8d0}.radar-sequence{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid rgba(112,203,184,.2);margin:0 24px;padding:17px 0 19px}.radar-sequence-step{display:grid;grid-template-columns:32px 1fr;column-gap:10px;position:relative;align-items:center;color:#607f75}.radar-sequence-step:after{content:"";height:1px;background:rgba(112,203,184,.2);position:absolute;left:47px;right:14px;top:15px}.radar-sequence-step:last-child:after{display:none}.radar-sequence-step span{grid-row:span 2;width:30px;height:30px;border:1px solid rgba(112,203,184,.32);border-radius:50%;display:grid;place-items:center;font:11px var(--mono,monospace)}.radar-sequence-step strong{font:11px var(--mono,monospace);text-transform:uppercase;letter-spacing:.1em;font-weight:400}.radar-sequence-step small{font:9px var(--mono,monospace);color:#789b90;margin-top:4px}.radar-sequence-step.is-current,.radar-sequence-step.is-done{color:#58e8d0}.radar-sequence-step.is-current span{border-color:#58e8d0;box-shadow:0 0 0 4px rgba(88,232,208,.06)}.radar-sequence-step.is-done span{border-color:#58e8d0}
        @keyframes radarSweep{to{transform:rotate(360deg)}}@keyframes radarShape{to{opacity:.66;transform:scale(1.025)}}@keyframes radarPoint{50%{opacity:.45;transform:scale(.7)}}
        .deliberation-radar-hero.is-complete .radar-sweep{animation-play-state:paused;opacity:.2}.deliberation-radar-hero.is-complete .radar-shape{animation:none;stroke:#9beee0}.deliberation-radar-hero.is-complete .radar-readout{color:#58e8d0}
        @media (max-width:850px){.radar-hero-body{grid-template-columns:1fr}.radar-clock-block{border-left:0;border-top:1px solid rgba(111,203,184,.2);min-height:148px;padding:20px 24px}.radar-clock-block strong{font-size:46px}.radar-progress-track{max-width:360px}.radar-clock-block small{margin-top:13px}.radar-stage{min-height:260px}}
        @media (max-width:560px){.radar-hero-kicker{padding:15px 14px 0;line-height:1.5}.radar-hero-body{padding:5px 14px 0}.radar-stage{min-height:250px}.radar-svg{width:370px;height:245px;top:5px}.radar-readout{font-size:8px;white-space:nowrap}.radar-sequence{margin:0 14px;grid-template-columns:1fr;gap:12px;padding:15px 0}.radar-sequence-step:after{display:none}.radar-clock-block{min-height:140px}}
        @media (prefers-reduced-motion:reduce){.radar-sweep,.radar-shape,.radar-points circle{animation:none!important}.radar-sweep{opacity:.3}}
      `}</style>
    </div>
  );
}
