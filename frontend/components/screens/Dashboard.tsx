"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, COLORS, ScatterChart } from "@/components/Chart";
import { IconArrowRight, IconLock, IconUnlock } from "@/components/Icon";
import { api, type CompanyRow } from "@/lib/api";
import { money, mult, pct } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";

async function loadAllCompanies(sessionId: string): Promise<CompanyRow[]> {
  const pageSize = 200;
  const first = await api.get<{ rows: CompanyRow[]; total: number }>(
    `/sessions/${sessionId}/companies?limit=${pageSize}&offset=0`,
  );
  const pages = await Promise.all(
    Array.from({ length: Math.ceil(Math.max(first.total - first.rows.length, 0) / pageSize) }, (_, i) => {
      const offset = (i + 1) * pageSize;
      return api.get<{ rows: CompanyRow[] }>(
        `/sessions/${sessionId}/companies?limit=${pageSize}&offset=${offset}`,
      );
    }),
  );
  return [first.rows, ...pages.map((page) => page.rows)].flat();
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="overview-stat">
      <div className="overview-stat-label">{label}</div>
      <div className="overview-stat-value mono">{value}</div>
      <div className="overview-stat-note">Computed from full company set</div>
    </div>
  );
}

export default function Dashboard() {
  const { state, sessionId } = useStore();
  const [navBusy, navigate] = useNav();
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [dataBusy, setDataBusy] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    setDataBusy(true);
    loadAllCompanies(sessionId)
      .then((next) => { if (alive) setRows(next); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setDataBusy(false); });
    return () => { alive = false; };
  }, [sessionId, state?.archive_unlocked]);

  const summary = state?.summary;
  const thesisLocked = Boolean(state?.thesis_locked);
  const stageIndex = state?.rail.findIndex((stage) => stage.key === state.current_screen) ?? -1;
  const stageNumber = stageIndex >= 0 ? stageIndex + 1 : 2;
  const currentStageLabel = state?.rail[stageIndex]?.label ?? "Dashboard";
  const thesisStageIndex = state?.rail.findIndex((stage) => stage.key === "thesis") ?? 3;
  const furthestIndex = state?.rail.findIndex((stage) => stage.key === state.furthest_screen) ?? stageIndex;
  const thesisReachable = furthestIndex >= thesisStageIndex;
  const thesisActionScreen = thesisLocked || thesisReachable ? "thesis" : "research";
  const thesisActionLabel = thesisLocked
    ? "View locked thesis"
    : thesisReachable
      ? "Open thesis builder"
      : "Continue to research";

  const sectorBars = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.sector, (counts.get(row.sector) ?? 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value, color: COLORS.PRIMARY }));
  }, [rows]);

  const maxArr = Math.max(...rows.map((row) => row.arr_usd), 1);
  const scatterPoints = rows
    .filter((row) => Number.isFinite(row.arr_usd) && Number.isFinite(row.month6_retention))
    .map((row) => [row.arr_usd, row.month6_retention * 100] as [number, number]);

  return (
    <div className="dashboard-overview">
      <div className="dashboard-heading">
        <div>
          <div className="eyebrow">Dashboard</div>
          <h1 className="dashboard-title">Portfolio overview</h1>
          <p className="dashboard-subtitle">A factual view of the companies and evidence available in your current run.</p>
        </div>
        <div className="stage-pill">
          <span className="stage-pill-label">Stage {stageNumber} of {state?.rail.length ?? 14}</span>
          <span className={`stage-pill-state ${thesisLocked ? "is-locked" : ""}`}>
            {thesisLocked ? <IconLock size={12} /> : <IconUnlock size={12} />}
            {thesisLocked ? "thesis locked" : "not yet locked"}
          </span>
        </div>
      </div>

      <div className="overview-stats">
        <Metric label="Total companies" value={summary?.total_companies ?? "—"} />
        <Metric label="Median ARR" value={summary ? money(summary.median_arr_usd) : "—"} />
        <Metric label="Median month-6 retention" value={summary ? pct(summary.median_retention) : "—"} />
        <Metric label="Median LTV/CAC ratio" value={summary ? mult(summary.median_ltv_cac) : "—"} />
      </div>

      <div className="overview-charts">
        <section className="overview-panel">
          <div className="overview-panel-head">
            <div>
              <div className="eyebrow">Observed company set</div>
              <h2>Sector distribution</h2>
            </div>
            <span className="data-state">{dataBusy ? "Loading" : `${rows.length.toLocaleString("en-IN")} rows`}</span>
          </div>
          {sectorBars.length > 0 ? (
            <BarChart
              chartId="dashboard.sector"
              bars={sectorBars}
              ariaLabel="Companies by sector"
              valueLabel="Companies"
              height={230}
              introDelay={240}
            />
          ) : (
            <div className="chart-empty">Waiting for the company projection.</div>
          )}
        </section>

        <section className="overview-panel">
          <div className="overview-panel-head">
            <div>
              <div className="eyebrow">Observed company set</div>
              <h2>Retention vs ARR</h2>
            </div>
            <span className="data-state">{scatterPoints.length.toLocaleString("en-IN")} points</span>
          </div>
          {scatterPoints.length > 0 ? (
            <ScatterChart
              chartId="dashboard.retention_arr"
              series={[{ points: scatterPoints, color: COLORS.PRIMARY, label: "Companies" }]}
              xLabel="ARR (USD)"
              yLabel="Month-6 retention (%)"
              xRange={[0, maxArr * 1.08]}
              yRange={[0, 100]}
              ariaLabel="Month-6 retention against ARR for the available company set"
              height={230}
              introDelay={300}
            />
          ) : (
            <div className="chart-empty">Waiting for the company projection.</div>
          )}
        </section>
      </div>

      <section className="thesis-lock-card">
        <div className="thesis-lock-icon">{thesisLocked ? <IconLock size={22} /> : <IconUnlock size={22} />}</div>
        <div className="thesis-lock-copy">
          <div className="eyebrow">One-way mechanic</div>
          <h2>{thesisLocked ? "Thesis locked" : "Thesis lock"}</h2>
          <p>
            {thesisLocked
              ? "Your thesis is locked. This decision is preserved by the simulation and cannot be undone."
              : "Your thesis is not locked. Select up to 4 of 16 traits, state your confidence, and lock once. This action cannot be undone."}
          </p>
        </div>
        <button className="dashboard-action" onClick={() => void navigate(thesisActionScreen)} disabled={navBusy}>
          {navBusy ? "Opening…" : thesisActionLabel}
          <IconArrowRight size={14} />
        </button>
      </section>

      <p className="dashboard-footnote">Figures are computed across the full company set.</p>
    </div>
  );
}
