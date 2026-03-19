"""
Parse Golf Course API JSON per live response shape and published docs.

Detail responses commonly wrap the course in a ``course`` object::

    { "course": { "id", "club_name", "course_name", "location", "tees": {...} } }

Flat shape (docs sample) is also accepted::

    { "id", "club_name", "course_name", "location", "tees": {...} }

Search GET /v1/search → { "courses": [ { "id", "club_name", "course_name", "location" } ] }
Docs: https://api.golfcourseapi.com/docs/api/
"""

from __future__ import annotations

import logging
from typing import Any

from aicaddy.guide.api_errors import GolfCourseAPINoDataError

logger = logging.getLogger(__name__)

DOCS_URL = "https://api.golfcourseapi.com/docs/api/"

MAX_GUIDE_HOLES = 36


def _fail_schema(msg: str) -> None:
    raise GolfCourseAPINoDataError(
        f"{msg} See GET /v1/search and GET /v1/courses/{{id}} in {DOCS_URL}"
    )


def unwrap_course_detail_root(payload: Any) -> dict[str, Any]:
    """
    Return the inner course object.

    Supports ``{"course": {...}}`` (production) and flat ``{"id", "tees", ...}`` (docs).
    """
    if not isinstance(payload, dict):
        _fail_schema("Course detail response must be a JSON object.")
    nested = payload.get("course")
    if isinstance(nested, dict) and "tees" in nested:
        return nested
    if "tees" in payload and isinstance(payload.get("tees"), dict):
        return payload
    _fail_schema(
        "Course detail must include 'tees' at top level or under 'course' "
        "(e.g. {'course': {'id', 'tees', ...}})."
    )


def parse_search_response(payload: Any) -> list[dict[str, Any]]:
    """Validate search JSON; return the ``courses`` list."""
    if not isinstance(payload, dict):
        _fail_schema("Search response must be a JSON object.")
    raw = payload.get("courses")
    if raw is None:
        _fail_schema("Search response missing top-level 'courses' array.")
    if not isinstance(raw, list):
        _fail_schema("Search response 'courses' must be an array.")
    return raw  # type: ignore[return-value]


def parse_course_detail_response(payload: Any) -> dict[str, Any]:
    """Validate course detail; return unwrapped course dict with ``id`` and ``tees``."""
    course = unwrap_course_detail_root(payload)
    if "id" not in course:
        _fail_schema("Course object missing required 'id'.")
    if "tees" not in course or not isinstance(course.get("tees"), dict):
        _fail_schema("Course object missing required 'tees' object.")
    return course


def pick_tee_box_with_holes(tees: Any) -> tuple[str, dict[str, Any]]:
    """
    From ``tees`` (male/female arrays of tee boxes), pick the tee with the largest
    ``total_yards`` that has a non-empty ``holes`` list.

    Returns (label e.g. ``male/Blue``, full selected tee dict including ``holes``).
    """
    if not isinstance(tees, dict):
        _fail_schema("'tees' must be an object with 'male' and/or 'female' arrays.")

    candidates: list[tuple[str, dict[str, Any], int]] = []

    for gender in ("male", "female"):
        boxes = tees.get(gender)
        if not isinstance(boxes, list):
            continue
        for tee in boxes:
            if not isinstance(tee, dict):
                continue
            hole_list = tee.get("holes")
            if not isinstance(hole_list, list) or len(hole_list) == 0:
                continue
            tee_name = str(tee.get("tee_name") or "tee")
            total_yards = tee.get("total_yards")
            yards_sort = (
                int(total_yards) if isinstance(total_yards, (int, float)) else 0
            )
            label = f"{gender}/{tee_name}"
            candidates.append((label, tee, yards_sort))

    if not candidates:
        _fail_schema(
            "No tee box with a non-empty 'holes' array under tees.male or tees.female."
        )

    candidates.sort(key=lambda x: x[2], reverse=True)
    label, tee, _ = candidates[0]
    logger.info(
        "Using Golf Course API tee box %r (%s holes, total_yards=%s)",
        label,
        len(tee.get("holes") or []),
        tee.get("total_yards"),
    )
    return label, tee


def _optional_num(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, (int, float)):
        if val == int(val):
            return str(int(val))
        return str(round(val, 2))
    return str(val)


def tee_summary_dict(tee: dict[str, Any], label: str) -> dict[str, Any]:
    """Flat dict of tee fields for PDF / RAG (all API fields we care to show)."""
    return {
        "label": label,
        "tee_name": tee.get("tee_name"),
        "total_yards": tee.get("total_yards"),
        "total_meters": tee.get("total_meters"),
        "number_of_holes": tee.get("number_of_holes"),
        "par_total": tee.get("par_total"),
        "course_rating": tee.get("course_rating"),
        "slope_rating": tee.get("slope_rating"),
        "bogey_rating": tee.get("bogey_rating"),
        "front_course_rating": tee.get("front_course_rating"),
        "front_slope_rating": tee.get("front_slope_rating"),
        "front_bogey_rating": tee.get("front_bogey_rating"),
        "back_course_rating": tee.get("back_course_rating"),
        "back_slope_rating": tee.get("back_slope_rating"),
        "back_bogey_rating": tee.get("back_bogey_rating"),
    }


def collect_all_tee_summaries(tees: dict[str, Any]) -> list[dict[str, Any]]:
    """Every tee (male/female) that has holes, for summary table."""
    rows: list[dict[str, Any]] = []
    for gender in ("male", "female"):
        boxes = tees.get(gender)
        if not isinstance(boxes, list):
            continue
        for tee in boxes:
            if not isinstance(tee, dict):
                continue
            h = tee.get("holes")
            if not isinstance(h, list) or len(h) == 0:
                continue
            label = f"{gender}/{tee.get('tee_name') or 'tee'}"
            d = tee_summary_dict(tee, label)
            d["hole_count"] = len(h)
            rows.append(d)
    rows.sort(
        key=lambda r: (
            int(r["total_yards"] or 0)
            if isinstance(r.get("total_yards"), (int, float))
            else 0
        ),
        reverse=True,
    )
    return rows


def format_location_lines(location: Any) -> list[str]:
    lines: list[str] = []
    if not isinstance(location, dict):
        return lines
    addr = location.get("address")
    if addr:
        lines.append(f"Address: {addr}")
    city = location.get("city")
    state = location.get("state")
    country = location.get("country")
    parts = [p for p in (city, state, country) if p]
    if parts:
        lines.append(f"City / region: {', '.join(str(p) for p in parts)}")
    lat = location.get("latitude")
    lng = location.get("longitude")
    if lat is not None and lng is not None:
        lines.append(f"GPS: {lat}, {lng}")
    return lines


def format_tee_metadata_lines(meta: dict[str, Any]) -> list[str]:
    """Human-readable lines for the reference tee block."""
    lines: list[str] = [f"Tee set: {meta.get('label') or ''}"]
    for key, title in (
        ("total_yards", "Total yards"),
        ("total_meters", "Total meters"),
        ("par_total", "Par (card)"),
        ("number_of_holes", "Holes (tee metadata)"),
        ("course_rating", "Course rating"),
        ("slope_rating", "Slope rating"),
        ("bogey_rating", "Bogey rating"),
    ):
        v = meta.get(key)
        if v is not None:
            lines.append(f"{title}: {_optional_num(v)}")
    fc = meta.get("front_course_rating")
    fs = meta.get("front_slope_rating")
    fb = meta.get("front_bogey_rating")
    if any(x is not None for x in (fc, fs, fb)):
        lines.append(
            f"Front nine — CR {_optional_num(fc)}, "
            f"Slope {_optional_num(fs)}, Bogey {_optional_num(fb)}"
        )
    bc = meta.get("back_course_rating")
    bs = meta.get("back_slope_rating")
    bb = meta.get("back_bogey_rating")
    if any(x is not None for x in (bc, bs, bb)):
        lines.append(
            f"Back nine — CR {_optional_num(bc)}, "
            f"Slope {_optional_num(bs)}, Bogey {_optional_num(bb)}"
        )
    return lines


def format_all_tees_summary_lines(summaries: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    for s in summaries:
        label = s.get("label", "")
        yds = _optional_num(s.get("total_yards"))
        m = _optional_num(s.get("total_meters"))
        par = _optional_num(s.get("par_total"))
        cr = _optional_num(s.get("course_rating"))
        sl = _optional_num(s.get("slope_rating"))
        bg = _optional_num(s.get("bogey_rating"))
        hc = s.get("hole_count", "")
        fc = _optional_num(s.get("front_course_rating"))
        fs = _optional_num(s.get("front_slope_rating"))
        fbo = _optional_num(s.get("front_bogey_rating"))
        bc = _optional_num(s.get("back_course_rating"))
        bs = _optional_num(s.get("back_slope_rating"))
        bbo = _optional_num(s.get("back_bogey_rating"))
        meter_bit = f", {m} m" if m else ""
        bogey_bit = f", Bogey {bg}" if bg else ""
        nine_bit = ""
        if any((fc, fs, fbo, bc, bs, bbo)):
            nine_bit = f" | F9 CR/S/BR {fc}/{fs}/{fbo} | B9 CR/S/BR {bc}/{bs}/{bbo}"
        lines.append(
            f"- {label}: {yds} yds{meter_bit}, Par {par}, "
            f"CR {cr}, Slope {sl}{bogey_bit}, {hc} holes{nine_bit}"
        )
    return lines


def normalize_holes_for_guide(
    raw_holes: list[dict[str, Any]], *, max_holes: int = MAX_GUIDE_HOLES
) -> list[dict[str, Any]]:
    """Turn API hole rows into the shape expected by PDF/LLM (1-based hole number)."""
    out: list[dict[str, Any]] = []
    for i, h in enumerate(raw_holes[:max_holes]):
        if not isinstance(h, dict):
            continue
        par = h.get("par")
        yardage = h.get("yardage")
        try:
            par_i = int(par) if par is not None else 4
        except (TypeError, ValueError):
            par_i = 4
        try:
            yds_i = int(yardage) if yardage is not None else None
        except (TypeError, ValueError):
            yds_i = None
        hdcp = h.get("handicap")
        try:
            hdcp_i = int(hdcp) if hdcp is not None else None
        except (TypeError, ValueError):
            hdcp_i = None
        out.append(
            {
                "number": i + 1,
                "par": par_i,
                "yardage": yds_i,
                "handicap": hdcp_i,
            }
        )
    return out


def build_guide_payload_from_course_detail(
    raw_detail: dict[str, Any], *, search_query: str
) -> dict[str, Any]:
    """
    Normalized payload for yardage PDF: title, location, reference tee stats,
    all-tee summary, holes (normalized).
    """
    detail = parse_course_detail_response(raw_detail)
    api_id = detail.get("id")
    course_name = (detail.get("course_name") or "").strip()
    club_name = (detail.get("club_name") or "").strip()
    if course_name and club_name and course_name != club_name:
        title = f"{course_name} — {club_name}"
    elif course_name:
        title = course_name
    elif club_name:
        title = club_name
    else:
        title = search_query.strip()

    location_lines = format_location_lines(detail.get("location"))
    tees_obj = detail["tees"]
    all_tee_rows = collect_all_tee_summaries(tees_obj)

    tee_label, selected_tee = pick_tee_box_with_holes(tees_obj)
    raw_holes_list = selected_tee.get("holes")
    if not isinstance(raw_holes_list, list):
        _fail_schema("Selected tee must contain a 'holes' array.")
    holes = normalize_holes_for_guide(raw_holes_list)
    if not holes:
        _fail_schema("Normalized hole list is empty.")

    reference_tee_meta = tee_summary_dict(selected_tee, tee_label)

    return {
        "title": title,
        "holes": holes,
        "tee_label": tee_label,
        "api_course_id": api_id,
        "club_name": club_name or None,
        "course_name": course_name or None,
        "location_lines": location_lines,
        "reference_tee_meta": reference_tee_meta,
        "reference_tee_lines": format_tee_metadata_lines(reference_tee_meta),
        "all_tees_summaries": all_tee_rows,
        "all_tees_summary_lines": format_all_tees_summary_lines(all_tee_rows),
    }


def first_search_hit_course_id(courses: list[Any]) -> int:
    """Return numeric ``id`` from first search hit."""
    if not courses:
        raise GolfCourseAPINoDataError("No courses in search results.")
    hit = courses[0]
    if not isinstance(hit, dict):
        _fail_schema("Each search 'courses' element must be an object.")
    cid = hit.get("id")
    if cid is None:
        _fail_schema(
            "Search hit missing numeric 'id'; cannot call GET /v1/courses/{id}."
        )
    try:
        return int(cid)
    except (TypeError, ValueError) as e:
        raise GolfCourseAPINoDataError("Search hit 'id' must be an integer.") from e
