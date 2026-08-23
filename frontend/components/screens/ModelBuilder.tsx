"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart, COLORS } from "@/components/Chart";
import { IconArrowRight, IconCheck, IconTrendUp } from "@/components/Icon";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";

interface WeightVar { key: string; label: string; weight: number; baseline: number; in_thesis: boolean }
interface Backtest { top_n: number; success_rate: number; baseline_rate: number; sample_size: number; lift_vs_random: number }

export default function ModelBuilder() {
  const { sessionId, refreshState, state } = useStore();
  const [navBusy, navigate] = useNav();
  const [vars, setVars] = useState<WeightVar[]>([]);
  const [range, setRange] = useState({ min: -3, max: 3, step: 0.5 });
  const [backtest, setBacktest] = useState<Backtest | null>(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoadingModel(true);
    api
      .get<{ variables: WeightVar[]; range: typeof range }>(`/sessions/${sessionId}/model`)
      .then((response) => { setVars(response.variables); setRange(response.range); })
      .catch(() => {})
      .finally(() => setLoadingModel(false));
  }, [sessionId]);

  const runBacktest = useCallback(async () => {
    if (!sessionId) return;
    setBacktest(await api.get<Backtest>(`/sessions/${sessionId}/model/backtest`));
  }, [sessionId]);

  useEffect(() => { if (vars.length) void runBacktest(); }, [vars.length, runBacktest]);

  function setWeight(key: string, value: number) {
    setVars((current) => current.map((variable) => (variable.key === key ? { ...variable, weight: value } : variable)));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!sessionId) return;
      await api.put(`/sessions/${sessionId}/model/weights`, { weights: { [key]: value } });
      await runBacktest();
      await refreshState();
    }, 260);
  }

  const changed = vars.filter((variable) => variable.weight !== variable.baseline).length;
  const thesisVars = vars.filter((variable) => variable.in_thesis);
  const optionalVars = vars.filter((variable) => !variable.in_thesis);
  const stageIndex = state?.rail.findIndex((stage) => stage.key === "model") ?? 8;
  const stageNumber = stageIndex + 1;
  const modelReady = Boolean(backtest && vars.length);

  const renderWeightRow = (variable: WeightVar) => {
    const fill = ((variable.weight - range.min) / (range.max - range.min)) * 100;
    return (
      <div className={`model-weight-row${variable.in_thesis ? " is-thesis" : ""}`} key={variable.key}>
        <div className="model-weight-label"><span className="model-weight-marker">{variable.in_thesis ? <IconCheck size={10} /> : ""}</span><strong>{variable.label}</strong></div>
        <input type="range" min={range.min} max={range.max} step={range.step} value={variable.weight} className="green-slider" style={{ "--fill": `${fill}%` } as React.CSSProperties} onChange={(event) => setWeight(variable.key, Number(event.target.value))} aria-label={`Weight for ${variable.label}`} />
        <span className="model-weight-value">{variable.weight > 0 ? `+${variable.weight.toFixed(1)}` : variable.weight.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="model-workspace">
      <div className="model-heading">
        <div><div className="eyebrow">Model builder / Stage {stageNumber} of {state?.rail.length ?? 14}</div><h1 className="model-title">Scoring model</h1><p className="model-subtitle">Turn the evidence you chose into a transparent ranking rule. Your thesis variables begin with their recorded baseline weights; every other variable starts at zero.</p></div>
        <div className={`model-state-pill${modelReady ? " is-ready" : ""}`}><span className="model-state-dot" />{modelReady ? "Model ready" : "Loading model"}<strong>{changed ? `${changed} changed` : "Draft"}</strong></div>
      </div>

      <section className="model-rule-banner"><div className="model-rule-icon"><IconTrendUp size={20} /></div><div><div className="eyebrow">Decision rule</div><h2>Change your mind deliberately</h2><p>Positive weights favor a company in the ranking. Negative weights count against it. Every adjustment is saved to this run and re-evaluated against held-out data.</p></div><div className="model-rule-summary"><strong>{vars.length}</strong><span>variables in model</span></div></section>

      <div className="model-main-grid">
        <section className="model-weights-panel">
          <div className="model-panel-header"><div><div className="eyebrow">Weight editor</div><h2>Build your ranking rule</h2></div><span className="model-panel-meta">Range {range.min} to +{range.max}</span></div>
          {loadingModel ? <div className="model-empty-state">Loading server-defined weights…</div> : <>
            <div className="model-group-heading"><span>Your thesis variables</span><strong>{thesisVars.length}</strong></div>
            <div className="model-weight-list">{thesisVars.length ? thesisVars.map(renderWeightRow) : <p className="model-empty-inline">No thesis variables were recorded for this run.</p>}</div>
            <div className="model-group-heading optional"><span>Other available variables</span><strong>{optionalVars.length}</strong></div>
            <div className="model-weight-list optional-list">{optionalVars.map(renderWeightRow)}</div>
          </>}
        </section>

        <section className="model-evaluation-panel">
          <div className="model-panel-header"><div><div className="eyebrow">Held-out evaluation</div><h2>Does the rule improve selection?</h2></div><span className="model-panel-meta">Server backtest</span></div>
          <p className="model-panel-intro">This comparison uses the evaluation population returned by the model service, not a decorative score.</p>
          {backtest ? <>
            <BarChart chartId="model.accuracy" bars={[{ label: "Your model", value: backtest.success_rate, color: COLORS.GREEN }, { label: "Random baseline", value: backtest.baseline_rate, color: COLORS.NAVY }]} max={100} suffix="%" ariaLabel="Held-out success rate for the model against the random baseline" />
            <div className="model-eval-stats"><div><span>Top {backtest.top_n} by model</span><strong>{backtest.success_rate}%</strong><small>success rate</small></div><div><span>Random baseline</span><strong>{backtest.baseline_rate}%</strong><small>success rate</small></div><div><span>Evaluation set</span><strong>{backtest.sample_size.toLocaleString("en-IN")}</strong><small>held-out companies</small></div></div>
            <div className="model-lift-callout"><IconTrendUp size={15} /><span><strong>{backtest.lift_vs_random.toFixed(2)}x</strong> the random baseline on the server-projected evaluation set.</span></div>
          </> : <div className="model-empty-state">Running held-out evaluation…</div>}
        </section>
      </div>

      <section className="model-revision-panel"><div className="model-revision-icon">{changed ? "↗" : "—"}</div><div><div className="eyebrow">Model state</div><h2>{changed === 0 ? "Using your original thesis weights" : `${changed} weight${changed === 1 ? "" : "s"} moved from the thesis baseline`}</h2><p>{changed === 0 ? "The model currently reflects the variables and confidence you recorded in your thesis." : "Changing your mind is not penalised. The backtest above updates as each saved weight changes."}</p></div><span className="model-revision-badge">{changed ? "Unsaved changes settle automatically" : "Baseline preserved"}</span></section>

      <div className="model-action-rail"><div><span className="eyebrow">Next stage</span><strong>Apply model to Deal Flow</strong><span>Use this rule to rank the real companies in your current session.</span></div><button className="pri" onClick={() => navigate("dealflow")} disabled={navBusy || !modelReady}>{navBusy ? "Loading…" : "Apply model to deal flow"}<IconArrowRight size={14} /></button></div>
    </div>
  );
}
