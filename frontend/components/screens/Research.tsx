"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import CompanyModal from "@/components/CompanyModal";
import { COLORS, ScatterChart } from "@/components/Chart";
import { IconArrowRight, IconBuilding, IconChevronDown, IconClose, IconCoin, IconPercent, IconSearch, IconTrendUp } from "@/components/Icon";
import { api, qs, type CompanyRow } from "@/lib/api";
import { money, mult, pct } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/useNav";

const SECTORS = ["SaaS", "Fintech", "D2C", "Healthtech", "Edtech"];
const CITIES = ["Mumbai", "Bangalore", "Delhi", "Hyderabad", "Chennai", "Pune"];

// Fixed per-sector accent for the table's identifying dot. Small dots only --
// not text-on-background, so no light/dark contrast pairing is needed.
const SECTOR_COLORS: Record<string, string> = {
  SaaS: "#7f77dd", Fintech: "#378add", D2C: "#d4537e", Healthtech: "#4caf7d", Edtech: "#ef9f27",
};

interface ScatterData {
  axes: { key: string; label: string; unit: string }[];
  winners: number[][];
  failures: number[][];
  failures_locked: boolean;
}

/** Wraps the matched substring in <mark> so the browser's highlight CSS fires.
 *  Matching is case-insensitive, identical to the backend's substring search. */
function highlight(text: string, needle: string): React.ReactNode {
  if (!needle.trim()) return text;
  const i = text.toLowerCase().indexOf(needle.trim().toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + needle.trim().length)}</mark>
      {text.slice(i + needle.trim().length)}
    </>
  );
}

export default function Research() {
  const { go, sessionId, config, state, toast } = useStore();
  const [navBusy, navigate] = useNav();
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [stats, setStats] = useState<{ matching: number; share: number; median_retention: number | null; median_arr_usd: number | null } | null>(null);
  const [total, setTotal] = useState(0);
  const [features, setFeatures] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [scatter, setScatter] = useState<ScatterData | null>(null);
  const [xAxis, setXAxis] = useState(0);
  const [yAxis, setYAxis] = useState(1);
  // Pairs already reported this session. The server deduplicates at scoring
  // time too, so this only avoids pointless repeat POSTs while someone flicks
  // back and forth through the selects.
  const reportedPairs = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!sessionId) return;
    const r = await api.get<{ rows: CompanyRow[]; total: number; stats: typeof stats }>(
      `/sessions/${sessionId}/companies${qs({ feature: features, sector: sectors, city: cities, limit: 60 })}`,
    );
    setRows(r.rows);
    setTotal(r.total);
    setStats(r.stats);
  }, [sessionId, features, sectors, cities]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!sessionId) return;
    api.get<ScatterData>(`/sessions/${sessionId}/scatter`).then(setScatter).catch(() => {});
  }, [sessionId, state?.archive_unlocked]);

  /* Cross-plotting two continuous metrics is the only way to see the four
     variables that genuinely predict success, and it was invisible to the
     server -- so Evidence Depth could not credit it. Reported on change rather
     than on mount: the default pairing is not something the student chose. */
  const reportAxes = useCallback(
    (xi: number, yi: number) => {
      if (!sessionId || !scatter || xi === yi) return;
      const kx = scatter.axes[xi]?.key;
      const ky = scatter.axes[yi]?.key;
      if (!kx || !ky) return;
      const pair = [kx, ky].sort().join("|");
      if (reportedPairs.current.has(pair)) return;
      reportedPairs.current.add(pair);
      void api
        .post(`/sessions/${sessionId}/telemetry/metric`, { x: kx, y: ky })
        .catch(() => {
          // Let a failed report be retried rather than silently lost.
          reportedPairs.current.delete(pair);
        });
    },
    [sessionId, scatter],
  );

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  async function runSearch() {
    if (!sessionId || !query.trim()) return;
    setSearching(true);
    try {
      const r = await api.post<{ matches: CompanyRow[]; total: number; notice: { title: string; message: string } | null }>(
        `/sessions/${sessionId}/search`, { query },
      );
      setRows(r.matches);
      setTotal(r.total);
      setSearchNote(
        r.total ? `${r.total} match${r.total === 1 ? "" : "es"} for “${query}”` : `No matches for “${query}”`,
      );
      if (r.notice) toast(r.notice.title, r.notice.message);
    } finally {
      setSearching(false);
    }
  }

  // Debounced live search: fires ~300 ms after the user stops typing.
  // Empty query skips the API call and restores the unfiltered list instead.
  useEffect(() => {
    if (!query.trim()) {
      setSearchNote(null);
      void load();
      return;
    }
    const id = setTimeout(() => { void runSearch(); }, 300);
    return () => clearTimeout(id);
    // runSearch reads query and sessionId from closure; load is stable
    // via useCallback - no other deps needed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Live-search dropdown: open once 3+ characters are typed, close on a
  // shorter query. Does not touch the debounced search effect above -- it
  // only decides whether the results it produces are shown as a dropdown.
  useEffect(() => {
    setDropdownOpen(query.trim().length >= 3);
  }, [query]);

  // Top slice shown in the dropdown. Kept separate from the table's `rows`
  // (which still renders everything) so keyboard nav has a stable, bounded
  // list to walk.
  const dropdownRows = useMemo(() => rows.slice(0, 8), [rows]);

  // Keep the keyboard-selected row valid whenever the dropdown opens or its
  // contents change (new search results in) -- always land on the top hit.
  useEffect(() => {
    setActiveIndex(0);
  }, [dropdownOpen, dropdownRows]);

  useEffect(() => {
    if (!dropdownOpen || !dropdownRows[activeIndex]) return;
    document.getElementById(`research-opt-${dropdownRows[activeIndex].id}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, dropdownOpen, dropdownRows]);

  // Close the dropdown on outside click / Escape without affecting the
  // underlying query, filters, or table state.
  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDropdownOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  /* The "request a comparison group" control has been removed. It read as a
     button that would reveal withheld failure data, which is the opposite of
     what it did -- it asked Ops for a comparison group and was refused. The
     failure overlay still appears on its own once the archive arrives: the
     scatter refetches on `state.archive_unlocked` below. */

  const scatterSeries = useMemo(() => {
    if (!scatter) return [];
    const series = [
      {
        points: scatter.winners.map((p) => [p[xAxis], p[yAxis]] as [number, number]),
        color: COLORS.GREEN, alpha: 0.5, label: "Portfolio",
      },
    ];
    if (scatter.failures.length) {
      series.unshift({
        points: scatter.failures.map((p) => [p[xAxis], p[yAxis]] as [number, number]),
        color: COLORS.RED, alpha: 0.26, label: "Archive",
      });
    }
    return series;
  }, [scatter, xAxis, yAxis]);

  const axisRange = (idx: number): [number, number] => {
    if (!scatter) return [0, 1];
    const all = [...scatter.winners, ...scatter.failures].map((p) => p[idx]);
    if (!all.length) return [0, 1];
    const lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.06 || 1;
    return [lo - pad, hi + pad];
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="eyebrow">Step one</div>
          <h2 className="stitle" style={{ fontSize: 22 }}>Portfolio history</h2>
        </div>
        <button className="pri" onClick={() => navigate("thesis")} disabled={navBusy}>
          {navBusy ? "Loading…" : "Draft thesis"} <IconArrowRight size={14} />
        </button>
      </div>

      <div ref={searchWrapRef} style={{ position: "relative", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
            <IconSearch
              size={15}
              style={{ position: "absolute", left: 13, color: "var(--ink-4)", pointerEvents: "none" }}
            />
            <input
              type="search" value={query} placeholder="Search company, sector, city — or ask about the data…"
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (query.trim().length >= 3) setDropdownOpen(true); }}
              role="combobox"
              aria-expanded={dropdownOpen}
              aria-controls="research-search-listbox"
              aria-activedescendant={dropdownOpen && dropdownRows[activeIndex] ? `research-opt-${dropdownRows[activeIndex].id}` : undefined}
              onKeyDown={(e) => {
                if (dropdownOpen && dropdownRows.length) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) => (i + 1) % dropdownRows.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((i) => (i - 1 + dropdownRows.length) % dropdownRows.length);
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const picked = dropdownRows[activeIndex];
                    if (picked) { setOpenId(picked.id); setDropdownOpen(false); }
                    return;
                  }
                }
                if (e.key === "Enter") { runSearch(); setDropdownOpen(false); }
              }}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <button onClick={() => { runSearch(); setDropdownOpen(false); }}>Search</button>
          {searchNote && (
            <button onClick={() => { setQuery(""); setSearchNote(null); setDropdownOpen(false); void load(); }}>Clear</button>
          )}
        </div>

        {/* Live-search dropdown: anchored directly under the input so matches
            are visible immediately, instead of only appearing in the table
            past the cross-plot section further down the page. */}
        {dropdownOpen && (
          <div
            id="research-search-listbox"
            role="listbox"
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              zIndex: 45, maxHeight: 340, overflowY: "auto", padding: "6px 0",
              background: "var(--surface-solid)", border: "1px solid var(--line-strong)",
              borderRadius: 10, boxShadow: "var(--shadow-md)",
            }}
          >
            {searching && <div className="note" style={{ padding: "10px 16px" }}>Searching…</div>}
            {!searching && dropdownRows.length === 0 && (
              <div className="note" style={{ padding: "10px 16px" }}>No matches for “{query}”</div>
            )}
            {!searching && dropdownRows.map((r, i) => (
              <div
                id={`research-opt-${r.id}`}
                key={r.id}
                role="option"
                aria-selected={i === activeIndex}
                style={{
                  padding: "9px 16px", display: "flex", justifyContent: "space-between",
                  gap: 12, alignItems: "center", cursor: "pointer",
                  background: i === activeIndex ? "var(--surface-3)" : "transparent",
                  transition: "background var(--fast)",
                }}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => { setOpenId(r.id); setDropdownOpen(false); }}
              >
                <div>
                  <div><strong>{highlight(r.name, query)}</strong></div>
                  <div className="note" style={{ marginTop: 2 }}>{r.sector} · {r.city}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 13 }}>{money(r.arr_usd)}</div>
                  <div className="note" style={{ marginTop: 2 }}>{pct(r.month6_retention)} M6 ret</div>
                </div>
              </div>
            ))}
            {!searching && dropdownRows.length > 0 && (
              <div
                className="note"
                style={{
                  padding: "8px 16px", marginTop: 4, borderTop: "1px solid var(--line-soft)",
                  display: "flex", justifyContent: "space-between",
                }}
              >
                <span>↑↓ navigate · ↵ open · esc close</span>
                <span>{dropdownRows.length} of {total}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {searching && <p className="note" style={{ marginBottom: 12 }}>Searching…</p>}
      {searchNote && <p className="note" style={{ marginBottom: 12 }}>{searchNote}</p>}

      <div style={{ marginBottom: 16 }}>
        {(() => {
          const activeFeatures = features.map((k) => ({ key: k, label: config?.variables.find((v) => v.key === k)?.label ?? k }));
          const totalActive = features.length + sectors.length + cities.length;
          if (!totalActive) return null;
          return (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {activeFeatures.map((f) => (
                  <span key={f.key} className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgb(var(--accent-rgb) / 0.14)", color: "var(--orange-deep)" }}>
                    {f.label}
                    <button aria-label={`Remove ${f.label} filter`} onClick={() => toggle(features, setFeatures, f.key)} style={{ padding: 0, border: "none", background: "transparent", display: "inline-flex", cursor: "pointer" }}>
                      <IconClose size={9} />
                    </button>
                  </span>
                ))}
                {sectors.map((s) => (
                  <span key={s} className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgb(var(--accent-rgb) / 0.14)", color: "var(--orange-deep)" }}>
                    {s}
                    <button aria-label={`Remove ${s} filter`} onClick={() => toggle(sectors, setSectors, s)} style={{ padding: 0, border: "none", background: "transparent", display: "inline-flex", cursor: "pointer" }}>
                      <IconClose size={9} />
                    </button>
                  </span>
                ))}
                {cities.map((c) => (
                  <span key={c} className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgb(var(--accent-rgb) / 0.14)", color: "var(--orange-deep)" }}>
                    {c}
                    <button aria-label={`Remove ${c} filter`} onClick={() => toggle(cities, setCities, c)} style={{ padding: 0, border: "none", background: "transparent", display: "inline-flex", cursor: "pointer" }}>
                      <IconClose size={9} />
                    </button>
                  </span>
                ))}
                <span className="note">{totalActive} filter{totalActive === 1 ? "" : "s"} active</span>
              </div>
              <button
                onClick={() => { setFeatures([]); setSectors([]); setCities([]); }}
                style={{ background: "transparent", border: "none", color: "var(--orange)", fontSize: 12, padding: 0 }}
              >
                Clear all
              </button>
            </div>
          );
        })()}

                <div className="research-filter-workspace">
          <section className={`research-filter-group variables${variablesOpen ? " is-open" : ""}`}>
            <button
              className="research-filter-heading"
              onClick={() => setVariablesOpen((v) => !v)}
              aria-expanded={variablesOpen}
            >
              <span className="research-filter-heading-main">
                <span className="research-filter-icon"><IconChevronDown size={13} style={{ transform: variablesOpen ? "rotate(180deg)" : "none" }} /></span>
                <span><span className="eyebrow">Variables</span><strong>{(config?.variables ?? []).length} available</strong></span>
              </span>
              <span className="research-filter-heading-meta">{features.length ? `${features.length} selected` : "Optional"}</span>
            </button>
            {variablesOpen && (
              <div className="research-filter-options">
                {(config?.variables ?? []).map((v) => (
                  <button
                    key={v.key}
                    className={`research-filter-chip${features.includes(v.key) ? " is-active" : ""}`}
                    onClick={() => toggle(features, setFeatures, v.key)}
                  >
                    <span className="research-chip-marker" aria-hidden="true">{features.includes(v.key) ? "✓" : ""}</span>
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="research-filter-row">
            <section className="research-filter-group compact">
              <div className="research-filter-heading static">
                <span className="research-filter-heading-main"><span className="research-filter-icon">⌖</span><span><span className="eyebrow">Sector</span><strong>{sectors.length ? `${sectors.length} selected` : "All sectors"}</strong></span></span>
              </div>
              <div className="research-filter-options">
                {SECTORS.map((s) => (
                  <button key={s} className={`research-filter-chip${sectors.includes(s) ? " is-active" : ""}`} onClick={() => toggle(sectors, setSectors, s)}>
                    <span className="research-chip-marker" aria-hidden="true">{sectors.includes(s) ? "✓" : ""}</span>{s}
                  </button>
                ))}
              </div>
            </section>
            <section className="research-filter-group compact">
              <div className="research-filter-heading static">
                <span className="research-filter-heading-main"><span className="research-filter-icon">⌂</span><span><span className="eyebrow">HQ</span><strong>{cities.length ? `${cities.length} selected` : "All locations"}</strong></span></span>
              </div>
              <div className="research-filter-options">
                {CITIES.map((c) => (
                  <button key={c} className={`research-filter-chip${cities.includes(c) ? " is-active" : ""}`} onClick={() => toggle(cities, setCities, c)}>
                    <span className="research-chip-marker" aria-hidden="true">{cities.includes(c) ? "✓" : ""}</span>{c}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

      </div>

      <div className="stagger" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginBottom: 18 }}>
        <div className="stat">
          <IconBuilding size={16} style={{ color: "var(--orange)", marginBottom: 6 }} />
          <div className="k">Matching</div><div className="v">{stats?.matching ?? "—"}</div>
        </div>
        <div className="stat">
          <IconPercent size={16} style={{ color: "var(--orange)", marginBottom: 6 }} />
          <div className="k">Share</div><div className="v">{stats ? `${stats.share}%` : "—"}</div>
        </div>
        <div className="stat">
          <IconTrendUp size={16} style={{ color: "var(--orange)", marginBottom: 6 }} />
          <div className="k">Median M6 ret.</div><div className="v">{stats?.median_retention != null ? `${stats.median_retention}%` : "—"}</div>
        </div>
        <div className="stat">
          <IconCoin size={16} style={{ color: "var(--orange)", marginBottom: 6 }} />
          <div className="k">Median ARR</div><div className="v">{stats?.median_arr_usd != null ? money(stats.median_arr_usd) : "—"}</div>
        </div>
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
          <div className="eyebrow" style={{ marginBottom: 0 }}>Cross-plot</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={xAxis}
              aria-label="Cross-plot X axis metric"
              onChange={(e) => {
                const v = Number(e.target.value);
                setXAxis(v);
                reportAxes(v, yAxis);
              }}
            >
              {scatter?.axes.map((a, i) => <option key={a.key} value={i}>{a.label}</option>)}
            </select>
            <span className="note">vs</span>
            <select
              value={yAxis}
              aria-label="Cross-plot Y axis metric"
              onChange={(e) => {
                const v = Number(e.target.value);
                setYAxis(v);
                reportAxes(xAxis, v);
              }}
            >
              {scatter?.axes.map((a, i) => <option key={a.key} value={i}>{a.label}</option>)}
            </select>
            {!scatter?.failures_locked && scatter?.failures.length ? (
              <span className="tag" style={{ background: "rgb(var(--neg-rgb) / 0.12)", color: "var(--neg)" }}>
                Archive overlay on
              </span>
            ) : null}
          </div>
        </div>
        {scatter && (
          <ScatterChart
            chartId="research.crossplot"
            series={scatterSeries}
            xLabel={scatter.axes[xAxis]?.label ?? ""}
            yLabel={scatter.axes[yAxis]?.label ?? ""}
            xRange={axisRange(xAxis)}
            yRange={axisRange(yAxis)}
            xUnit={scatter.axes[xAxis]?.unit ?? ""}
            yUnit={scatter.axes[yAxis]?.unit ?? ""}
            height={280}
            ariaLabel="Cross-plot of continuous metrics"
          />
        )}
        <p className="note" style={{ marginTop: 8 }}>
          {scatter?.failures_locked
            ? "Portfolio companies only — every company plotted here is one the firm backed. This dataset holds no failures to plot against them."
            : "Hover a point to read it. Click a series in the key to isolate it."}
        </p>
      </div>

      <div className="card">
        <div style={{ padding: "6px 22px 14px", overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Company</th><th>Sector</th><th>HQ</th>
                <th className="r">ARR</th><th className="r">M6 ret.</th>
                <th className="r">Head</th><th className="r">LTV/CAC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setOpenId(r.id)}>
                  <td><strong>{searchNote ? highlight(r.name, query) : r.name}</strong></td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span
                        aria-hidden="true"
                        style={{ width: 6, height: 6, borderRadius: "50%", background: SECTOR_COLORS[r.sector] ?? "var(--ink-4)", flexShrink: 0 }}
                      />
                      {searchNote ? highlight(r.sector, query) : r.sector}
                    </span>
                  </td>
                  <td>{searchNote ? highlight(r.city, query) : r.city}</td>
                  <td className="r mono">{money(r.arr_usd)}</td>
                  <td className="r">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                      <span className="mono">{pct(r.month6_retention)}</span>
                      <span style={{ width: 42, height: 4, borderRadius: 2, background: "rgb(var(--accent-rgb) / 0.15)", overflow: "hidden", flexShrink: 0 }}>
                        <span style={{ display: "block", height: "100%", width: `${Math.min(100, Math.max(0, r.month6_retention * 100))}%`, background: "var(--orange)" }} />
                      </span>
                    </span>
                  </td>
                  <td className="r mono">{r.headcount}</td>
                  <td className="r mono">{mult(r.ltv_cac_ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ paddingTop: 10 }}>
            {total > rows.length
              ? `Showing ${rows.length} of ${total} companies. Click a row for the full profile.`
              : rows.length === 0
                ? "No companies match these filters."
                : "Click a row for the full profile."}
          </p>
        </div>
      </div>

      {openId !== null && (
        <CompanyModal companyId={openId} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}
