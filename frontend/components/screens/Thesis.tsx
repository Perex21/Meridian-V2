"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, api, type VariableEvidence } from "@/lib/api";
import { IconArrowRight, IconCheck, IconLock, IconUnlock } from "@/components/Icon";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";

export default function Thesis() {
  const { sessionId, config, state, refreshState, toast } = useStore();
  const [navBusy, navigate] = useNav();
  const [selected, setSelected] = useState<string[]>(state?.thesis_variables ?? []);
  const [confidence, setConfidence] = useState<Record<string, number>>(state?.thesis_confidence ?? {});
  const [falsification, setFalsification] = useState(state?.falsification ?? "");
  const [evidence, setEvidence] = useState<VariableEvidence | null>(null);
  const [busy, setBusy] = useState(false);

  const locked = state?.thesis_locked ?? false;
  const max = config?.max_thesis_variables ?? 4;
  const variables = config?.variables ?? [];
  const labelOf = (key: string) => variables.find((v) => v.key === key)?.label ?? key;
  const rowFor = (key: string) => evidence?.rows.find((row) => row.key === key);
  const stageIndex = state?.rail.findIndex((stage) => stage.key === "thesis") ?? 3;
  const stageNumber = stageIndex + 1;

  const loadEvidence = useCallback(async () => {
    if (!sessionId) return;
    setEvidence(await api.get<VariableEvidence>(`/sessions/${sessionId}/variables`));
  }, [sessionId]);

  useEffect(() => { void loadEvidence(); }, [loadEvidence, state?.archive_unlocked]);

  useEffect(() => {
    if (!state) return;
    setSelected(state.thesis_variables ?? []);
    setConfidence(state.thesis_confidence ?? {});
    setFalsification(state.falsification ?? "");
  }, [state?.thesis_locked]);

  function toggle(key: string) {
    if (locked) return;
    if (selected.includes(key)) {
      setSelected(selected.filter((k) => k !== key));
    } else if (selected.length < max) {
      setSelected([...selected, key]);
      setConfidence((current) => ({ ...current, [key]: current[key] ?? 60 }));
    } else {
      toast("Limit reached", `Choose at most ${max} variables.`);
    }
  }

  async function lock() {
    if (!sessionId) return;
    if (!selected.length) {
      toast("Field required", "Select at least one variable before locking.");
      return;
    }
    if (!falsification.trim()) {
      toast("Field required", "State what evidence would change your mind.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/sessions/${sessionId}/thesis`, {
        variables: selected,
        confidence: Object.fromEntries(selected.map((key) => [key, confidence[key] ?? 60])),
        falsification,
      });
      await refreshState();
      toast("Thesis locked", "Presenting to the investment committee.");
      await navigate("committee");
    } catch (err) {
      toast("Could not lock", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  const selectedRows = useMemo(
    () => selected.map((key) => ({ key, row: rowFor(key), confidence: confidence[key] ?? 60 })),
    [selected, confidence, evidence],
  );

  return (
    <div className="thesis-workspace">
      <div className="thesis-heading">
        <div>
          <div className="eyebrow">Thesis / Stage {stageNumber} of {state?.rail.length ?? 14}</div>
          <h1 className="thesis-title">Investment thesis</h1>
          <p className="thesis-subtitle">Choose the variables you believe matter, inspect the evidence behind them, and commit once.</p>
        </div>
        <div className={`thesis-state-pill${locked ? " is-locked" : ""}`}>
          {locked ? <IconLock size={13} /> : <IconUnlock size={13} />}
          {locked ? "Thesis locked" : "Thesis open"}
        </div>
      </div>

      <section className="thesis-decision-banner">
        <div className="thesis-decision-mark">{locked ? <IconLock size={21} /> : <span>01</span>}</div>
        <div>
          <div className="eyebrow">Decision rule</div>
          <h2>{locked ? "Your thesis is on the record" : "Select up to " + max + " of " + variables.length + " traits"}</h2>
          <p>{locked ? "This decision is preserved by the simulation and cannot be changed." : "State a confidence level for each selected trait, write what would change your mind, and lock once."}</p>
        </div>
        <div className="thesis-counter"><strong>{selected.length.toString().padStart(2, "0")} / {max.toString().padStart(2, "0")}</strong><span>traits selected</span></div>
      </section>

      <div className="thesis-main-grid">
        <section className="thesis-panel variable-panel">
          <div className="thesis-panel-header">
            <div><div className="eyebrow">Available variables</div><h2>What might matter?</h2></div>
            <span className="thesis-panel-meta">{variables.length} available</span>
          </div>
          <p className="thesis-panel-intro">Select a trait to inspect its observed prevalence across the portfolio.</p>
          <div className="variable-grid">
            {variables.map((variable, index) => {
              const chosen = selected.includes(variable.key);
              const row = rowFor(variable.key);
              return (
                <button key={variable.key} className={`variable-card${chosen ? " is-selected" : ""}`} onClick={() => toggle(variable.key)} disabled={locked}>
                  <span className="variable-card-top"><span className="variable-index">{String(index + 1).padStart(2, "0")}</span>{chosen ? <span className="variable-selected"><IconCheck size={11} /> Selected</span> : <span className="variable-add">Add to thesis</span>}</span>
                  <strong>{variable.label}</strong>
                  <span className="variable-card-foot">{row ? `${row.pct_portfolio}% of portfolio` : "Evidence available on selection"}</span>
                  {row && <span className="variable-card-bar"><i style={{ width: `${Math.min(100, Math.max(0, row.pct_portfolio))}%` }} /></span>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="thesis-panel selected-panel">
          <div className="thesis-panel-header">
            <div><div className="eyebrow">Your thesis</div><h2>{locked ? "Locked variables" : "Build your position"}</h2></div>
            <span className="thesis-panel-meta">{selected.length} / {max}</span>
          </div>
          {!selectedRows.length ? (
            <div className="thesis-empty-state"><div className="thesis-empty-icon"><IconUnlock size={21} /></div><strong>Select a variable to begin</strong><p>The evidence and confidence controls will appear here.</p></div>
          ) : (
            <div className="selected-variable-list">
              {selectedRows.map(({ key, row, confidence: conf }, index) => (
                <div className="selected-variable" key={key}>
                  <div className="selected-variable-heading"><span className="selected-variable-number">{String(index + 1).padStart(2, "0")}</span><strong>{labelOf(key)}</strong>{!locked && <button className="selected-remove" onClick={() => toggle(key)} aria-label={`Remove ${labelOf(key)}`}>×</button>}</div>
                  {row ? (
                    <>
                      <div className="selected-evidence-row"><span>Observed in portfolio</span><strong>{row.pct_portfolio}%</strong></div>
                      <div className="selected-evidence-bar"><i style={{ width: `${Math.min(100, Math.max(0, row.pct_portfolio))}%` }} /></div>
                      <p className="selected-evidence-note">{row.count_portfolio} of {evidence?.portfolio_count ?? "—"} portfolio companies show this trait.</p>
                    </>
                  ) : <p className="selected-evidence-note">Evidence is loading for this variable.</p>}
                  <div className="confidence-row"><span>Confidence</span><strong className="mono">{conf}%</strong></div>
                  <input type="range" min={10} max={99} step={1} value={conf} disabled={locked} style={{ "--fill": `${((conf - 10) / 89) * 100}%` } as React.CSSProperties} onChange={(event) => setConfidence({ ...confidence, [key]: Number(event.target.value) })} aria-label={`Confidence in ${labelOf(key)}`} />
                </div>
              ))}
            </div>
          )}
          {evidence && !evidence.archive_unlocked && <p className="thesis-evidence-note"><IconLock size={11} /> Prevalence is the only figure the visible portfolio can support before the archive arrives.</p>}
        </section>
      </div>

      <section className="thesis-falsification-panel">
        <div><div className="eyebrow">Falsification condition</div><h2>What evidence would change your mind?</h2><p>Name the observation that would make you drop a variable. This becomes part of the one-way thesis record.</p></div>
        <textarea id="falsify" rows={3} value={falsification} disabled={locked} placeholder="Be specific. Name the observation that would make you drop a variable." onChange={(event) => setFalsification(event.target.value)} />
      </section>

      <div className="thesis-action-rail">
        <div><span className="eyebrow">Lock readiness</span><strong>{locked ? "Decision recorded" : selected.length ? `${selected.length} of ${max} traits selected` : "Select at least one variable"}</strong><span>{locked ? "The thesis cannot be changed." : "Confidence and falsification are saved only when you lock."}</span></div>
        {!locked ? <button className="pri thesis-lock-button" disabled={selected.length === 0 || busy} onClick={lock}>{busy ? "Locking…" : "Lock thesis and present"}<IconArrowRight size={14} /></button> : <button className="pri thesis-lock-button" onClick={() => navigate("committee")} disabled={navBusy}>{navBusy ? "Opening…" : "Present to the committee"}<IconArrowRight size={14} /></button>}
      </div>
    </div>
  );
}
