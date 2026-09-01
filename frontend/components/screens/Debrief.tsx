"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, COLORS } from "@/components/Chart";
import { IconArrowRight, IconCheck, IconLock, IconTrendUp } from "@/components/Icon";
import { api, type DebriefData } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";

const CLASS_NAMES: Record<string, string> = {
  A: "Genuinely causal",
  B: "Survivorship trap — equally common in failures",
  C: "Reverse trap — more common in failures",
  D: "Noise — unrelated to outcome",
};

const CLASS_TONES: Record<string, string> = { A: "positive", B: "trap", C: "negative", D: "neutral" };

export default function Debrief() {
  const { sessionId, state } = useStore();
  const [navBusy, navigate] = useNav();
  const [data, setData] = useState<DebriefData | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    api.get<DebriefData>(`/sessions/${sessionId}/debrief`).then(setData).catch(() => {});
  }, [sessionId]);

  const stageIndex = state?.rail.findIndex((stage) => stage.key === "debrief") ?? 11;
  const stageNumber = stageIndex + 1;
  const strongestCausal = useMemo(() => data?.causal_variables[0] ?? null, [data]);
  const strongestTrap = useMemo(() => data?.naive_top5.find((row) => row.class === "B") ?? data?.naive_top5[0] ?? null, [data]);

  if (!data) return <p className="note">Assembling the debrief…</p>;

  return (
    <div className="debrief-workspace">
      <div className="debrief-heading">
        <div><div className="eyebrow">Debrief / Stage {stageNumber} of {state?.rail.length ?? 14}</div><h1 className="debrief-title">What you believed, and what was true</h1><p className="debrief-subtitle">None of this is scored. It is the part that matters: separating a pattern that was visible from a signal that actually separated outcomes.</p></div>
        <div className="debrief-state-pill"><IconCheck size={13} /> Analysis complete <strong>Reflection</strong></div>
      </div>

      <nav className="debrief-chapter-rail" aria-label="Debrief sections"><a href="#your-thesis">01 Thesis</a><a href="#what-fooled-you">02 Frequency trap</a><a href="#what-separated">03 True signals</a><a href="#simulation-proof">04 Simulation proof</a><a href="#archive-limit">05 Archive limit</a></nav>

      <section id="your-thesis" className="debrief-verdict-panel"><div className="debrief-verdict-mark"><IconTrendUp size={21} /></div><div className="debrief-verdict-copy"><div className="eyebrow">Your thesis / full-record verdict</div><h2>{data.mirror.length ? (data.mirror[0].class === "A" ? "Your first signal held up." : data.mirror[0].class === "B" ? "Your first signal was a survivorship trap." : "Your first signal needs a second look.") : "Your recorded thesis"}</h2><p>{data.mirror.length ? "The comparison below shows what you said, how often the trait appeared among winners and failures, and what the complete record says it actually was." : "No thesis comparison is available in the current session."}</p></div><div className="debrief-verdict-stats"><strong>{data.mirror.length}</strong><span>thesis variable{data.mirror.length === 1 ? "" : "s"} reviewed</span></div></section>

      <section className="debrief-section" aria-labelledby="thesis-table-title"><div className="debrief-section-heading"><div><div className="eyebrow">Thesis mirror</div><h2 id="thesis-table-title">Your call against the full record</h2></div><span>Visible confidence vs. actual separation</span></div><div className="debrief-table-wrap"><table className="debrief-table"><thead><tr><th>Your variable</th><th className="r">You said</th><th className="r">In winners</th><th className="r">In failures</th><th>What it actually was</th></tr></thead><tbody>{data.mirror.map((row) => <tr key={row.feature}><td><strong>{row.label}</strong></td><td className="r mono">{row.stated_confidence}%</td><td className="r mono">{row.pct_winners}%</td><td className="r mono">{row.pct_failures_complete}%</td><td><span className={`debrief-class debrief-tone-${CLASS_TONES[row.class]}`}>{CLASS_NAMES[row.class]}</span></td></tr>)}</tbody></table></div></section>

      {data.falsification && <section className="debrief-falsification"><div className="eyebrow">You said this would change your mind</div><blockquote>“{data.falsification}”</blockquote><span>Recorded before the full record was revealed.</span></section>}

      <section id="what-fooled-you" className="debrief-section debrief-trap-section"><div className="debrief-section-heading"><div><div className="eyebrow">01 / What fooled you</div><h2>Common among winners is not the same as predictive</h2></div><span className="debrief-section-kicker trap">Frequency can hide the trap</span></div><p className="debrief-explainer">These were the attributes most common among winners. The comparison with failures shows whether that visibility survived.</p><div className="debrief-frequency-list">{data.naive_top5.map((row) => <div className="debrief-frequency-row" key={row.feature}><span className="debrief-rank">{row.rank_by_frequency}</span><strong>{row.label}</strong><span className="debrief-frequency-bar"><i style={{ width: `${row.pct_winners}%` }} /></span><span className="mono debrief-frequency-value">{row.pct_winners}%</span></div>)}</div><p className="debrief-footnote">Every one of the most common attributes among winners was just as common among companies that failed. They looked like a pattern because you could only see the winners.</p></section>

      <section id="what-separated" className="debrief-section debrief-signal-section"><div className="debrief-section-heading"><div><div className="eyebrow">02 / What actually separated outcomes</div><h2>The useful signals were deliberately uncommon</h2></div><span className="debrief-section-kicker positive">Comparison reveals separation</span></div><div className="debrief-signal-grid">{data.causal_variables.map((row) => <article className="debrief-signal-card" key={row.feature}><div className="debrief-signal-top"><span className="debrief-signal-index">{String(row.rank_by_frequency).padStart(2, "0")}</span></div><h3>{row.label}</h3><div className="debrief-signal-bar"><i style={{ width: `${row.pct_winners}%` }} /></div><div className="debrief-signal-meta"><span>{row.pct_winners}% of winners</span><span>Frequency rank #{row.rank_by_frequency}</span></div><p>Its value appears when winners are compared with failures, not when winners are ranked alone.</p></article>)}</div><p className="debrief-footnote">{strongestCausal ? `${strongestCausal.label} is one of the signals that only becomes legible against the complete record.` : "The causal variables become legible only after comparison."}</p></section>

      <section className="debrief-section"><div className="debrief-section-heading"><div><div className="eyebrow">03 / The metric blind spot</div><h2>What you could not read without a comparison group</h2></div><span>Winners vs. failures</span></div><div className="debrief-metric-grid">{data.continuous_truth.map((metric) => { const scale = metric.unit === "pct" ? 100 : 1; const suffix = metric.unit === "pct" ? "%" : " mo"; const gap = Math.abs((metric.win_median - metric.fail_median) * scale); return <article className="debrief-metric-card" key={metric.key}><h3>{metric.label}</h3><div className="debrief-metric-values"><div><span>Winners</span><strong>{(metric.win_median * scale).toFixed(1)}{suffix}</strong></div><div><span>Failures</span><strong>{(metric.fail_median * scale).toFixed(1)}{suffix}</strong></div><div className="debrief-metric-gap"><span>Gap</span><strong>{gap.toFixed(1)}{suffix}</strong></div></div><div className="debrief-metric-rail"><i style={{ width: `${Math.min(100, Math.max(0, metric.win_median * scale))}%` }} /><i style={{ width: `${Math.min(100, Math.max(0, metric.fail_median * scale))}%` }} /></div></article>; })}</div></section>

      <section id="simulation-proof" className="debrief-section debrief-simulation-section"><div className="debrief-section-heading"><div><div className="eyebrow">04 / Simulation proof</div><h2>What the strategy does over repeated funds</h2></div><span>20,000 simulated funds of five picks</span></div><BarChart chartId="debrief.fund_distribution" bars={data.fund_distribution.map((distribution) => ({ label: distribution.strategy.includes("causal") ? "Causal" : distribution.strategy.includes("trap") ? "Traps" : "Random", value: distribution.mean_wins, color: distribution.strategy.includes("causal") ? COLORS.GREEN : distribution.strategy.includes("trap") ? COLORS.RED : COLORS.NAVY }))} max={5} ariaLabel="Mean wins per fund by strategy" /><div className="debrief-simulation-table"><div className="debrief-simulation-head"><span>Strategy</span><span>Mean wins / 5</span><span>P(zero wins)</span><span>P(3+ wins)</span></div>{data.fund_distribution.map((distribution) => <div className="debrief-simulation-row" key={distribution.strategy}><strong>{distribution.strategy}</strong><span className="mono">{distribution.mean_wins}</span><span className="mono">{distribution.p_zero_wins}%</span><span className="mono">{distribution.p_three_plus}%</span></div>)}</div><p className="debrief-footnote">A strategy built on trap variables performs worse than picking at random. Five picks is a small number, so even a sound strategy can blank sometimes.</p></section>

      <section id="archive-limit" className="debrief-archive-panel"><div className="debrief-archive-mark"><IconLock size={18} /></div><div><div className="eyebrow">05 / One more thing about the archive</div><h2>The recovered record is not the complete record</h2><p>{data.withhold_note}</p></div><div className="debrief-archive-stats"><div><span>Portfolio</span><strong>{data.portfolio_count.toLocaleString("en-IN")}</strong></div><div><span>Archive you got</span><strong>{data.archive_visible.toLocaleString("en-IN")}</strong></div><div><span>Failures that existed</span><strong>{data.archive_complete.toLocaleString("en-IN")}</strong></div><div><span>Still missing</span><strong className="warning">{data.withheld_count.toLocaleString("en-IN")}</strong></div></div><small>Your thesis was formed on {data.share_of_evidence_seen}% of the total evidence.</small></section>

      <div className="debrief-action-rail"><div><span className="eyebrow">Next stage</span><strong>See your analyst scorecard</strong><span>The debrief is not scored; the scorecard explains how you reasoned.</span></div><button className="pri" onClick={() => navigate("scorecard")} disabled={navBusy}>{navBusy ? "Loading…" : "See your analyst scorecard"}<IconArrowRight size={14} /></button></div>
    </div>
  );
}
