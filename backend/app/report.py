"""Printable investment report.

The report is intentionally self-contained so it can be downloaded, emailed, or
archived without depending on the application shell. All displayed values are
projected from the session, scorecard, and debrief responses passed to render().
"""

from __future__ import annotations

import html
from datetime import datetime, timezone
from typing import Any

from .sim import parameters as P


def money(usd: float, rate: float) -> str:
    """Three-tier Indian numbering, matching the client exactly."""
    r = usd * rate
    if r >= 1e7:
        crore = r / 1e7
        return f"Rs {round(crore)} Cr" if crore >= 100 else f"Rs {crore:.1f} Cr"
    if r >= 1e5:
        return f"Rs {r / 1e5:.1f} L"
    return f"Rs {round(r):,}"


def _rows(rows: list[list[str]]) -> str:
    return "".join("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)


def _progress(value: float, maximum: float) -> str:
    percent = 0 if maximum <= 0 else min(100, max(0, (value / maximum) * 100))
    return f'<div class="progress"><i style="width:{percent:.1f}%"></i></div>'


def _metric(label: str, value: str, note: str, tone: str = "") -> str:
    return f'<div class="metric {tone}"><div class="label">{label}</div><strong>{value}</strong><small>{note}</small></div>'


def render(
    *,
    user_name: str,
    session: Any,
    scorecard: dict[str, Any],
    debrief: dict[str, Any],
    rate: float,
) -> str:
    e = html.escape
    fund = session.fund_result or {}
    variables = session.thesis_variables or []
    confidence = session.thesis_confidence or {}
    generated = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")

    thesis_rows = [
        [
            e(row["label"]),
            f"{confidence.get(row['feature'], '-')}%",
            f"{row['pct_winners']}%",
            f"{row['pct_failures_complete']}%",
            f"{row['true_lift']}x",
            e({"A": "Genuinely causal", "B": "Survivorship trap", "C": "Reverse trap", "D": "Noise"}.get(row.get("class"), "Unclassified")),
        ]
        for row in debrief.get("mirror", [])
    ]

    weight_rows = [
        [e(P.FEATURE_LABELS.get(k, k)), f"{v:+.1f}", "Thesis variable" if k in variables else "Adjusted / available"]
        for k, v in sorted((session.model_weights or {}).items(), key=lambda kv: -abs(kv[1]))
        if v
    ]

    portfolio_rows = [
        [
            e(row["name"]),
            e(row["sector"]),
            money(row["cheque_usd"], rate),
            f"{round(row.get('share_of_fund', 0) * 100)}%",
            f'<span class="outcome {"success" if row["outcome"] == "Success" else "other"}">{e(row["outcome"])}</span>',
            money(row["returned_usd"], rate),
        ]
        for row in fund.get("rows", [])
    ]

    myelin = scorecard.get("myelin") or {}
    myelin_rows = [
        [
            e(d["label"]),
            f"{d['score']} / {d['max']}",
            _progress(d["score"], d["max"]),
            e(d["detail"]),
        ]
        for d in myelin.get("dimensions", [])
    ]
    myelin_rows += [
        [e(d["label"]), "N/A", '<span class="progress na"></span>', e(d["detail"])]
        for d in myelin.get("not_applicable", [])
    ]

    dim_rows = [
        [e(d["label"]), f"{d['score']} / {d['max']}", _progress(d["score"], d["max"]), e(d["detail"])]
        for d in scorecard.get("dimensions", [])
    ]

    fund_rows = fund.get("rows", [])
    portfolio_total = sum(row.get("cheque_usd", 0) for row in fund_rows)
    deployed = money(fund.get("deployed_usd", 0), rate)
    returned = money(fund.get("returned_usd", 0), rate)
    net = money(fund.get("net_usd", 0), rate)
    hit_rate = f"{fund.get('hits', 0)} / {fund.get('cheques', 0)}"
    share = debrief.get("share_of_evidence_seen", 0)

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Investment report - {e(user_name)}</title>
<style>
  :root {{
    --ink: #0a1f1a; --dim: #435850; --faint: #62766e; --paper: #f4faf8;
    --rule: rgba(11,125,112,.16); --teal: #0b7d70; --teal-deep: #075e54;
    --wash: rgba(11,125,112,.07); --warning: #b45309; --danger: #b42318;
  }}
  * {{ box-sizing:border-box; }}
  html {{ scroll-behavior:smooth; }}
  body {{ font-family: Georgia, 'Times New Roman', serif; color:var(--ink); background:var(--paper); max-width:980px; margin:0 auto; padding:42px 48px 70px; }}
  h1 {{ font-size:38px; letter-spacing:-.04em; line-height:1; margin:0 0 8px; }}
  h2 {{ font-size:15px; text-transform:uppercase; letter-spacing:.11em; color:var(--faint); margin:38px 0 12px; font-family:Helvetica,Arial,sans-serif; }}
  h3 {{ font-size:16px; margin:0 0 6px; }}
  p {{ margin:0; }}
  .meta {{ color:var(--faint); font-size:12px; margin-bottom:24px; font-family:Helvetica,Arial,sans-serif; }}
  .kicker, .label, th, .toc-title {{ font:600 10px/1.2 Helvetica,Arial,sans-serif; text-transform:uppercase; letter-spacing:.1em; color:var(--faint); }}
  .cover {{ padding:28px 30px 25px; border:1px solid var(--rule); border-top:4px solid var(--teal); background:#fff; }}
  .cover .kicker {{ color:var(--teal); margin-bottom:12px; }}
  .cover-summary {{ max-width:760px; color:var(--dim); font-size:14px; line-height:1.65; margin-top:16px; }}
  .cover-stats {{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:24px; }}
  .metric {{ padding:13px 12px; border:1px solid var(--rule); background:var(--wash); }}
  .metric strong {{ display:block; margin:8px 0 4px; color:var(--teal-deep); font:700 22px Georgia,serif; }}
  .metric small {{ display:block; color:var(--faint); font:10px/1.35 Helvetica,Arial,sans-serif; }}
  .metric.negative strong {{ color:var(--danger); }}
  .toc {{ display:flex; flex-wrap:wrap; gap:7px; margin:19px 0 30px; padding:11px 0; border-top:1px solid var(--rule); border-bottom:1px solid var(--rule); }}
  .toc-title {{ width:100%; margin-bottom:2px; }}
  .toc a {{ padding:7px 9px; border:1px solid var(--rule); color:var(--teal-deep); background:#fff; font:11px Helvetica,Arial,sans-serif; text-decoration:none; }}
  .section-lead {{ color:var(--dim); font-size:13px; line-height:1.6; margin-bottom:10px; }}
  table {{ width:100%; border-collapse:collapse; font-size:12px; margin-top:6px; }}
  th, td {{ text-align:left; padding:9px 10px 9px 0; border-bottom:1px solid var(--rule); vertical-align:top; }}
  th {{ font-weight:600; }}
  td.r, th.r {{ text-align:right; padding-right:0; }}
  .mono {{ font-family:Menlo,Monaco,Consolas,monospace; }}
  .band {{ display:inline-block; padding:5px 11px; border-radius:4px; background:var(--wash); color:var(--teal-deep); font:600 12px Helvetica,Arial,sans-serif; }}
  .total {{ font-size:38px; font-weight:700; letter-spacing:-.03em; color:var(--teal-deep); }}
  .total span {{ color:var(--faint); font-size:15px; font-weight:400; letter-spacing:0; }}
  blockquote {{ margin:10px 0; padding:14px 18px; border-left:3px solid var(--teal); background:var(--wash); color:var(--ink); font-size:15px; line-height:1.6; }}
  .note {{ color:var(--dim); font-size:12px; line-height:1.65; }}
  .progress {{ width:100%; height:5px; margin-top:6px; background:rgba(11,125,112,.1); }}
  .progress i {{ display:block; height:100%; background:var(--teal); }}
  .progress.na {{ display:block; background:rgba(98,118,110,.1); }}
  .outcome {{ font:600 11px Helvetica,Arial,sans-serif; }}
  .outcome.success {{ color:var(--teal-deep); }}
  .outcome.other {{ color:var(--danger); }}
  .callout {{ margin-top:12px; padding:15px 17px; border-left:3px solid var(--teal); background:var(--wash); }}
  .callout.warning {{ border-left-color:var(--warning); background:rgba(180,83,9,.06); }}
  .callout h3 {{ font-family:Helvetica,Arial,sans-serif; font-size:13px; }}
  .callout p {{ color:var(--dim); font-size:12px; line-height:1.6; }}
  .two-col {{ display:grid; grid-template-columns:1fr 1fr; gap:22px; align-items:start; }}
  .footer {{ margin-top:40px; padding-top:14px; border-top:1px solid var(--rule); color:var(--faint); font:10px/1.5 Helvetica,Arial,sans-serif; }}
  @media print {{ body {{ background:#fff; padding:0; max-width:none; }} .toc {{ display:none; }} .cover {{ break-inside:avoid; }} h2 {{ break-after:avoid; }} table {{ break-inside:auto; }} tr {{ break-inside:avoid; }} }}
  @media (max-width:720px) {{ body {{ padding:25px 20px 45px; }} .cover-stats {{ grid-template-columns:repeat(2,1fr); }} .two-col {{ grid-template-columns:1fr; }} }}
</style></head><body>

<div class="kicker">Fund IV / Analyst file</div>
<h1>Investment report</h1>
<div class="meta">{e(user_name)} &middot; session {e(session.id[:8])} &middot; generated {generated}</div>

<section class="cover" id="summary">
  <div class="kicker">Final decision record</div>
  <h3>What you believed, what you did, and what the full record showed.</h3>
  <p class="cover-summary">Fund IV deployed {deployed} across {len(portfolio_rows)} portfolio compan{'y' if len(portfolio_rows) == 1 else 'ies'} against a thesis built on {len(variables)} variable{'s' if len(variables) != 1 else ''}. It returned {returned} for a net of {net}, with a {hit_rate} hit rate. Fund P&amp;L is shown for reflection and carries no weight in the analyst assessment.</p>
  <div class="cover-stats">
    {_metric("Deployed", deployed, f"{len(portfolio_rows)} selected positions")}
    {_metric("Returned", returned, "Four-quarter outcome")}
    {_metric("Net result", net, "Returned less deployed", "" if fund.get("net_usd", 0) >= 0 else "negative")}
    {_metric("Hit rate", hit_rate, "Selected investments")}
  </div>
</section>

<nav class="toc"><div class="toc-title">Report contents</div>{''.join(f'<a href="#{anchor}">{label}</a>' for anchor, label in [("thesis", "Thesis"), ("model", "Scoring model"), ("portfolio", "Portfolio"), ("scorecard", "Scorecard"), ("process", "Process detail"), ("closing", "Closing note")])}</nav>

<section id="thesis"><h2>Thesis, as submitted and as it turned out</h2><p class="section-lead">The comparison between your stated confidence and the complete record. A visible pattern is not automatically a useful signal.</p>
<table><thead><tr><th>Variable</th><th>Stated confidence</th><th>In winners</th><th>In failures</th><th>True lift</th><th>Classification</th></tr></thead><tbody>{_rows(thesis_rows)}</tbody></table>
</section>

<section><h2>What would have changed your mind</h2><blockquote>{e(session.falsification or 'No statement recorded.')}</blockquote></section>

<section id="model"><h2>Scoring model</h2><p class="section-lead">The final ranking rule after the thesis and any later weight adjustments.</p><table><thead><tr><th>Variable</th><th>Final weight</th><th>Origin</th></tr></thead><tbody>{_rows(weight_rows) or '<tr><td colspan="3">No weights set.</td></tr>'}</tbody></table>
</section>

<section id="portfolio"><h2>Portfolio outcomes</h2><p class="section-lead">The companies selected, the cheque size, and the realized outcome. This financial result is separate from the analyst score.</p><table><thead><tr><th>Company</th><th>Sector</th><th>Cheque</th><th>Share of fund</th><th>Outcome</th><th>Returned</th></tr></thead><tbody>{_rows(portfolio_rows)}</tbody></table><p class="note">Total deployed {money(portfolio_total, rate)} across {len(portfolio_rows)} cheques, sized by the analyst.</p></section>

<section id="scorecard"><h2>Standard scorecard</h2><div class="two-col"><div><div class="total">{myelin.get('total', 0)} <span>/ {myelin.get('max', 100)}</span></div><p style="margin-top:8px"><span class="band">{e(myelin.get('band', ''))}</span></p></div><p class="section-lead">Measured from how you worked, not from what your fund returned. Expandable detail is available in the application; this report preserves the complete basis.</p></div>
<table><thead><tr><th>Dimension</th><th>Score</th><th>Progress</th><th>Basis</th></tr></thead><tbody>{_rows(myelin_rows)}</tbody></table><div class="callout"><h3>N/A dimensions are not zero scores</h3><p>This simulation has no mechanic that produces evidence about those behaviours. A number invented to fill the gap would measure appearance rather than behaviour.</p></div></section>

<section id="process"><h2>Process detail</h2><div class="two-col"><div><div class="total">{scorecard.get('total', 0)} <span>/ {scorecard.get('max', 100)}</span></div><p style="margin-top:8px"><span class="band">{e(scorecard.get('band', ''))}</span></p></div><p class="section-lead">The finer-grained diagnostic the simulation scores itself on. Several process measures feed the standard dimensions above.</p></div><table><thead><tr><th>Dimension</th><th>Score</th><th>Progress</th><th>Basis</th></tr></thead><tbody>{_rows(dim_rows)}</tbody></table></section>

<section id="closing"><h2>Closing note</h2><div class="callout warning"><h3>The record has a boundary</h3><p>The thesis above was formed on {share}% of the total evidence available. The remaining records existed the entire time; they were simply not in the file handed over on the first day. The recovered archive was itself incomplete — {debrief.get('withheld_count', 0)} further companies never filed dissolution paperwork and are absent from it, and their absence is not random.</p></div></section>

<div class="footer">Meridian Partners &middot; Fund IV analyst file &middot; Session {e(session.id[:8])}<br>This document is generated from the session record. It is intended for learning and reflection, not as investment advice.</div>

</body></html>"""
