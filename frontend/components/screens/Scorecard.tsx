"use client";

import { useEffect, useState } from "react";
import { api, type ScorecardData } from "@/lib/api";
import { IconArrowRight, IconCheck, IconChevronDown, IconLock, IconTrendUp } from "@/components/Icon";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";

const SIGNAL_LABELS: Record<string, string> = {
  missing_data: "named the missing data",
  comparison_group: "asked for a comparison group",
  quantified: "gave a number",
  falsifiable: "stated a falsifiable threshold",
};

type Tab = "summary" | "process" | "answers" | "fund";

function componentValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function Scorecard() {
  const { sessionId, state } = useStore();
  const [navBusy, navigate] = useNav();
  const [card, setCard] = useState<ScorecardData | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [openDimension, setOpenDimension] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    api.get<ScorecardData>(`/sessions/${sessionId}/scorecard`).then(setCard).catch(() => {});
  }, [sessionId]);

  if (!card) return <p className="note">Scoring your run…</p>;

  const stageIndex = state?.rail.findIndex((stage) => stage.key === "scorecard") ?? 12;
  const stageNumber = stageIndex + 1;
  const scoredPercent = card.myelin.max ? (card.myelin.total / card.myelin.max) * 100 : 0;
  const totalSignals = card.committee_analysis.aggregate_signals.length;

  const toggleDimension = (key: string) => setOpenDimension((current) => current === key ? null : key);

  const dimensionRow = (dimension: { key: string; label: string; score: number; max: number; detail: string; components: Record<string, unknown> }) => {
    const open = openDimension === dimension.key;
    const percent = dimension.max ? Math.min(100, Math.max(0, (dimension.score / dimension.max) * 100)) : 0;
    return (
      <div className={`score-dimension${open ? " is-open" : ""}`} key={dimension.key}>
        <button className="score-dimension-trigger" onClick={() => toggleDimension(dimension.key)} aria-expanded={open}>
          <span className="score-dimension-title"><span className="score-dimension-chevron"><IconChevronDown size={13} /></span><strong>{dimension.label}</strong></span>
          <span className="score-dimension-score">{dimension.score} / {dimension.max}</span>
        </button>
        <div className="score-progress"><i style={{ width: `${percent}%` }} /></div>
        <p className="score-dimension-summary">{dimension.detail}</p>
        {open && <div className="score-dimension-detail"><div className="score-detail-heading"><span className="eyebrow">Why this score</span><span className="score-detail-percent">{percent.toFixed(0)}% of available points</span></div><p>{dimension.detail}</p><div className="score-component-grid">{Object.entries(dimension.components).map(([key, value]) => <div className="score-component" key={key}><span>{key.replaceAll("_", " ")}</span><strong>{componentValue(value)}</strong></div>)}</div></div>}
      </div>
    );
  };

  return (
    <div className="scorecard-workspace">
      <div className="scorecard-heading"><div><div className="eyebrow">Analyst review / Stage {stageNumber} of {state?.rail.length ?? 14}</div><h1 className="scorecard-title">How you worked</h1><p className="scorecard-subtitle">Measured from your reasoning process, not from what your fund returned. Explore each dimension to see how the score was formed.</p></div><div className="scorecard-state-pill"><IconCheck size={13} /> Review complete <strong>{card.myelin.band}</strong></div></div>

      <section className="scorecard-hero"><div className="scorecard-total-block"><span className="eyebrow">Total analyst score</span><div className="scorecard-total">{card.myelin.total}<span> / {card.myelin.max}</span></div><div className="scorecard-total-rail"><i style={{ width: `${scoredPercent}%` }} /></div></div><div className="scorecard-band-block"><span className="eyebrow">Band</span><strong>{card.myelin.band}</strong><small>Based on the scored dimensions below</small></div><div className="scorecard-hero-note"><IconTrendUp size={18} /><span>Click any dimension to inspect the evidence and scoring components behind it.</span></div></section>

      <nav className="scorecard-tabs" aria-label="Scorecard views">{(["summary", "process", "answers", "fund"] as Tab[]).map((key) => <button key={key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{key === "summary" ? "Score summary" : key === "process" ? "Process detail" : key === "answers" ? `Written answers${totalSignals ? ` · ${totalSignals}` : ""}` : "Fund result"}</button>)}</nav>

      {tab === "summary" && <>
        <section className="scorecard-section"><div className="scorecard-section-heading"><div><div className="eyebrow">Scored dimensions</div><h2>Where the points came from</h2></div><span>Click to expand</span></div><div className="score-dimension-list">{card.myelin.dimensions.map(dimensionRow)}</div></section>
        <section className="scorecard-na-panel"><div className="scorecard-na-icon"><IconLock size={17} /></div><div><div className="eyebrow">Not scored in this simulation</div><h2>{card.myelin.not_applicable.length} dimensions excluded from the total</h2><p>These are not zeros. Nothing in this simulation produces evidence about these behaviours, so no score is invented to fill the gap.</p><div className="scorecard-na-list">{card.myelin.not_applicable.map((dimension) => <div key={dimension.key}><strong>{dimension.label}</strong><span>{dimension.detail}</span></div>)}</div></div></section>
      </>}

      {tab === "process" && <section className="scorecard-section"><div className="scorecard-section-heading"><div><div className="eyebrow">Process detail</div><h2>Finer-grained diagnostic</h2></div><span>{card.total} / {card.max} · {card.band}</span></div><p className="scorecard-intro">Several process measures feed the dimensions above. This view shows the underlying diagnostic without presenting it as a second overall judgement.</p><div className="score-dimension-list">{card.dimensions.map(dimensionRow)}</div></section>}

      {tab === "answers" && <section className="scorecard-section"><div className="scorecard-section-heading"><div><div className="eyebrow">Written answers</div><h2>How your reasoning was read</h2></div><span>{totalSignals} signals detected</span></div>{card.committee_analysis.aggregate_signals.length ? <div className="score-signal-grid">{card.committee_analysis.aggregate_signals.map((signal) => <div className="score-signal-card" key={signal}><IconCheck size={14} /><span>{SIGNAL_LABELS[signal] ?? signal}</span></div>)}</div> : <div className="score-empty-panel">Your written answers did not name the missing data, ask for a comparison group, quantify a claim, or state a falsifiable threshold.</div>}<div className="score-answer-list">{card.committee_analysis.per_answer.map((answer, index) => <div className="score-answer-row" key={index}><span className="score-answer-index">0{index + 1}</span><div><strong>Committee answer {index + 1}</strong><p>{answer.signals.length ? answer.signals.map((signal) => SIGNAL_LABELS[signal] ?? signal).join(" · ") : "No scoring signal detected"}</p></div></div>)}</div><div className="score-method-note"><span className="eyebrow">Audit note</span><p>This check is a fixed set of patterns applied identically to every submission. It is auditable and repeatable, but it is a floor on written reasoning—not a judgement of it.</p></div></section>}

      {tab === "fund" && <section className="scorecard-section"><div className="scorecard-section-heading"><div><div className="eyebrow">Fund result / not scored</div><h2>Financial outcome for reflection</h2></div><span>Separate from analyst score</span></div>{card.fund ? <><div className="score-fund-hero"><strong>{card.fund.hits} / {card.fund.cheques}</strong><span>investments succeeded</span></div><p className="scorecard-fund-note">{card.fund.note}</p></> : <div className="score-empty-panel">No fund result is available for this session.</div>}</section>}

      <div className="scorecard-action-rail"><div><span className="eyebrow">Final deliverable</span><strong>Generate investment report</strong><span>Carry this analyst review into the final report.</span></div><button className="pri" onClick={() => navigate("report")} disabled={navBusy}>{navBusy ? "Loading…" : "Generate investment report"}<IconArrowRight size={14} /></button></div>
    </div>
  );
}
