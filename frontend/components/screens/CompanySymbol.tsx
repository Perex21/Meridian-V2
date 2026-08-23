"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, COLORS } from "@/components/Chart";
import { IconArrowRight, IconCheck, IconLock } from "@/components/Icon";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";

interface EvidenceRow {
  feature: string; label: string;
  supporting: number; supporting_pct: number;
  contradicting: number; contradicting_pct: number;
  visible_lift: number;
}

interface EvidenceData {
  rows: EvidenceRow[];
  portfolio_count: number; archive_count: number; combined_count: number;
  share_of_evidence_seen: number;
  thesis_confidence: Record<string, number>;
}

export default function Evidence() {
  const { sessionId, state } = useStore();
  const [navBusy, navigate] = useNav();
  const [data, setData] = useState<EvidenceData | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    api.get<EvidenceData>(`/sessions/${sessionId}/evidence`).then(setData).catch(() => {});
  }, [sessionId]);

  // The archive comparison arrives on a beat after the visible portfolio
  // figure, preserving the current reveal mechanic without inventing data.
  useEffect(() => {
    if (!data) return;
    const id = setTimeout(() => setRevealed(true), 900);
    return () => clearTimeout(id);
  }, [data]);

  const stageIndex = state?.rail.findIndex((stage) => stage.key === "evidence") ?? 7;
  const stageNumber = stageIndex + 1;
  const archiveShare = Math.max(0, 100 - data?.share_of_evidence_seen!);
  const strongestDifference = useMemo(() => {
    if (!data?.rows.length) return null;
    return [...data.rows].sort((a, b) => Math.abs(b.supporting_pct - b.contradicting_pct) - Math.abs(a.supporting_pct - a.contradicting_pct))[0];
  }, [data]);

  if (!data) return <p className="note">Loading the evidence board…</p>;

  return (
    <div className="evidence-workspace">
      <div className="evidence-heading">
        <div>
          <div className="eyebrow">Evidence board / Stage {stageNumber} of {state?.rail.length ?? 14}</div>
          <h1 className="evidence-title">Your claims against the full record</h1>
          <p className="evidence-subtitle">Portfolio history and recovered archive, combined. The point is not to reward the first pattern you saw—it is to test whether it survives the full record.</p>
        </div>
        <div className={`evidence-state-pill${revealed ? " is-revealed" : ""}`}>
          {revealed ? <IconCheck size={13} /> : <IconLock size={13} />}
          {revealed ? "Full record available" : "Archive arriving"}
        </div>
      </div>

      <section className="evidence-overview-grid">
        <div className="evidence-stat-card"><span className="eyebrow">Portfolio / backed</span><strong>{data.portfolio_count.toLocaleString("en-IN")}</strong><small>Visible companies</small></div>
        <div className="evidence-stat-card"><span className="eyebrow">Archive / failed</span><strong>{data.archive_count.toLocaleString("en-IN")}</strong><small>Recovered companies</small></div>
        <div className="evidence-stat-card"><span className="eyebrow">Combined record</span><strong>{data.combined_count.toLocaleString("en-IN")}</strong><small>Full evidence universe</small></div>
        <div className="evidence-stat-card emphasis"><span className="eyebrow">You worked from</span><strong>{data.share_of_evidence_seen}%</strong><small>of the combined record</small></div>
      </section>

      <section className="evidence-comparison-panel">
        <div className="evidence-panel-header"><div><div className="eyebrow">Record comparison</div><h2>What you had vs. what existed</h2></div><span className="evidence-panel-meta">{revealed ? "Archive revealed" : "Visible record first"}</span></div>
        <div className="evidence-comparison-content">
          <div className="evidence-bar-area">
            <BarChart
              chartId="evidence.win_rate"
              bars={[{ label: "Portfolio", value: data.portfolio_count, color: COLORS.GREEN }, { label: "Archive", value: data.archive_count, color: COLORS.RED }]}
              ariaLabel="Portfolio versus archive record counts"
            />
          </div>
          <div className="evidence-comparison-readout"><div className="evidence-readout-number">{data.share_of_evidence_seen}%</div><div className="eyebrow">Visible share</div><p>The companies you could study before the archive arrived represented {data.share_of_evidence_seen}% of the combined record.</p><div className="evidence-mini-rail"><i style={{ width: `${data.share_of_evidence_seen}%` }} /><i style={{ width: `${archiveShare}%` }} /></div><div className="evidence-mini-legend"><span><i className="portfolio-dot" /> Portfolio</span><span><i className="archive-dot" /> Archive</span></div></div>
        </div>
      </section>

      <div className="evidence-section-label"><div><div className="eyebrow">Evidence readout</div><h2>Which claims survived the full record?</h2></div><span>{data.rows.length} variable{data.rows.length === 1 ? "" : "s"} in your thesis</span></div>
      <div className="evidence-claims-grid">
        {data.rows.map((row) => {
          const liftTone = row.visible_lift >= 1.5 ? "positive" : row.visible_lift <= 0.9 ? "negative" : "neutral";
          return (
            <article className="evidence-claim-card" key={row.feature}>
              <div className="evidence-claim-card-top"><span className="evidence-claim-index">{String(data.rows.indexOf(row) + 1).padStart(2, "0")}</span><span className={`evidence-lift ${liftTone}`}>{row.visible_lift.toFixed(2)}x lift</span></div>
              <h3>{row.label}</h3>
              <p className="evidence-claim-caption">How often this variable appeared in the visible portfolio versus the recovered archive.</p>
              <div className="evidence-measure"><div className="evidence-measure-label"><span>Supporting / portfolio</span><strong>{row.supporting.toLocaleString("en-IN")} · {row.supporting_pct}%</strong></div><div className="evidence-measure-bar"><i className="supporting" style={{ width: `${row.supporting_pct}%` }} /></div></div>
              {revealed ? <div className="evidence-measure"><div className="evidence-measure-label"><span>Contradicting / archive</span><strong>{row.contradicting.toLocaleString("en-IN")} · {row.contradicting_pct}%</strong></div><div className="evidence-measure-bar"><i className="contradicting" style={{ width: `${row.contradicting_pct}%` }} /></div></div> : <div className="evidence-locked-row"><IconLock size={11} /> Archive comparison is arriving…</div>}
              <div className="evidence-claim-footer"><span>Lift compares occurrence rates</span><span className={liftTone}>{row.visible_lift >= 1.5 ? "Stronger signal" : row.visible_lift <= 0.9 ? "Weak signal" : "Mixed signal"}</span></div>
            </article>
          );
        })}
      </div>

      <section className="evidence-interpretation-panel"><div className="evidence-interpretation-mark">{strongestDifference ? <span>↗</span> : <IconLock size={19} />}</div><div><div className="eyebrow">What this evidence says</div><h2>{strongestDifference ? `${strongestDifference.label} is now testable against the full record.` : "Your variables are ready for comparison."}</h2><p>{revealed ? "A trait can look common among winners and still fail to distinguish winners from the full record. Read the supporting and contradicting rates together before you build the scoring model." : "The visible portfolio shows prevalence first. The archive comparison will appear once the recovered record is available."}</p></div></section>

      <div className="evidence-action-rail"><div><span className="eyebrow">Next stage</span><strong>Build scoring model</strong><span>Turn the evidence you chose into a transparent scoring rule.</span></div><button className="pri" onClick={() => navigate("model")} disabled={navBusy}>{navBusy ? "Loading…" : "Build scoring model"}<IconArrowRight size={14} /></button></div>
    </div>
  );
}
