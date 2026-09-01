"""Printable investment report and Meridian decision-intelligence scorecard.

Two self-contained HTML documents live in this module:

- `render()` -- the long-form printable investment report (used by the
  `/report` endpoint). All displayed values are projected from the session,
  scorecard, and debrief responses passed in.
- `render_scorecard()` -- the nine-section MYELIN-branded decision scorecard
  ("what your decisions revealed about you"), matching the firm's dark
  terminal theme. Every figure on the page is read from the `scorecard`,
  `session`, and `fund` objects the app already computes elsewhere (see
  `app/scoring.py::build_scorecard` and `app/scoring.py::resolve_fund`) --
  this function only decides how to lay the existing values out and which
  two or three sentence templates to wrap around them.

Both are self-contained so they can be downloaded, emailed, or archived
without depending on the application shell.
"""

from __future__ import annotations

import base64
import html
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .sim import parameters as P

# ---------------------------------------------------------------------------
# Meridian Partners wordmark (star/compass mark + "MERIDIAN PARTNERS" type),
# embedded inline so the investment report never depends on a frontend asset
# path resolving correctly at render time -- the same class of bug that had
# the scorecard's logo silently falling back to blank when the file wasn't
# found. Swap this constant if the firm ever ships a new logo file.
# ---------------------------------------------------------------------------
_MERIDIAN_LOGO_B64 = (
    "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"
)


def _report_logo_data_uri() -> str:
    return f"data:image/png;base64,{_MERIDIAN_LOGO_B64}"


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
    logo_img = f'<img src="{_report_logo_data_uri()}" alt="Meridian Partners" class="brand-logo" />'

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Investment report - {e(user_name)}</title>
<style>
  :root {{
    --ink: #f4faf8; --dim: rgba(244,250,248,.72); --faint: rgba(244,250,248,.46); --paper: #050807;
    --rule: rgba(94,234,212,.18); --teal: #2dd4bf; --teal-deep: #5eead4;
    --card: #0b1513; --warning: #f2776a; --danger: #f2776a;
    --brand-red: #d9483c;
  }}
  * {{ box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; color-adjust:exact; }}
  html {{ scroll-behavior:smooth; }}
  body {{ font-family: Georgia, 'Times New Roman', serif; color:var(--ink); background:var(--paper); max-width:980px; margin:0 auto; padding:42px 48px 70px; }}
  h1 {{ font-size:38px; letter-spacing:-.04em; line-height:1; margin:0 0 8px; color:var(--ink); }}
  h2 {{ font-size:15px; text-transform:uppercase; letter-spacing:.11em; color:var(--faint); margin:38px 0 12px; font-family:Helvetica,Arial,sans-serif; }}
  h3 {{ font-size:16px; margin:0 0 6px; color:var(--ink); }}
  p {{ margin:0; }}
  .brand-row {{ display:flex; align-items:center; gap:14px; margin-bottom:22px; }}
  .brand-logo {{ height:30px; flex:none; }}
  .brand-fallback {{ color:var(--ink); font:700 15px/1 Helvetica,Arial,sans-serif; letter-spacing:.02em; }}
  .brand-tag {{ color:var(--faint); font-size:10px; letter-spacing:.1em; text-transform:uppercase; border-left:1px solid var(--rule); padding-left:12px; margin-left:2px; }}
  .meta {{ color:var(--faint); font-size:12px; margin-bottom:24px; font-family:Helvetica,Arial,sans-serif; }}
  .kicker, .label, th, .toc-title {{ font:600 10px/1.2 Helvetica,Arial,sans-serif; text-transform:uppercase; letter-spacing:.1em; color:var(--faint); }}
  .cover {{ padding:28px 30px 25px; border:1px solid var(--rule); border-top:4px solid var(--teal); background:var(--card); }}
  .cover .kicker {{ color:var(--teal-deep); margin-bottom:12px; }}
  .cover-summary {{ max-width:760px; color:var(--dim); font-size:14px; line-height:1.65; margin-top:16px; }}
  .cover-stats {{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:24px; }}
  .metric {{ padding:13px 12px; border:1px solid var(--rule); background:var(--paper); }}
  .metric strong {{ display:block; margin:8px 0 4px; color:var(--teal-deep); font:700 22px Georgia,serif; }}
  .metric small {{ display:block; color:var(--faint); font:10px/1.35 Helvetica,Arial,sans-serif; }}
  .metric.negative strong {{ color:var(--danger); }}
  .toc {{ display:flex; flex-wrap:wrap; gap:7px; margin:19px 0 30px; padding:11px 0; border-top:1px solid var(--rule); border-bottom:1px solid var(--rule); }}
  .toc-title {{ width:100%; margin-bottom:2px; }}
  .toc a {{ padding:7px 9px; border:1px solid var(--rule); color:var(--teal-deep); background:var(--card); font:11px Helvetica,Arial,sans-serif; text-decoration:none; }}
  .section-lead {{ color:var(--dim); font-size:13px; line-height:1.6; margin-bottom:10px; }}
  table {{ width:100%; border-collapse:collapse; font-size:12px; margin-top:6px; }}
  th, td {{ text-align:left; padding:9px 10px 9px 0; border-bottom:1px solid var(--rule); vertical-align:top; color:var(--dim); }}
  th {{ font-weight:600; }}
  td.r, th.r {{ text-align:right; padding-right:0; }}
  .mono {{ font-family:Menlo,Monaco,Consolas,monospace; }}
  .band {{ display:inline-block; padding:5px 11px; border-radius:4px; background:var(--card); border:1px solid var(--rule); color:var(--teal-deep); font:600 12px Helvetica,Arial,sans-serif; }}
  .total {{ font-size:38px; font-weight:700; letter-spacing:-.03em; color:var(--ink); }}
  .total span {{ color:var(--faint); font-size:15px; font-weight:400; letter-spacing:0; }}
  blockquote {{ margin:10px 0; padding:14px 18px; border-left:3px solid var(--teal); background:var(--card); color:var(--ink); font-size:15px; line-height:1.6; }}
  .note {{ color:var(--dim); font-size:12px; line-height:1.65; }}
  .progress {{ width:100%; height:5px; margin-top:6px; background:rgba(94,234,212,.1); }}
  .progress i {{ display:block; height:100%; background:var(--teal); }}
  .progress.na {{ display:block; background:rgba(244,250,248,.08); }}
  .outcome {{ font:600 11px Helvetica,Arial,sans-serif; }}
  .outcome.success {{ color:var(--teal-deep); }}
  .outcome.other {{ color:var(--danger); }}
  .callout {{ margin-top:12px; padding:15px 17px; border-left:3px solid var(--teal); background:var(--card); }}
  .callout.warning {{ border-left-color:var(--warning); background:rgba(242,119,106,.08); }}
  .callout h3 {{ font-family:Helvetica,Arial,sans-serif; font-size:13px; color:var(--ink); }}
  .callout p {{ color:var(--dim); font-size:12px; line-height:1.6; }}
  .two-col {{ display:grid; grid-template-columns:1fr 1fr; gap:22px; align-items:start; }}
  .footer {{ margin-top:40px; padding-top:14px; border-top:1px solid var(--rule); color:var(--faint); font:10px/1.5 Helvetica,Arial,sans-serif; }}
  @media print {{ body {{ padding:0; max-width:none; }} .toc {{ display:none; }} .cover {{ break-inside:avoid; }} h2 {{ break-after:avoid; }} table {{ break-inside:auto; }} tr {{ break-inside:avoid; }} }}
  @media (max-width:720px) {{ body {{ padding:25px 20px 45px; }} .cover-stats {{ grid-template-columns:repeat(2,1fr); }} .two-col {{ grid-template-columns:1fr; }} }}
</style></head><body>

<div class="brand-row">
  {logo_img}
  <span class="brand-tag">Fund IV / Analyst file</span>
</div>
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


# ---------------------------------------------------------------------------
# Meridian decision-intelligence scorecard
# ---------------------------------------------------------------------------
# The dark-mode wordmark (teal/white marks on transparent background) is the
# variant already used in the sidebar against a dark background --
# frontend/app/terminal/layout.tsx uses the same file for the same reason.
_LOGO_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "public" / "brand" / "meridian-partners-logo.png"
)


def _scorecard_logo_data_uri() -> str:
    try:
        data = _LOGO_PATH.read_bytes()
    except FileNotFoundError:
        return ""
    return f"data:image/png;base64,{base64.b64encode(data).decode()}"


def _scorecard_money(usd: float, rate: float) -> str:
    r = usd * rate
    if r >= 1e7:
        crore = r / 1e7
        return f"\u20b9{round(crore)} Cr" if crore >= 100 else f"\u20b9{crore:.1f} Cr"
    if r >= 1e5:
        return f"\u20b9{r / 1e5:.1f} L"
    return f"\u20b9{round(r):,}"


# Short, dimension-scoped clauses used only to phrase the profile sentence on
# the scorecard cover page. These are wording templates, not data -- the
# dimension that fills each slot (and therefore which clause is used) is
# read from the session's own scores every time.
_STRENGTH_CLAUSE = {
    "strategic_thinking": "Your final model weights tracked what the evidence actually supports",
    "capital_allocation": "You sized positions in rough proportion to your own convictions",
    "risk_management": "You spread real capital across genuinely distinct bets",
    "adaptability": "You revised your beliefs sensibly as new evidence arrived",
    "long_term_value": "You anchored conviction on the traits with durable signal",
}
_KEEP_DOING_CLAUSE = {
    "strategic_thinking": "keep letting the evidence set the final weights.",
    "capital_allocation": "keep sizing positions to match your own model's ranking.",
    "risk_management": "keep doing what earned this.",
    "adaptability": "keep revising in the direction the evidence points.",
    "long_term_value": "keep anchoring conviction on durable signal.",
}


def _dim_key(d: dict[str, Any]) -> str:
    return d.get("key", "")


def render_scorecard(
    *,
    user_name: str,
    fund_label: str,
    role_label: str,
    exercise_name: str,
    session: Any,
    scorecard: dict[str, Any],
    fund: dict[str, Any],
    rate: float,
    provenance_asked_independently: bool | None = None,
) -> str:
    """Render the scorecard as a self-contained HTML document.

    Parameters mirror what `report.py::render` already receives from the
    session -- `scorecard` is the dict `build_scorecard()` produces (so
    `scorecard["myelin"]` and `scorecard["dimensions"]` are both available),
    and `fund` is `resolve_fund()`'s output.
    """
    e = html.escape
    generated = datetime.now(timezone.utc).strftime("%d %B %Y")

    myelin = scorecard.get("myelin") or {}
    dims = myelin.get("dimensions") or []
    process = {d.get("key"): d for d in scorecard.get("dimensions") or []}
    revision = process.get("revision_quality") or {}
    moves = (revision.get("components") or {}).get("moves") or []

    total = myelin.get("total", 0)
    band = (myelin.get("band") or "").upper()

    strongest = max(dims, key=lambda d: d.get("score", 0)) if dims else None
    weakest = min(dims, key=lambda d: d.get("score", 0)) if dims else None

    defining_pattern = (
        f"{strongest['label']} strong, {weakest['label'].lower()} exposed"
        if strongest and weakest and strongest is not weakest
        else (strongest["label"] if strongest else "\u2014")
    )

    profile_clause = _STRENGTH_CLAUSE.get(
        _dim_key(strongest) if strongest else "", strongest["label"] if strongest else ""
    )
    decision_profile = (
        f"{profile_clause} \u2014 but {weakest['label'].lower()} is where this "
        f"session cost you the most."
        if strongest and weakest
        else "Not enough of this session was scored to build a profile."
    )

    hits = fund.get("hits", 0)
    cheques = fund.get("cheques", 0)
    if cheques == 0:
        final_outcome = "No positions were deployed this session."
    elif hits == 0:
        final_outcome = (
            f"None of your {cheques} positions succeeded. Combined with the process "
            f"gaps above, this points to real gaps in how the thesis was built, not "
            f"just bad luck."
        )
    elif hits == cheques:
        final_outcome = (
            f"All {cheques} of your positions succeeded. The process score above is "
            f"still the more reliable read on how the decisions were actually made."
        )
    else:
        final_outcome = (
            f"{hits} of your {cheques} positions succeeded. The process score above "
            f"is scored independently of this outcome."
        )

    # ---- Thesis, as locked -------------------------------------------------
    variables = session.thesis_variables or []
    confidence = session.thesis_confidence or {}
    thesis_decision = (
        ", ".join(
            f"{e(P.FEATURE_LABELS.get(v, v))} ({confidence.get(v, '\u2014')}%)"
            for v in variables
        )
        or "No variables were selected."
    )
    falsification = e(session.falsification) if session.falsification else "(left blank)"

    # ---- Committee ----------------------------------------------------------
    committee_answers = session.committee_answers or []
    committee_response = (
        e(committee_answers[0].get("answer", "")) if committee_answers else "(no response)"
    )
    provenance_note = None
    if provenance_asked_independently is not None:
        provenance_note = (
            "You raised the provenance question yourself, before it was asked."
            if provenance_asked_independently
            else "The provenance question was asked of you \u2014 it was not raised independently."
        )

    # ---- Model rebuilt --------------------------------------------------------
    correct_moves = sum(1 for m in moves if m.get("correct_direction"))
    model_rebuilt_summary = (
        f"{len(moves)} variable{'s' if len(moves) != 1 else ''} changed after the "
        f"reveal, {correct_moves} in the correct direction"
    )
    revision_gap = len(moves) > 0 and correct_moves < len(moves)

    adapt_rows = "".join(
        f"""<tr>
          <td>{e(m['label'])}</td>
          <td class="mono">{session.w1_snapshot.get(m['feature'], 0) if session.w1_snapshot else 0:+g}</td>
          <td class="mono">{(session.w1_snapshot.get(m['feature'], 0) if session.w1_snapshot else 0) + m['delta']:+g}</td>
          <td class="{'ok' if m['correct_direction'] else 'bad'}">{'Yes' if m['correct_direction'] else 'No'}</td>
        </tr>"""
        for m in moves
    ) or '<tr><td colspan="4">No weights were revised after the reveal.</td></tr>'

    # ---- Capital deployed -------------------------------------------------
    picks = session.picks or []
    fund_rows = fund.get("rows") or []
    distinct_sectors = len({r.get("sector") for r in fund_rows})
    concentrated = 0 < distinct_sectors < len(fund_rows)
    capital_decision = (
        f"{len(fund_rows)} position{'s' if len(fund_rows) != 1 else ''}, "
        + (
            "two or more of your positions landed in the same sector "
            if concentrated
            else "each position landed in a distinct sector "
        )
        + f"({distinct_sectors} distinct sector{'s' if distinct_sectors != 1 else ''} of "
        f"{len(fund_rows)} position{'s' if len(fund_rows) != 1 else ''})."
    )
    deployed = _scorecard_money(fund.get("deployed_usd", 0), rate)
    returned = _scorecard_money(fund.get("returned_usd", 0), rate)
    capital_consequence = f"{hits} of {cheques} succeeded. {returned} returned on {deployed} deployed."

    # ---- Dimension rows (page 3) --------------------------------------------
    dim_rows = "".join(
        f"""<div class="dim-row">
          <div class="dim-head"><strong>{e(d['label'])}</strong><span>{d['score']}</span></div>
          <p>{e(d['detail'])}</p>
        </div>"""
        for d in dims
    )

    # ---- Final score explained ----------------------------------------------
    ranked = sorted(dims, key=lambda d: -d.get("score", 0))
    strongest_lines = "".join(
        f'<div class="contrib good">+{d["score"]} {e(d["label"])}</div>'
        for d in ranked[:1]
    )
    weakest_lines = "".join(
        f'<div class="contrib">{d["score"]}/{d["max"]} {e(d["label"])}</div>'
        for d in ranked[1:]
    )

    logo_uri = _scorecard_logo_data_uri()
    logo_img = (
        f'<img src="{logo_uri}" alt="Meridian Partners" class="brand-logo" />'
        if logo_uri
        else '<span class="brand-fallback">MERIDIAN PARTNERS</span>'
    )

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Decision scorecard \u2014 {e(user_name)}</title>
<style>
  :root {{
    --ink-1:#ffffff; --ink-2:rgba(255,255,255,.82); --ink-3:rgba(255,255,255,.68);
    --ink-4:rgba(255,255,255,.54); --ink-5:rgba(255,255,255,.38);
    --line:rgba(94,234,212,.16); --line-soft:rgba(94,234,212,.09);
    --teal:#2dd4bf; --teal-soft:#5eead4; --coral:#f2776a;
    --bg:#050807; --card:#0b1513;
  }}
  * {{ box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; color-adjust:exact; }}
  body {{
    margin:0; background:var(--bg); color:var(--ink-2);
    font-family:'Geist Mono', ui-monospace, Menlo, monospace; font-size:13px;
    max-width:900px; margin:0 auto; padding:0 0 60px;
  }}
  section {{ padding:34px 44px; border-bottom:1px solid var(--line-soft); }}
  section:last-of-type {{ border-bottom:none; }}
  .brand-row {{ display:flex; align-items:center; gap:14px; padding:26px 44px 20px; }}
  .brand-logo {{ height:34px; }}
  .brand-fallback {{ color:var(--ink-1); font-weight:600; letter-spacing:.08em; }}
  .brand-tag {{ color:var(--ink-4); font-size:10px; letter-spacing:.1em; text-transform:uppercase; border-left:1px solid var(--line); padding-left:14px; }}
  .eyebrow {{ font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--teal-soft); margin:0 0 8px; }}
  .eyebrow.warn {{ color:var(--coral); }}
  h1 {{ font-family:'Instrument Serif', Georgia, serif; font-weight:400; font-size:30px; color:var(--ink-1); margin:0 0 6px; }}
  h2 {{ font-family:'Instrument Serif', Georgia, serif; font-weight:400; font-size:22px; color:var(--ink-1); margin:0 0 18px; }}
  .meta {{ color:var(--ink-5); font-size:11px; margin-bottom:22px; }}
  .score-row {{ display:flex; gap:26px; align-items:flex-start; margin:18px 0 22px; }}
  .score-block {{ min-width:120px; }}
  .score-num {{ font-family:'Instrument Serif', Georgia, serif; font-size:44px; color:var(--ink-1); line-height:1; }}
  .score-band {{ color:var(--teal-soft); font-size:11px; letter-spacing:.08em; text-transform:uppercase; margin-top:4px; }}
  .score-quote {{ border-left:1px solid var(--line); padding-left:20px; color:var(--ink-3); font-style:italic; line-height:1.6; }}
  .panel {{ border:1px solid var(--line-soft); border-radius:8px; padding:16px 18px; margin:18px 0; background:var(--card); }}
  .panel p {{ color:var(--ink-2); font-style:italic; line-height:1.55; margin:0; }}
  .fact {{ margin:16px 0; }}
  .fact .eyebrow {{ margin-bottom:4px; }}
  .fact strong {{ color:var(--ink-1); font-weight:560; }}
  .step {{ border:1px solid var(--line-soft); border-radius:8px; padding:16px 18px; margin-bottom:14px; background:var(--card); position:relative; }}
  .step-head {{ display:flex; justify-content:space-between; align-items:baseline; }}
  .step-title {{ color:var(--ink-1); font-weight:560; font-size:12px; letter-spacing:.03em; text-transform:uppercase; }}
  .step-tag {{ font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--coral); }}
  .step-label {{ color:var(--ink-5); font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; margin-top:10px; }}
  .step-value {{ color:var(--ink-2); margin-top:3px; }}
  .step-note {{ border-left:2px solid var(--coral); padding-left:10px; color:var(--coral); margin-top:8px; font-size:12px; }}
  .dim-row {{ padding:14px 0; border-bottom:1px solid var(--line-soft); }}
  .dim-row:last-child {{ border-bottom:none; }}
  .dim-head {{ display:flex; justify-content:space-between; color:var(--ink-1); font-weight:560; margin-bottom:5px; }}
  .dim-row p {{ color:var(--ink-3); margin:0; line-height:1.5; }}
  table {{ width:100%; border-collapse:collapse; font-size:12px; margin-top:6px; }}
  th {{ text-align:left; color:var(--ink-5); font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; padding:8px 10px 8px 0; border-bottom:1px solid var(--line); }}
  td {{ padding:9px 10px 9px 0; border-bottom:1px solid var(--line-soft); color:var(--ink-3); }}
  td.mono {{ font-family:'Geist Mono', monospace; }}
  td.ok {{ color:var(--teal-soft); }}
  td.bad {{ color:var(--coral); }}
  .contrib {{ padding:7px 0; border-bottom:1px solid var(--line-soft); color:var(--ink-3); font-size:12px; }}
  .contrib.good {{ color:var(--teal-soft); }}
  .stat-grid {{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin:16px 0; }}
  .stat {{ border:1px solid var(--line-soft); border-radius:8px; padding:14px; background:var(--card); }}
  .stat .k {{ color:var(--ink-5); font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:6px; }}
  .stat .v {{ color:var(--ink-1); font-size:18px; font-family:'Geist Mono', monospace; }}
  .footnote {{ color:var(--ink-4); font-size:11px; line-height:1.6; margin-top:14px; }}
  .footer {{ color:var(--ink-5); font-size:10px; padding:18px 44px 0; display:flex; justify-content:space-between; }}
  @media print {{ body {{ max-width:none; }} section {{ break-inside:avoid; }} }}
</style></head><body>

<div class="brand-row">
  {logo_img}
  <span class="brand-tag">Decision Intelligence</span>
</div>

<section>
  <div class="eyebrow">{e(fund_label)} \u00b7 {e(role_label)}</div>
  <h1>What your decisions<br>revealed about you</h1>
  <div class="meta">{e(exercise_name)} \u00b7 {generated}</div>

  <div class="score-row">
    <div class="score-block">
      <div class="eyebrow">Final score</div>
      <div class="score-num">{total}</div>
      <div class="score-band">{e(band)}</div>
    </div>
    <div>
      <div class="eyebrow">Final outcome, as recorded</div>
      <div class="score-quote">"{final_outcome}"</div>
    </div>
  </div>

  <div class="panel">
    <div class="eyebrow" style="margin-bottom:8px;">Decision-maker profile</div>
    <p>{decision_profile}</p>
  </div>

  <div class="fact">
    <div class="eyebrow">Strongest dimension</div>
    <div>{e(strongest['label']) if strongest else '\u2014'} \u2014 <strong>{strongest['score'] if strongest else '\u2014'}</strong></div>
  </div>
  <div class="fact">
    <div class="eyebrow warn">Most exposed dimension</div>
    <div>{e(weakest['label']) if weakest else '\u2014'} \u2014 <strong>{weakest['score'] if weakest else '\u2014'}</strong></div>
  </div>
  <div class="fact">
    <div class="eyebrow">Defining pattern</div>
    <div>{e(defining_pattern)}</div>
  </div>
</section>

<section>
  <div class="eyebrow">The session you created</div>
  <h2>From first decision to final outcome</h2>

  <div class="step">
    <div class="step-head"><span class="step-title">Thesis locked</span></div>
    <div class="step-label">Decision</div>
    <div class="step-value">{thesis_decision}</div>
    <div class="step-label">Falsification criterion</div>
    <div class="step-value">{falsification}</div>
  </div>

  <div class="step">
    <div class="step-head"><span class="step-title">Committee challenge</span></div>
    <div class="step-label">Your response</div>
    <div class="step-value">{committee_response}</div>
    {f'<div class="step-note">{e(provenance_note)}</div>' if provenance_note else ''}
  </div>

  <div class="step">
    <div class="step-head">
      <span class="step-title">Model rebuilt</span>
      {'<span class="step-tag">Revision gap</span>' if revision_gap else ''}
    </div>
    <div class="step-label">Decision</div>
    <div class="step-value">{e(model_rebuilt_summary)}</div>
  </div>

  <div class="step">
    <div class="step-head">
      <span class="step-title">Capital deployed</span>
      {'<span class="step-tag">Exposed moment</span>' if concentrated else ''}
    </div>
    <div class="step-label">Decision</div>
    <div class="step-value">{e(capital_decision)}</div>
    <div class="step-label">Consequence</div>
    <div class="step-value">{e(capital_consequence)}</div>
  </div>
</section>

<section>
  <div class="eyebrow">Your decision profile</div>
  <h2>Every dimension this session measured</h2>
  {dim_rows}
</section>

{f'''<section>
  <div class="eyebrow">Your biggest strength</div>
  <h2>{e(strongest["label"])} \u2014 {strongest["score"]}</h2>
  <div class="step-label">Evidence</div>
  <div class="step-value">{e(strongest["detail"])}</div>
</section>''' if strongest else ''}

{f'''<section>
  <div class="eyebrow warn">Your biggest decision risk</div>
  <h2>{e(weakest["label"])} \u2014 {weakest["score"]}</h2>
  <div class="step-label">The evidence</div>
  <div class="step-value">{e(weakest["detail"])}</div>
  <div class="step-label" style="margin-top:12px;">What this suggests</div>
  <div class="step-value">{e(weakest["detail"])} This is what the record shows in this run, not a claim about how you'd decide outside this exercise.</div>
</section>''' if weakest else ''}

<section>
  <div class="eyebrow">How you adapted</div>
  <h2>Every belief you revised after the reveal</h2>
  <table>
    <thead><tr><th>Variable</th><th>Before</th><th>After</th><th>Correct direction?</th></tr></thead>
    <tbody>{adapt_rows}</tbody>
  </table>
</section>

<section>
  <div class="eyebrow">Final score explained</div>
  <h2>{total} overall</h2>
  <div class="step-label" style="margin-bottom:6px;">Strongest contributor</div>
  {strongest_lines}
  <div class="step-label" style="margin:14px 0 6px;">Weakest contributors</div>
  {weakest_lines}
</section>

<section>
  <div class="eyebrow">What happened to the outcome</div>
  <h2>Fund result, held apart from judgment</h2>
  <div class="stat-grid">
    <div class="stat"><div class="k">Deployed</div><div class="v">{deployed}</div></div>
    <div class="stat"><div class="k">Returned</div><div class="v">{returned}</div></div>
    <div class="stat"><div class="k">Hit rate</div><div class="v">{hits} / {cheques}</div></div>
    <div class="stat"><div class="k">Fund weight in score</div><div class="v">Zero, by design</div></div>
  </div>
  <p class="footnote">{e(fund.get("note", ""))}</p>
</section>

<section>
  <div class="eyebrow">Your next move</div>
  <h2>Where to spend your next rep</h2>
  <div class="panel">
    <div class="eyebrow" style="margin-bottom:8px;">Strongest capability</div>
    <p>{e(strongest["label"]) if strongest else '\u2014'} \u2014 {_KEEP_DOING_CLAUSE.get(_dim_key(strongest) if strongest else "", "keep doing what earned this.")} {e(strongest["detail"]) if strongest else ""}</p>
  </div>
  <div class="panel">
    <div class="eyebrow warn" style="margin-bottom:8px;">Biggest development area</div>
    <p>{e(weakest["label"]) if weakest else '\u2014'} \u2014 revisit this dimension's evidence above before your next session.</p>
  </div>
</section>

<div class="footer"><span>Meridian Partners Decision Intelligence</span><span>{e(user_name)}</span></div>

</body></html>"""
