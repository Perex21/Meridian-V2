from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete as sql_delete, desc, select
from sqlalchemy.exc import IntegrityError

from ..committee import N_PARTNERS
from ..config import settings
from ..deps import Db, OwnedSession
from ..models import Report, Scorecard, TelemetryEvent, User
from ..models import Session as RunSession
from ..registry import dataset_summary, get_dataset
from ..schemas import (
    ChartViewRequest,
    MetricPairRequest,
    ScreenRequest,
    SessionOut,
    SessionSummary,
)
from ..scoring import VALID_CHART_IDS, aggregate
from ..sim import parameters as P
from ..service import (
    SCREEN_LABELS,
    assert_can_enter,
    deliberation_remaining,
    rail,
    record_event,
    set_screen,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _utc(dt: datetime | None) -> datetime | None:
    """Ensure a datetime has UTC tzinfo for consistent JSON serialization."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# Every run is attached to this one shared row rather than to nothing at all.
#
# `sessions.user_id` is NOT NULL in any database created before sign-in was
# removed, and `create_all` only creates absent tables -- it never alters an
# existing one. Inserting a NULL there fails with an integrity error on exactly
# the deployments that already have data. A single anonymous owner satisfies the
# constraint on an old database and is equally correct on a fresh one, and it
# keeps the report renderer's `run.user.name` lookup working.
GUEST_USER_ID = "00000000-0000-0000-0000-000000000000"
GUEST_EMAIL = "guest@meridian.local"


async def _guest_user(db: Db) -> User:
    """Return the shared anonymous owner, creating it on first use."""
    user = await db.get(User, GUEST_USER_ID)
    if user is not None:
        return user

    # A concurrent request may have inserted it between the read and the write.
    user = User(
        id=GUEST_USER_ID,
        email=GUEST_EMAIL,
        # No credential is ever checked -- there is no sign-in to check it with.
        hashed_password="",
        name="Analyst",
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        existing = await db.get(User, GUEST_USER_ID)
        if existing is None:
            raise
        return existing
    return user


@router.post("", response_model=SessionOut, status_code=201)
async def create_session(db: Db) -> RunSession:
    """Open a run. No sign-in, no ownership -- anyone may start one."""
    seed = settings.default_cohort_seed
    ds = get_dataset(seed)
    guest = await _guest_user(db)
    run = RunSession(
        user_id=guest.id,
        cohort_id=None,
        seed=seed,
        dataset_fingerprint=ds.fingerprint,
    )
    db.add(run)
    await db.flush()
    return run


@router.get("", response_model=list[SessionSummary])
async def list_sessions(db: Db) -> list[SessionSummary]:
    """List all sessions (no user filtering since auth is removed)."""
    stmt = (
        select(RunSession, Scorecard)
        .outerjoin(Scorecard, Scorecard.session_id == RunSession.id)
        .order_by(desc(RunSession.created_at))
    )
    rows = (await db.execute(stmt)).all()
    return [
        SessionSummary(
            id=run.id,
            status=run.status,
            current_screen=run.current_screen,
            total_score=card.total if card else None,
            band=card.band if card else None,
            hits=(run.fund_result or {}).get("hits") if run.fund_result else None,
            created_at=run.created_at,
            furthest_screen=run.furthest_screen,
            furthest_label=SCREEN_LABELS.get(run.furthest_screen, run.furthest_screen),
            deployed=run.deployed,
            completed_at=run.completed_at,
            thesis_variables=run.thesis_variables,
        )
        for run, card in rows
    ]


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(run: OwnedSession) -> RunSession:
    return run


@router.get("/{session_id}/state")
async def get_state(run: OwnedSession) -> dict:
    """Everything the client needs to render the shell on any screen."""
    return {
        "session_id": run.id,
        # The client restores a session id from localStorage and needs to know
        # whether it is resuming live work or reopening a finished run.
        "status": run.status,
        "current_screen": run.current_screen,
        "furthest_screen": run.furthest_screen,
        "rail": rail(run),
        "thesis_locked": run.thesis_locked,
        "thesis_variables": run.thesis_variables,
        "thesis_confidence": run.thesis_confidence,
        "falsification": run.falsification,
        "archive_unlocked": run.archive_unlocked,
        "committee_answered": len(run.committee_answers or []),
        "committee_total": N_PARTNERS,
        "deliberation_remaining": deliberation_remaining(run),
        "model_weights": run.model_weights,
        "picks": run.picks or [],
        "deployed": run.deployed,
        "summary": dataset_summary(
            get_dataset(run.seed), archive_unlocked=run.archive_unlocked
        ),
    }


@router.post("/{session_id}/screen")
async def advance(body: ScreenRequest, run: OwnedSession, db: Db) -> dict:
    assert_can_enter(run, body.screen, N_PARTNERS)
    set_screen(run, body.screen)
    db.add(run)
    return {"current_screen": run.current_screen, "rail": rail(run)}


@router.post("/{session_id}/telemetry/chart", status_code=202)
async def chart_viewed(body: ChartViewRequest, run: OwnedSession, db: Db) -> dict:
    """The one client-reported signal.

    A hover is not observable server-side, so this endpoint exists. It is
    validated against an allowlist and deduplicated at scoring time, which caps
    what a hand-rolled POST can earn at the same 2 points per chart a real
    student gets -- across at most 10 known charts.
    """
    if body.chart_id not in VALID_CHART_IDS:
        return {"recorded": False, "reason": "unknown chart id"}
    await record_event(db, run, "chart_viewed", subject=body.chart_id)
    return {"recorded": True}


@router.post("/{session_id}/telemetry/metric", status_code=202)
async def metric_pair_explored(
    body: MetricPairRequest, run: OwnedSession, db: Db
) -> dict:
    """A cross-plot axis pairing the student actually put on screen.

    The four continuous metrics are the only genuinely causal evidence that
    cannot be read off one company, and nothing in the simulation observed a
    student looking at them -- so Evidence Depth could not credit it. Like the
    chart endpoint this is client-reported, and bounded the same way: the pair is
    validated against the four known metric keys and deduplicated at scoring
    time, so there are only six pairs to be had and a hand-rolled POST earns no
    more than moving the two selects does.
    """
    if body.x == body.y:
        return {"recorded": False, "reason": "axes must differ"}
    unknown = [k for k in (body.x, body.y) if k not in P.CONTINUOUS_KEYS]
    if unknown:
        return {"recorded": False, "reason": f"unknown metric: {unknown}"}
    await record_event(
        db, run, "metric_pair_explored", subject="|".join(sorted((body.x, body.y)))
    )
    return {"recorded": True}


# --------------------------------------------------------------------------
# Session history
# --------------------------------------------------------------------------
# The student's own record of a run, for their review after the fact. This is
# deliberately NOT the facilitator audit log (`/admin/sessions/{id}/audit`),
# which returns raw telemetry rows: a thorough run produces several hundred of
# them, and a list that long is not a history anyone reads.
#
# So: discrete milestones in order, aggregate activity totals, and which screens
# the work actually happened on. Nothing is disclosed earlier than the flow
# already discloses it -- every outcome-bearing field below is read off state
# that only exists once the fund is deployed.
_MILESTONE_LABELS = {
    "thesis_locked": "Locked the thesis",
    "archive_unlocked": "Opened the recovered archive",
    "model_baseline_captured": "Started building the scoring model",
    "fund_deployed": "Deployed the fund",
}


def _thesis_block(run: RunSession) -> dict | None:
    if not run.thesis_locked:
        return None
    confidence = run.thesis_confidence or {}
    return {
        "locked_at": run.thesis_locked_at,
        "variables": [
            {
                "key": v,
                "label": P.FEATURE_LABELS.get(v, v),
                "confidence": confidence.get(v),
            }
            for v in (run.thesis_variables or [])
        ],
        "falsification": run.falsification,
    }


def _model_block(run: RunSession) -> dict | None:
    """What the student changed between first seeing the sliders and deploying.

    Only the rows that are non-zero at either end, so the payload is the decision
    rather than sixteen mostly-zero pairs.
    """
    if run.w1_snapshot is None:
        return None
    baseline = run.w1_snapshot or {}
    final = run.model_weights or {}
    changes = []
    for key in P.FEATURE_KEYS:
        was = float(baseline.get(key, 0.0))
        now = float(final.get(key, 0.0))
        if was == 0.0 and now == 0.0:
            continue
        changes.append(
            {
                "key": key,
                "label": P.FEATURE_LABELS.get(key, key),
                "from": round(was, 2),
                "to": round(now, 2),
                "moved": round(now - was, 2),
            }
        )
    return {"changes": changes, "untouched": all(c["moved"] == 0 for c in changes)}


def _allocation_block(run: RunSession) -> dict | None:
    if not run.picks:
        return None
    sizes = run.cheque_sizes or {}
    # `fund_result` only exists after deploy, so outcome is absent until then.
    outcomes = {r["id"]: r["outcome"] for r in (run.fund_result or {}).get("rows", [])}
    return {
        "deployed": run.deployed,
        "deployed_at": run.deployed_at,
        "positions": [
            {
                "id": pid,
                "cheque_usd": sizes.get(str(pid)),
                "outcome": outcomes.get(pid),
            }
            for pid in run.picks
        ],
        "pool_usd": P.FUND_POOL_USD,
        "allocated_usd": sum(sizes.values()) if sizes else None,
    }


@router.get("/{session_id}/history")
async def history(run: OwnedSession, db: Db) -> dict:
    """One session's full record, for the student who ran it."""
    events = (
        await db.execute(
            select(TelemetryEvent)
            .where(TelemetryEvent.session_id == run.id)
            .order_by(TelemetryEvent.created_at)
        )
    ).scalars().all()

    t = aggregate(events)

    # ---- milestones, in the order they happened ----
    answers = run.committee_answers or []
    milestones: list[dict] = [
        {
            "at": _utc(run.created_at),
            "kind": "session_opened",
            "label": "Session opened",
            "detail": f"Dataset {run.dataset_fingerprint}",
        }
    ]
    for e in events:
        if e.kind in _MILESTONE_LABELS:
            detail = ""
            if e.kind == "thesis_locked":
                conf = (e.payload or {}).get("confidence") or {}
                detail = ", ".join(
                    f"{P.FEATURE_LABELS.get(v, v)} at {conf.get(v)}%"
                    for v in ((e.payload or {}).get("variables") or [])
                )
            elif e.kind == "fund_deployed":
                detail = f"{len(((e.payload or {}).get('picks') or []))} cheques written"
            milestones.append(
                {"at": _utc(e.created_at), "kind": e.kind, "label": _MILESTONE_LABELS[e.kind], "detail": detail}
            )
        elif e.kind == "committee_answer":
            try:
                idx = int(e.subject) if e.subject is not None else -1
            except ValueError:
                idx = -1
            partner = answers[idx]["partner"] if 0 <= idx < len(answers) else "a partner"
            milestones.append(
                {
                    "at": _utc(e.created_at),
                    "kind": "committee_answer",
                    "label": f"Answered {partner}",
                    "detail": (e.payload or {}).get("answer", "")[:240],
                }
            )
    if run.completed_at:
        milestones.append(
            {
                "at": _utc(run.completed_at),
                "kind": "completed",
                "label": "Run scored",
                "detail": "",
            }
        )

    # ---- aggregate activity ----
    activity = [
        {"key": "profiles", "label": "Company profiles opened", "count": len(t.profiles)},
        {"key": "comparisons", "label": "Side-by-side comparisons built", "count": t.comparisons},
        {"key": "charts", "label": "Distinct charts studied", "count": len(t.charts)},
        {"key": "metric_pairs", "label": "Metric pairs cross-plotted", "count": len(t.metric_pairs)},
        {"key": "minutes", "label": "Board minutes read", "count": len(t.minutes_opened)},
        {"key": "interviews", "label": "Founder interviews read", "count": len(t.interviews_opened)},
        {
            "key": "cross_source",
            "label": "Companies where both accounts were read",
            "count": len(t.cross_source_companies),
        },
        {
            "key": "contradictions",
            "label": "Contradictions correctly identified",
            "count": len(t.contradictions_correct),
        },
        {
            "key": "false_flags",
            "label": "Contradiction flags that were wrong",
            "count": t.contradictions_incorrect,
        },
    ]

    provenance = [
        {"label": "Asked what data was missing, before the reveal", "done": t.provenance_query_pre_reveal},
        {"label": "Searched for a company absent from the portfolio", "done": t.ghost_query},
        {"label": "Asked for a comparison group, before the reveal", "done": t.comparison_group_pre_reveal},
        {"label": "Questioned the archive after the reveal", "done": t.archive_questioned_post_reveal},
    ]

    # ---- where the work happened, in first-visit order ----
    per_screen: dict[str, int] = {}
    for e in events:
        if e.screen:
            per_screen[e.screen] = per_screen.get(e.screen, 0) + 1
    screens_visited = [
        {"key": k, "label": SCREEN_LABELS.get(k, k), "events": v} for k, v in per_screen.items()
    ]

    # ---- score, only if it has been computed ----
    card = (
        await db.execute(select(Scorecard).where(Scorecard.session_id == run.id))
    ).scalar_one_or_none()
    score = None
    if card:
        full = card.dimensions or {}
        myelin = full.get("myelin") or {}
        score = {
            "total": card.total,
            "band": card.band,
            "max": full.get("max"),
            "myelin_total": myelin.get("total"),
            "myelin_band": myelin.get("band"),
            "myelin_max": myelin.get("max"),
            "dimensions": [
                {"key": d["key"], "label": d["label"], "score": d["score"], "max": d["max"]}
                for d in full.get("dimensions", [])
            ],
            "myelin_dimensions": [
                {"key": d["key"], "label": d["label"], "score": d["score"], "max": d["max"]}
                for d in myelin.get("dimensions", [])
            ],
        }

    fund = run.fund_result or None
    return {
        "session_id": run.id,
        "seed": run.seed,
        "dataset_fingerprint": run.dataset_fingerprint,
        "status": run.status,
        "current_screen": run.current_screen,
        "furthest_screen": run.furthest_screen,
        "furthest_label": SCREEN_LABELS.get(run.furthest_screen, run.furthest_screen),
        "created_at": _utc(run.created_at),
        "completed_at": _utc(run.completed_at),
        "deployed": run.deployed,
        "archive_unlocked": run.archive_unlocked,
        "committee_answered": len(answers),
        "committee_total": N_PARTNERS,
        "thesis": _thesis_block(run),
        "model": _model_block(run),
        "allocation": _allocation_block(run),
        "milestones": milestones,
        "activity": activity,
        "provenance": provenance,
        "screens_visited": screens_visited,
        "event_count": len(events),
        "score": score,
        "fund": {"hits": fund["hits"], "cheques": fund["cheques"]} if fund else None,
    }


# --------------------------------------------------------------------------
# Deleting runs
# --------------------------------------------------------------------------
async def _purge(db: Db, session_ids: list[str]) -> None:
    """Remove sessions and everything hanging off them.

    The child tables all declare `ondelete="CASCADE"`, but SQLite does not
    enforce foreign keys unless `PRAGMA foreign_keys=ON` is set on the
    connection -- which it is not here. Relying on the database to cascade would
    therefore work on Postgres and silently leave orphaned telemetry, scorecards
    and reports on a local SQLite run. Deleting the children explicitly behaves
    identically on both.
    """
    if not session_ids:
        return
    for model in (TelemetryEvent, Scorecard, Report):
        await db.execute(sql_delete(model).where(model.session_id.in_(session_ids)))
    await db.execute(sql_delete(RunSession).where(RunSession.id.in_(session_ids)))


@router.delete("/{session_id}")
async def delete_session(run: OwnedSession, db: Db) -> dict:
    """Delete one run. Irreversible, and it takes the report with it.

    Returns a body rather than a bare 204 because FastAPI refuses to pair a
    204 with a declared response type, and a count is more useful to the caller
    than an empty response.
    """
    await _purge(db, [run.id])
    return {"deleted": 1}


@router.delete("")
async def clear_history(
    db: Db,
    keep: str | None = Query(
        default=None,
        description="Session id to preserve -- normally the run currently open, "
        "so clearing history cannot destroy work in progress.",
    ),
) -> dict:
    """Delete every run, optionally sparing one."""
    rows = (
        await db.execute(select(RunSession.id))
    ).scalars().all()

    if keep is not None and keep not in rows:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "The run you asked to keep does not exist"
        )

    doomed = [sid for sid in rows if sid != keep]
    await _purge(db, doomed)
    return {"deleted": len(doomed), "kept": keep}
