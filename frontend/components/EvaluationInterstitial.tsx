"use client";

import { useEffect, useMemo, useState } from "react";
import { IconArrowRight, IconCheck } from "@/components/Icon";
import { money } from "@/lib/format";

export interface EvaluationCompany {
  id: number;
  name: string;
  cheque: number;
}

interface EvaluationInterstitialProps {
  companies: EvaluationCompany[];
  total: number;
  onContinue: () => void;
}

const STAGES = [
  "Recording allocation",
  "Checking realized outcomes",
  "Running portfolio comparison",
  "Preparing performance brief",
];

export default function EvaluationInterstitial({ companies, total, onContinue }: EvaluationInterstitialProps) {
  const [stage, setStage] = useState(0);
  const complete = stage === STAGES.length;

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStage(1), 650),
      window.setTimeout(() => setStage(2), 1950),
      window.setTimeout(() => setStage(3), 3400),
      window.setTimeout(() => setStage(4), 5000),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const progress = useMemo(() => (stage / STAGES.length) * 100, [stage]);

  return (
    <section className="evaluation-screen fade" aria-live="polite">
      <div className="evaluation-topline">
        <div className="evaluation-confirmed">
          <span className="evaluation-document" aria-hidden="true">▤</span>
          <span><strong>Deployment confirmed</strong><small>{companies.length} cheques&nbsp;&nbsp;|&nbsp;&nbsp;Total {money(total)}</small></span>
        </div>
        <div className="evaluation-timestamp"><span>Deployed at</span><strong>Today&nbsp;&nbsp;|&nbsp;&nbsp;Now</strong></div>
      </div>

      <div className="eyebrow evaluation-eyebrow">{complete ? "Review complete" : "Post-deployment review"}</div>
      <h1 className="evaluation-title">{complete ? "The allocation has been evaluated." : "Your allocation is being evaluated."}</h1>
      <p className="evaluation-subtitle">
        {complete
          ? "Your selected companies have been compared with the realized portfolio record."
          : "Comparing your choices against the companies’ realized outcomes."}
      </p>

      <div className="evaluation-progress-row">
        <div className="evaluation-progress-track"><span style={{ width: `${progress}%` }} /></div>
        <strong>{Math.round(progress)}%</strong>
      </div>

      {!complete ? (
        <div className="evaluation-grid">
          <div>
            <div className="eyebrow evaluation-section-label">Evaluation stages</div>
            <div className="evaluation-stage-list">
              {STAGES.map((label, index) => {
                const done = index < stage;
                const active = index === stage;
                return (
                  <div className={`evaluation-stage ${active ? "active" : ""}`} key={label}>
                    <span className={`evaluation-stage-mark ${done ? "done" : active ? "working" : "queued"}`} aria-hidden="true">
                      {done ? <IconCheck size={14} /> : active ? <i /> : null}
                    </span>
                    <span className="evaluation-stage-name">{index + 1}.&nbsp;&nbsp;{label}</span>
                    <span className="evaluation-stage-status">{done ? "Completed" : active ? "In progress" : "Queued"}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="eyebrow evaluation-section-label">Selected companies ({companies.length})</div>
            <div className="evaluation-company-list">
              {companies.map((company, index) => (
                <div className="evaluation-company" key={company.id}>
                  <span className="evaluation-company-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="evaluation-company-name">{company.name}</span>
                  <span className="evaluation-company-status"><i /> Reviewing</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="evaluation-complete-panel">
          <div className="eyebrow evaluation-section-label">Allocation summary</div>
          <div className="evaluation-complete-grid">
            {companies.map((company, index) => (
              <div className="evaluation-complete-row" key={company.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{company.name}</strong>
                <span className="mono">{money(company.cheque)}</span>
                <span className="evaluation-reviewed">Reviewed</span>
              </div>
            ))}
          </div>
          <button className="pri evaluation-continue" type="button" onClick={onContinue}>
            <span>View performance</span><IconArrowRight size={15} />
          </button>
          <p className="evaluation-continue-note">Open the performance brief when ready.</p>
        </div>
      )}

      {!complete && <div className="evaluation-footnote"><span aria-hidden="true">◷</span> This may take a moment.</div>}
    </section>
  );
}
