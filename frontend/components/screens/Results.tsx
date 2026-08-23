"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, COLORS } from "@/components/Chart";
import CompanySymbol from "@/components/CompanySymbol";
import { IconArrowRight, IconCheck, IconTrendUp } from "@/components/Icon";
import { api, type FundResult } from "@/lib/api";
import { money } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";

export default function Results() {
  const { sessionId, state } = useStore();
  const [navBusy, navigate] = useNav();
  const [fund, setFund] = useState<FundResult | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    api.get<FundResult>(`/sessions/${sessionId}/results`).then(setFund).catch(() => {});
  }, [sessionId]);

  const stageIndex = state?.rail.findIndex((stage) => stage.key === "results") ?? 10;
  const stageNumber = stageIndex + 1;
  const successes = useMemo(() => fund?.rows.filter((row) => row.outcome === "Success") ?? [], [fund]);
  const writeOffs = useMemo(() => fund?.rows.filter((row) => row.outcome !== "Success") ?? [], [fund]);
  const passedCount = fund?.missed_winners.length ?? 0;
  const totalReturned = fund?.returned_usd ?? 0;

  if (!fund) return <p className="note">Resolving the fund…</p>;

  return (
    <div className="performance-workspace">
      <div className="performance-heading">
        <div><div className="eyebrow">Four quarters later / Stage {stageNumber} of {state?.rail.length ?? 14}</div><h1 className="performance-title">Fund IV performance</h1><p className="performance-subtitle">The outcomes of the companies you selected, with the decisions and exclusions that led here.</p></div>
        <div className="performance-reveal-pill"><span className="performance-reveal-dot" /> Outcome revealed <strong>Complete</strong></div>
      </div>

      <section className="performance-metrics-grid">
        <div className="performance-metric-card"><span className="eyebrow">Deployed</span><strong>{money(fund.deployed_usd)}</strong><small>Capital committed across {fund.cheques} cheques</small></div>
        <div className="performance-metric-card"><span className="eyebrow">Returned</span><strong>{money(fund.returned_usd)}</strong><small>Capital returned after four quarters</small></div>
        <div className={`performance-metric-card ${fund.net_usd >= 0 ? "positive" : "negative"}`}><span className="eyebrow">Net result</span><strong>{money(fund.net_usd)}</strong><small>Returned less deployed capital</small></div>
        <div className="performance-metric-card emphasis"><span className="eyebrow">Hit rate</span><strong>{fund.hits} / {fund.cheques}</strong><small>Selected investments marked successful</small></div>
      </section>

      <section className="performance-outcomes-panel">
        <div className="performance-panel-header"><div><div className="eyebrow">Investment outcomes</div><h2>What happened to your cheques?</h2></div><span className="performance-panel-meta">{fund.rows.length} real positions</span></div>
        <div className="performance-outcomes-content"><div className="performance-chart-area"><BarChart chartId="results.outcomes" bars={fund.rows.map((row) => ({ label: row.name.slice(0, 10), value: Math.round(row.returned_usd / 1e6), color: row.outcome === "Success" ? COLORS.GREEN : COLORS.RED }))} ariaLabel="Returned capital by investment" /><p className="performance-chart-caption">Returned capital, $M per cheque. Green bars are successes; red bars are write-offs or non-success outcomes.</p></div><div className="performance-outcome-summary"><div className="performance-outcome-summary-number">{successes.length}<span> / {fund.rows.length}</span></div><div className="eyebrow">Successful positions</div><div className="performance-mini-rail"><i style={{ width: `${fund.rows.length ? (successes.length / fund.rows.length) * 100 : 0}%` }} /><i style={{ width: `${fund.rows.length ? (writeOffs.length / fund.rows.length) * 100 : 0}%` }} /></div><div className="performance-mini-legend"><span><i className="success-dot" /> Success</span><span><i className="writeoff-dot" /> Other outcome</span></div></div></div>
      </section>

      <div className="performance-section-label"><div><div className="eyebrow">Decision debrief</div><h2>Your five decisions</h2></div><span>{successes.length} successful · {writeOffs.length} other outcome</span></div>
      <section className="performance-decision-grid">
        {fund.rows.map((row) => {
          const success = row.outcome === "Success";
          return <article className={`performance-decision-card ${success ? "success" : "writeoff"}`} key={row.id}><div className="performance-decision-symbol"><CompanySymbol seed={row.id} size={46} /></div><div className="performance-decision-main"><div className="performance-decision-top"><strong>{row.name}</strong><span className={success ? "success-text" : "writeoff-text"}>{success ? <><IconCheck size={11} /> Success</> : row.outcome}</span></div><span className="performance-decision-meta">{row.sector} · cheque {money(row.cheque_usd)}</span><div className="performance-decision-return"><span>Returned</span><strong>{money(row.returned_usd)}</strong></div></div></article>;
        })}
      </section>

      {passedCount > 0 && <section className="performance-missed-panel"><div className="performance-missed-mark"><IconTrendUp size={18} /></div><div><div className="eyebrow">You passed on these. They worked.</div><h2>{passedCount} excluded compan{passedCount === 1 ? "y" : "ies"} had a successful outcome.</h2><p>{fund.missed_winners.map((winner) => `${winner.name} (${winner.sector})`).join(" · ")}</p></div></section>}

      <section className="performance-method-panel"><div className="eyebrow">Methodology note</div><h2>This number is not scored</h2><p>{fund.note}</p></section>

      <div className="performance-action-rail"><div><span className="eyebrow">Next stage</span><strong>See what happened</strong><span>Compare the financial outcome with the reasoning that produced it.</span></div><button className="pri" onClick={() => navigate("debrief")} disabled={navBusy}>{navBusy ? "Loading…" : "See what happened"}<IconArrowRight size={14} /></button></div>
    </div>
  );
}
