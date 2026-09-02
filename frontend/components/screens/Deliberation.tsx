"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { IconArrowRight, IconCheck, IconLock } from "@/components/Icon";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";

type ReviewTone = "cyan" | "amber" | "blue" | "muted";

type Partner = {
  short: string;
  name: string;
  role: string;
  tone: ReviewTone;
  event: string;
  detail: string;
};

const PARTNERS: Partner[] = [
  { short: "ANA", name: "Ana Behl", role: "Managing Partner", tone: "amber", event: "Signal challenged", detail: "Testing whether the strongest signal survives scrutiny." },
  { short: "VIK", name: "Vikram Sood", role: "Principal", tone: "cyan", event: "Threshold requested", detail: "Asking for the point at which conviction changes." },
  { short: "RAS", name: "Rashi Patel", role: "Partner", tone: "blue", event: "Failure mode isolated", detail: "Looking for the most likely way the thesis is wrong." },
  { short: "DAV", name: "David Chen", role: "CFO", tone: "cyan", event: "Unit economics reviewed", detail: "Checking the cost of the thesis in capital terms." },
  { short: "PRI", name: "Priya Sharma", role: "Head of Risk", tone: "blue", event: "Provenance review queued", detail: "Tracing what is missing from the portfolio history." },
];

const REVIEW_PHASES = [
  { label: "Thesis received", detail: "Ingested & validated" },
  { label: "Signal review", detail: "Committee evaluating signals" },
  { label: "Committee synthesis", detail: "Preparing next evidence stage" },
];

const REVIEW_PHRASES = [
  "Cross-referencing submitted evidence",
  "Testing confidence against the thesis",
  "Checking the falsification condition",
  "Reconciling committee signals",
];

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, radius, endAngle);
  const end = polar(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function Deliberation() {
  const { sessionId, config, state } = useStore();
  const [navBusy, navigate] = useNav();
  const total = config?.deliberation_seconds ?? 15;
  const [clock, setClock] = useState<{ remainingMs: number; deadlinePerfMs: number | null }>({ remainingMs: total * 1000, deadlinePerfMs: null });
  const [phraseIndex, setPhraseIndex] = useState(0);
  const synced = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    const requestStartedAt = performance.now();
    api
      .get<{ remaining_seconds: number; ready: boolean; server_time?: string; deadline_at?: string | null }>(`/sessions/${sessionId}/deliberation`)
      .then((response) => {
        if (!alive) return;
        const receivedAt = performance.now();
        const midpoint = requestStartedAt + (receivedAt - requestStartedAt) / 2;
        const serverNowMs = response.server_time ? Date.parse(response.server_time) : NaN;
        const deadlineMs = response.deadline_at ? Date.parse(response.deadline_at) : NaN;
        if (Number.isFinite(serverNowMs) && Number.isFinite(deadlineMs)) {
          setClock({ remainingMs: Math.max(0, deadlineMs - serverNowMs), deadlinePerfMs: midpoint + (deadlineMs - serverNowMs) });
        } else {
          setClock({ remainingMs: Math.max(0, response.remaining_seconds * 1000), deadlinePerfMs: null });
        }
        synced.current = true;
      })
      .catch(() => {
        if (alive) synced.current = true;
      });
    return () => { alive = false; };
  }, [sessionId]);

  useEffect(() => {
    if (clock.deadlinePerfMs == null) return;
    let frame = 0;
    const tick = () => {
      const remainingMs = Math.max(0, clock.deadlinePerfMs! - performance.now());
      setClock((previous) => previous.remainingMs === remainingMs ? previous : { ...previous, remainingMs });
      if (remainingMs > 0) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [clock.deadlinePerfMs]);

  useEffect(() => {
    const phraseId = window.setInterval(() => setPhraseIndex((index) => (index + 1) % REVIEW_PHRASES.length), 3600);
    return () => window.clearInterval(phraseId);
  }, []);

  const remainingMs = clock.remainingMs;
  const remaining = Math.ceil(remainingMs / 1000);
  const done = remainingMs <= 0;
  const thesisVariables = state?.thesis_variables ?? [];
  const thesisLabels = thesisVariables.map((key) => config?.variables.find((variable) => variable.key === key)?.label ?? key);
  const thesisConfidence = state?.thesis_confidence ?? {};
  const averageConfidence = thesisVariables.length
    ? Math.round(thesisVariables.reduce((sum, key) => sum + (thesisConfidence[key] ?? 0), 0) / thesisVariables.length)
    : null;
  const hasFalsification = Boolean(state?.falsification?.trim());
  const completionPercent = total > 0 ? Math.min(100, Math.max(0, ((total * 1000 - remainingMs) / (total * 1000)) * 100)) : 100;
  const activePartner = done ? PARTNERS.length - 1 : Math.min(PARTNERS.length - 1, Math.floor((completionPercent / 100) * PARTNERS.length));
  const reviewStage = done ? 2 : completionPercent > 68 ? 2 : completionPercent > 32 ? 1 : 0;
  const activeVariable = thesisLabels.length ? thesisLabels[activePartner % thesisLabels.length] : "Submitted thesis";
  const progressAngle = Math.min(359.5, Math.max(0, completionPercent * 3.59));

  const feedRows = useMemo(() => {
    return PARTNERS.slice(0, done ? PARTNERS.length : Math.max(2, activePartner + 1)).map((partner, index) => ({
      ...partner,
      timestamp: `${String(Math.max(0, total - Math.min(total, Math.round((index + 1) * (total / PARTNERS.length))))).padStart(2, "0")}s`,
      active: index === activePartner && !done,
    }));
  }, [activePartner, done, total]);

  const sequenceRows = [
    { label: "Thesis received", value: `${thesisVariables.length} signal${thesisVariables.length === 1 ? "" : "s"} ingested`, state: "done" },
    { label: "Confidence recorded", value: averageConfidence != null ? `${averageConfidence}% average confidence` : "Not available", state: averageConfidence != null ? "done" : "pending" },
    { label: "Falsification condition", value: hasFalsification ? "Recorded in session" : "Not recorded", state: hasFalsification ? "done" : "pending" },
    { label: "Committee review", value: done ? "Review complete" : `${activePartner + 1} of ${PARTNERS.length} reviewers active`, state: done ? "done" : "current" },
  ];

  return (
    <div className="sc-workspace">
      <section className={`sc-hero${done ? " is-complete" : ""}`} aria-live="polite">
        <div className="sc-kicker">You have been asked to wait outside <span>•</span> Signal radar / real-time review</div>
        <div className="sc-hero-grid">
          <div className="sc-orbit-stage">
            <svg className="sc-orbit-svg" viewBox="0 0 700 520" role="img" aria-label="Animated committee orbit reviewing the submitted thesis">
              <defs>
                <radialGradient id="sc-core-gradient"><stop offset="0" stopColor="#63f4db" stopOpacity=".26" /><stop offset=".72" stopColor="#0b4237" stopOpacity=".55" /><stop offset="1" stopColor="#021b16" stopOpacity=".1" /></radialGradient>
                <linearGradient id="sc-beam-gradient" x1="0" x2="1"><stop stopColor="#64f1d8" stopOpacity=".34" /><stop offset="1" stopColor="#64f1d8" stopOpacity="0" /></linearGradient>
                <filter id="sc-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              <g className="sc-orbit-grid"><circle cx="320" cy="248" r="190" /><circle cx="320" cy="248" r="145" /><circle cx="320" cy="248" r="96" /><path d="M320 58V438M130 248H510M185 113L455 383M185 383L455 113" /></g>
              <path className="sc-orbit-sweep" d="M320 248 L320 58 A190 190 0 0 1 455 113 Z" fill="url(#sc-beam-gradient)" transform={`rotate(${progressAngle} 320 248)`} />
              <g className="sc-orbit-rotor">
                <circle className="sc-orbit-ring outer" cx="320" cy="248" r="190" />
                <circle className="sc-orbit-ring inner" cx="320" cy="248" r="145" />
                <circle className="sc-orbit-spark" cx="320" cy="58" r="4" />
                <circle className="sc-orbit-spark second" cx="510" cy="248" r="3" />
              </g>
              <path className="sc-progress-arc" d={describeArc(320, 248, 190, 0, progressAngle)} />
              <circle className="sc-core-halo" cx="320" cy="248" r="86" fill="url(#sc-core-gradient)" />
              <circle className="sc-core" cx="320" cy="248" r="55" />
              <text className="sc-core-title" x="320" y="242" textAnchor="middle">THESIS CORE</text>
              <text className="sc-core-detail" x="320" y="262" textAnchor="middle">{thesisVariables.length || 0} SIGNALS · {averageConfidence ?? 0}%</text>
              {PARTNERS.map((partner, index) => {
                const point = polar(320, 248, 190, index * 72);
                const isActive = index === activePartner && !done;
                return (
                  <g className={`sc-partner-node ${isActive ? "is-active" : ""} tone-${partner.tone}`} key={partner.short} transform={`translate(${point.x} ${point.y})`}>
                    {isActive && <circle className="sc-node-pulse" r="26" />}
                    <circle className="sc-node" r="21" />
                    <text className="sc-node-short" y="4" textAnchor="middle">{partner.short}</text>
                    <text className="sc-node-name" x={point.x < 320 ? -31 : 31} y="4" textAnchor={point.x < 320 ? "end" : "start"}>{partner.name}</text>
                    <text className="sc-node-role" x={point.x < 320 ? -31 : 31} y="18" textAnchor={point.x < 320 ? "end" : "start"}>{partner.role}</text>
                  </g>
                );
              })}
            </svg>
            <div className="sc-orbit-readout"><span className="sc-status-pip" /> {done ? "Committee synthesis complete" : REVIEW_PHRASES[phraseIndex]}…</div>
          </div>

          <aside className="sc-review-sidebar">
            <div className="sc-timer-head"><span className="sc-eyebrow">Authoritative session timer</span><div className="sc-timer-row"><strong className="sc-timer-value">{done ? "READY" : `00:${String(remaining).padStart(2, "0")}`}</strong><svg className="sc-timer-ring" viewBox="0 0 80 80"><circle cx="40" cy="40" r="31" /><circle className="sc-timer-ring-progress" cx="40" cy="40" r="31" pathLength="100" style={{ strokeDashoffset: `${100 - completionPercent}` }} /></svg></div><span className="sc-timer-caption">{done ? "Next evidence stage available" : "Time remaining"}</span></div>
            <div className="sc-feed"><div className="sc-feed-header"><span>Live signal feed</span><small>{feedRows.length} events</small></div>{feedRows.map((row) => <div className={`sc-feed-row ${row.active ? "is-active" : ""}`} key={row.short}><span className={`sc-feed-dot tone-${row.tone}`} /><div><strong>{row.short} <i>—</i> {row.event}</strong><small>{row.detail}</small></div><time>{row.timestamp}</time></div>)}</div>
          </aside>
        </div>

        <div className="sc-sequence">{REVIEW_PHASES.map((phase, index) => <div className={`sc-sequence-step ${index < reviewStage || done ? "is-done" : ""} ${index === reviewStage && !done ? "is-current" : ""}`} key={phase.label}><span>{index < reviewStage || done ? "✓" : index + 1}</span><div><strong>{phase.label}</strong><small>{index < reviewStage || done ? "Complete" : index === reviewStage ? "In progress" : phase.detail}</small></div>{index < REVIEW_PHASES.length - 1 && <i />}</div>)}</div>
      </section>

      <div className="sc-progress-wrap"><div className="sc-progress-label"><span>Committee review progress</span><strong>{done ? "Synthesis complete" : `${remaining}s remaining`}</strong></div><div className="sc-progress-track"><i style={{ width: `${completionPercent}%` }} /></div><div className="sc-progress-notes"><span className="is-done"><IconCheck size={12} /> Thesis received</span><span className={!done ? "is-current" : "is-done"}>{done ? <IconCheck size={12} /> : <span className="sc-status-pip" />} Committee review</span><span className={done ? "is-current" : ""}>{done ? <IconArrowRight size={12} /> : <IconLock size={12} />} Next evidence stage</span></div></div>

      <div className="sc-lower-grid">
        <section className="sc-panel sc-thesis-panel"><div className="sc-panel-head"><div><div className="sc-eyebrow">Your submitted thesis</div><h2>What the committee received</h2></div><span>{thesisVariables.length} signals</span></div><div className="sc-trait-list">{thesisLabels.length ? thesisLabels.map((label, index) => <div className={`sc-trait ${index === activePartner % Math.max(1, thesisLabels.length) && !done ? "is-active" : ""}`} key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong><em>{index === activePartner % Math.max(1, thesisLabels.length) && !done ? "UNDER REVIEW" : "RECEIVED"}</em><IconCheck size={13} /></div>) : <div className="sc-empty">No thesis variables are available in the current session.</div>}</div><div className="sc-record-footer"><span>Confidence</span><strong>{averageConfidence != null ? `${averageConfidence}% average` : "—"}</strong><i /><span>Falsification</span><strong>{hasFalsification ? "Recorded" : "—"}</strong></div></section>
        <section className="sc-panel sc-status-panel"><div className="sc-panel-head"><div><div className="sc-eyebrow">Session integrity</div><h2>Review sequence</h2></div><span>Server state</span></div><div className="sc-status-list">{sequenceRows.map((row) => <div className={`sc-status-row ${row.state}`} key={row.label}><span>{row.state === "done" ? <IconCheck size={12} /> : row.state === "current" ? <span className="sc-status-pip" /> : <IconLock size={12} />}</span><div><strong>{row.label}</strong><small>{row.value}</small></div></div>)}</div><p className="sc-disclaimer"><IconLock size={11} /> Committee responses and hidden outcomes remain unavailable until the server releases the next stage.</p></section>
      </div>

      <div className="sc-action-rail"><div><span className="sc-eyebrow">Next action</span><strong>{done ? "Return to your desk" : `Listening to ${PARTNERS[activePartner].name}`}</strong><span>{done ? "The next inbox stage is now available." : `${activeVariable} is currently under committee review.`}</span></div><button className="pri" disabled={!done || navBusy} onClick={() => navigate("inbox")}>{navBusy ? "Loading…" : "Return to your desk"}<IconArrowRight size={14} /></button></div>

      <style jsx>{`
        .sc-workspace{--sc-bg:#03100d;--sc-panel:#061713;--sc-panel-2:#071d17;--sc-line:rgba(129,210,190,.18);--sc-muted:#75988d;--sc-text:#d9f0e8;--sc-teal:#61eed6;--sc-amber:#f2b24c;--sc-blue:#73aefc;position:relative;color:var(--sc-text);font-family:var(--sans,Arial,sans-serif)}
        .sc-eyebrow{font:10px var(--mono,monospace);letter-spacing:.16em;text-transform:uppercase;color:#82a99d}.sc-title{margin:6px 0 4px;font:500 clamp(25px,3vw,36px)/1.05 var(--sans,Arial,sans-serif);letter-spacing:-.04em}.sc-subtitle{margin:0;max-width:690px;color:#78978d;font-size:13px;line-height:1.55}.sc-session-pill{display:flex;align-items:center;gap:8px;padding:10px 13px;border:1px solid var(--sc-line);border-radius:999px;color:#8aa89f;font:10px var(--mono,monospace);white-space:nowrap}.sc-session-pill strong{color:var(--sc-teal);font-weight:400}.sc-live-dot,.sc-status-pip{width:6px;height:6px;display:inline-block;border-radius:50%;background:var(--sc-teal);box-shadow:0 0 14px rgba(97,238,214,.8)}
        .sc-hero{position:relative;overflow:hidden;border:1px solid rgba(97,238,214,.22);border-radius:5px;background:radial-gradient(circle at 30% 42%,rgba(23,107,86,.24),transparent 34%),linear-gradient(115deg,#062b23,#031712 72%);box-shadow:0 24px 70px rgba(0,0,0,.22)}.sc-hero:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent 0,rgba(97,238,214,.025) 50%,transparent 100%);animation:sc-scan 8s ease-in-out infinite}.sc-kicker{position:relative;padding:17px 22px 0;color:#91b6aa;font:10px var(--mono,monospace);letter-spacing:.14em;text-transform:uppercase}.sc-kicker span{padding:0 8px;color:var(--sc-teal)}.sc-hero-grid{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 340px;min-height:555px;padding:0 22px}.sc-orbit-stage{position:relative;min-height:555px}.sc-orbit-svg{position:absolute;width:min(100%,820px);height:555px;left:50%;top:0;transform:translateX(-50%);overflow:visible;display:block}.sc-orbit-grid{fill:none;stroke:rgba(128,221,198,.16);stroke-width:1}.sc-orbit-grid path{stroke-dasharray:3 8}.sc-orbit-ring{fill:none;stroke:rgba(99,234,211,.34);stroke-width:1}.sc-orbit-ring.outer{stroke-dasharray:2 10;stroke-width:1.5}.sc-orbit-ring.inner{stroke-dasharray:1 7;opacity:.45}.sc-orbit-sweep{opacity:.65}.sc-orbit-spark{fill:var(--sc-teal);filter:url(#sc-glow)}.sc-orbit-spark.second{animation:sc-spark 2.6s ease-in-out infinite}.sc-progress-arc{fill:none;stroke:var(--sc-teal);stroke-width:3;stroke-linecap:round;filter:url(#sc-glow);opacity:.9;transition:d .8s linear}.sc-core-halo{animation:sc-breathe 3.2s ease-in-out infinite}.sc-core{fill:rgba(3,27,21,.94);stroke:var(--sc-teal);stroke-width:1.2;filter:url(#sc-glow)}.sc-core-title,.sc-core-detail,.sc-node-short,.sc-node-name,.sc-node-role{font-family:var(--mono,monospace)}.sc-core-title{fill:#e2fff5;font-size:12px;letter-spacing:.11em}.sc-core-detail{fill:#7fbbae;font-size:8px;letter-spacing:.12em}.sc-partner-node{transition:opacity .4s}.sc-node{fill:#041b15;stroke:rgba(127,217,194,.55);stroke-width:1}.sc-node-short{fill:#d8f7ed;font-size:9px;letter-spacing:.06em}.sc-node-name{fill:#b1d1c6;font-size:9px;letter-spacing:.08em}.sc-node-role{fill:#709287;font-size:7px;letter-spacing:.06em}.sc-node-pulse{fill:none;stroke:var(--sc-teal);stroke-width:1;animation:sc-pulse 1.8s ease-out infinite}.sc-partner-node.is-active .sc-node{fill:#0d4439;stroke:var(--sc-teal);filter:url(#sc-glow)}.tone-amber .sc-node{stroke:var(--sc-amber)}.tone-blue .sc-node{stroke:var(--sc-blue)}.sc-orbit-readout{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;color:#86ada0;font:10px var(--mono,monospace);white-space:nowrap}.sc-review-sidebar{margin:30px 0 28px;border-left:1px solid var(--sc-line);background:rgba(0,0,0,.12)}.sc-timer-head{padding:10px 20px 18px}.sc-timer-row{display:flex;align-items:center;justify-content:space-between;margin-top:14px}.sc-timer-row strong{display:inline-block;width:6ch;text-align:left;font:500 clamp(44px,5vw,68px)/.9 var(--mono,monospace);font-variant-numeric:tabular-nums;letter-spacing:-.04em;color:var(--sc-teal);text-shadow:0 0 28px rgba(97,238,214,.2)}.sc-timer-caption{display:block;margin-top:7px;color:#78988d;font:9px var(--mono,monospace);text-transform:uppercase;letter-spacing:.13em}.sc-timer-ring{width:72px;height:72px;transform:rotate(-90deg)}.sc-timer-ring circle{fill:none;stroke:rgba(111,184,170,.18);stroke-width:5}.sc-timer-ring .sc-timer-ring-progress{stroke:var(--sc-teal);stroke-linecap:round;stroke-dasharray:100;transition:stroke-dashoffset .7s linear;filter:url(#sc-glow)}.sc-feed{border-top:1px solid var(--sc-line)}.sc-feed-header{display:flex;justify-content:space-between;padding:15px 20px 10px;color:#b6d4ca;font:10px var(--mono,monospace);letter-spacing:.11em;text-transform:uppercase}.sc-feed-header small{color:#75958b;font-size:9px}.sc-feed-row{display:grid;grid-template-columns:8px 1fr auto;gap:10px;align-items:start;padding:13px 20px;border-top:1px solid rgba(129,210,190,.1);opacity:.64;transition:opacity .4s,background .4s}.sc-feed-row.is-active{opacity:1;background:rgba(97,238,214,.055)}.sc-feed-dot{width:6px;height:6px;margin-top:4px;border-radius:50%;background:var(--sc-teal);box-shadow:0 0 11px currentColor}.sc-feed-dot.tone-amber{background:var(--sc-amber)}.sc-feed-dot.tone-blue{background:var(--sc-blue)}.sc-feed-row strong{display:block;color:#d2ece4;font:10px var(--mono,monospace);letter-spacing:.03em}.sc-feed-row strong i{color:#628278;font-style:normal}.sc-feed-row small{display:block;margin-top:5px;color:#729187;font-size:10px;line-height:1.35}.sc-feed-row time{color:#648278;font:9px var(--mono,monospace)}
        .sc-sequence{position:relative;display:grid;grid-template-columns:1fr 1fr 1fr;margin:0 22px;border-top:1px solid var(--sc-line);padding:18px 0 20px}.sc-sequence-step{position:relative;display:flex;align-items:center;gap:10px;color:#638177}.sc-sequence-step>span{z-index:1;display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(129,210,190,.3);border-radius:50%;font:10px var(--mono,monospace);background:#06241d}.sc-sequence-step>div{display:flex;flex-direction:column;gap:4px}.sc-sequence-step strong{font:10px var(--mono,monospace);font-weight:400;text-transform:uppercase;letter-spacing:.09em}.sc-sequence-step small{color:#72968b;font:9px var(--mono,monospace)}.sc-sequence-step i{position:absolute;left:44px;right:18px;height:1px;background:linear-gradient(90deg,rgba(97,238,214,.48),rgba(97,238,214,.08));transform:translateY(-1px)}.sc-sequence-step.is-current,.sc-sequence-step.is-done{color:var(--sc-teal)}.sc-sequence-step.is-current>span{box-shadow:0 0 0 4px rgba(97,238,214,.06);border-color:var(--sc-teal)}
        .sc-progress-wrap{margin:14px 0;border:1px solid var(--sc-line);border-radius:4px;padding:14px 17px;background:rgba(5,22,17,.74)}.sc-progress-label,.sc-progress-notes{display:flex;justify-content:space-between;align-items:center;color:#88a89d;font:10px var(--mono,monospace);text-transform:uppercase;letter-spacing:.1em}.sc-progress-label strong{color:var(--sc-teal);font-weight:400}.sc-progress-track{height:4px;margin:12px 0 11px;overflow:hidden;background:rgba(121,182,168,.13)}.sc-progress-track i{display:block;height:100%;background:linear-gradient(90deg,#2ac9ad,var(--sc-teal));box-shadow:0 0 10px rgba(97,238,214,.7);transition:width .7s linear}.sc-progress-notes{justify-content:flex-start;gap:30px;font-size:9px;color:#58766d}.sc-progress-notes span{display:flex;align-items:center;gap:5px}.sc-progress-notes .is-done,.sc-progress-notes .is-current{color:#71dfca}.sc-lower-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:14px}.sc-panel{border:1px solid var(--sc-line);border-radius:4px;background:linear-gradient(145deg,rgba(6,25,19,.92),rgba(3,16,12,.96))}.sc-panel-head{display:flex;justify-content:space-between;align-items:flex-start;padding:19px 20px 15px;border-bottom:1px solid rgba(129,210,190,.12)}.sc-panel h2{margin:5px 0 0;font-size:18px;font-weight:500;letter-spacing:-.03em}.sc-panel-head>span{color:#7b9a90;font:9px var(--mono,monospace);text-transform:uppercase;letter-spacing:.08em}.sc-trait-list{padding:8px 20px}.sc-trait{display:grid;grid-template-columns:28px 1fr auto 16px;align-items:center;gap:9px;padding:14px 0;border-bottom:1px solid rgba(129,210,190,.1);color:#9cbab0;transition:background .3s,color .3s}.sc-trait.is-active{color:#e0fff6}.sc-trait.is-active:before{content:"";position:absolute}.sc-trait>span{color:#61cdb7;font:9px var(--mono,monospace)}.sc-trait strong{font-size:12px;font-weight:450}.sc-trait em{color:#61857a;font:8px var(--mono,monospace);font-style:normal;letter-spacing:.1em}.sc-trait.is-active em{color:var(--sc-amber)}.sc-trait svg{color:var(--sc-teal)}.sc-empty{padding:22px 0;color:#718f86;font-size:12px}.sc-record-footer{display:flex;align-items:center;gap:9px;padding:16px 20px;color:#68877d;font:9px var(--mono,monospace);text-transform:uppercase;letter-spacing:.08em}.sc-record-footer strong{color:#b4d5ca;font-weight:400}.sc-record-footer i{width:1px;height:13px;background:var(--sc-line);margin:0 4px}.sc-status-list{padding:8px 20px}.sc-status-row{display:flex;align-items:center;gap:11px;padding:13px 0;border-bottom:1px solid rgba(129,210,190,.1)}.sc-status-row>span{display:grid;place-items:center;width:24px;height:24px;border:1px solid rgba(129,210,190,.22);border-radius:50%;color:#65877d}.sc-status-row.done>span{border-color:var(--sc-teal);color:var(--sc-teal)}.sc-status-row.current>span{border-color:rgba(97,238,214,.6)}.sc-status-row strong{display:block;color:#b7d4ca;font-size:12px;font-weight:450}.sc-status-row small{display:block;margin-top:3px;color:#6f8f84;font:9px var(--mono,monospace)}.sc-disclaimer{display:flex;align-items:flex-start;gap:7px;margin:7px 20px 18px;color:#658279;font:10px/1.45 var(--mono,monospace)}.sc-action-rail{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:14px;padding:17px 20px;border:1px solid var(--sc-line);border-radius:4px;background:#061a14}.sc-action-rail>div{display:grid;gap:5px}.sc-action-rail strong{font-size:14px;font-weight:500}.sc-action-rail>div>span:last-child{color:#78978d;font-size:11px}.sc-action-rail button{display:flex;align-items:center;gap:9px}.sc-action-rail button:disabled{opacity:.42;cursor:not-allowed}
        @keyframes sc-scan{0%,100%{transform:translateX(-35%);opacity:.25}50%{transform:translateX(35%);opacity:.8}}@keyframes sc-breathe{0%,100%{opacity:.68;transform:scale(.98)}50%{opacity:1;transform:scale(1.04)}}@keyframes sc-pulse{0%{opacity:.8;transform:scale(.8)}100%{opacity:0;transform:scale(1.8)}}@keyframes sc-spark{0%,100%{opacity:.25}50%{opacity:1}}@media (max-width:950px){.sc-hero-grid{grid-template-columns:1fr}.sc-review-sidebar{border-left:0;border-top:1px solid var(--sc-line);margin:0}.sc-lower-grid{grid-template-columns:1fr}.sc-orbit-stage{min-height:430px}.sc-orbit-svg{height:430px}.sc-session-pill{align-self:flex-start}}@media (max-width:600px){.sc-kicker{padding-left:14px;padding-right:14px;font-size:8px}.sc-hero-grid{padding:0 10px}.sc-sequence{margin:0 14px;grid-template-columns:1fr;gap:12px}.sc-sequence-step i{display:none}.sc-progress-notes{gap:12px;flex-wrap:wrap}.sc-action-rail{align-items:flex-start;flex-direction:column}.sc-action-rail button{width:100%;justify-content:center}.sc-timer-row strong{font-size:45px}}
        @media (prefers-reduced-motion:reduce){.sc-hero:before,.sc-orbit-rotor,.sc-core-halo,.sc-node-pulse,.sc-orbit-spark.second{animation:none!important}.sc-orbit-sweep animateTransform{display:none}.sc-orbit-rotor{transform:none!important}}
      `}</style>
    </div>
  );
}
