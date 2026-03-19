"""
Generate RAG-compatible professional yardage book PDFs (layout and yardages only).
Requires GolfCourseAPI for hole data; expands each hole via LLM. No non-API fallback.

API schema: https://api.golfcourseapi.com/docs/api/
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

import openai

from course_guide_prompts import (
    HOLE_YARDAGE_BOOK_SYSTEM,
    hole_yardage_book_user_message,
)
from golf_course_api_errors import (
    GolfCourseAPIAuthError,
    GolfCourseAPIConfigError,
    GolfCourseAPIError,
    GolfCourseAPIHTTPError,
    GolfCourseAPINoDataError,
)
from golf_course_api_schema import (
    build_guide_payload_from_course_detail,
    first_search_hit_course_id,
    parse_search_response,
)
from guide_common import course_pdf_path, courses_data_dir

__all__ = [
    "GolfCourseAPIAuthError",
    "GolfCourseAPIConfigError",
    "GolfCourseAPIError",
    "GolfCourseAPIHTTPError",
    "GolfCourseAPINoDataError",
    "fetch_golf_course_api",
    "generate_course_guide",
]

logger = logging.getLogger(__name__)


def _get_client():
    if not os.environ.get("OPENAI_API_KEY"):
        return None
    return openai.OpenAI()


def _golf_course_api_headers(api_key: str) -> dict[str, str]:
    """Golf Course API expects: Authorization: Key <api_key>."""
    key = (api_key or "").strip()
    return {"Authorization": f"Key {key}"}


async def _fetch_json(url: str, headers: dict) -> dict:
    import httpx

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, timeout=10)

        if resp.status_code in (401, 403):
            raise GolfCourseAPIAuthError(
                f"Golf Course API rejected credentials (HTTP {resp.status_code}). "
                "Check GOLF_COURSE_API_KEY and that requests send header "
                "'Authorization: Key <your-key>'."
            )

        if resp.status_code >= 400:
            body = (resp.text or "")[:500]
            raise GolfCourseAPIHTTPError(
                f"Golf Course API request failed (HTTP {resp.status_code}): {body}",
                status_code=resp.status_code,
            )

        data = resp.json()
        if not isinstance(data, dict):
            raise GolfCourseAPIHTTPError(
                "Golf Course API returned non-object JSON (expected an object per API docs).",
                status_code=resp.status_code,
            )
        return data


async def fetch_golf_course_api(course_name: str) -> dict:
    """
    Fetch course from Golf Course API and return a normalized guide payload:
    ``title``, ``holes`` (list of {number, par, yardage, handicap}), ``tee_label``,
    ``api_course_id``, etc. Raises ``GolfCourseAPIError`` on failure.
    """
    cn = (course_name or "").strip()
    if not cn:
        raise GolfCourseAPINoDataError("Course name is empty")

    api_key = os.environ.get("GOLF_COURSE_API_KEY")
    if not api_key:
        raise GolfCourseAPIConfigError(
            "GOLF_COURSE_API_KEY is not set. Course guides require the Golf Course API."
        )

    search_url = f"https://api.golfcourseapi.com/v1/search?search_query={cn}"
    headers = _golf_course_api_headers(api_key)

    search_payload = await _fetch_json(search_url, headers)
    course_rows = parse_search_response(search_payload)
    if not course_rows:
        logger.info("GolfCourseAPI search returned no courses for %r", cn)
        raise GolfCourseAPINoDataError(
            f"No courses found in Golf Course API for {cn!r}."
        )

    cid = first_search_hit_course_id(course_rows)
    detail_url = f"https://api.golfcourseapi.com/v1/courses/{cid}"
    detail = await _fetch_json(detail_url, headers)

    guide = build_guide_payload_from_course_detail(detail, search_query=cn)
    logger.info(
        "GolfCourseAPI guide payload ok for %r id=%s holes=%s tee=%s",
        cn,
        guide.get("api_course_id"),
        len(guide.get("holes", [])),
        guide.get("tee_label"),
    )
    return guide


def _expand_hole_yardage_book_llm(
    hole_num: int, par: int, yardage: int | None, course_name: str
) -> str:
    """Factual yardage-book lines for one hole (requires OpenAI)."""
    client = _get_client()
    if not client:
        raise RuntimeError(
            "OPENAI_API_KEY is required to expand hole text for the yardage book."
        )
    ref_yards = yardage or 400
    try:
        resp = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": HOLE_YARDAGE_BOOK_SYSTEM},
                {
                    "role": "user",
                    "content": hole_yardage_book_user_message(
                        course_name, hole_num, par, ref_yards
                    ),
                },
            ],
            max_tokens=280,
        )
        text = (resp.choices[0].message.content or "").strip()
        return text if text else f"Par {par}. ~{yardage or 'N/A'} yds."
    except Exception as e:
        raise RuntimeError(f"LLM hole expansion failed: {e}") from e


def _generate_guide_content(guide: dict) -> str:
    """Build yardage book text from normalized API guide (location, tee data, holes)."""
    title = (guide.get("title") or "").strip() or "Course"
    holes: list = guide.get("holes") or []
    if not holes:
        raise GolfCourseAPINoDataError("Guide payload has no holes for PDF generation.")

    sections: list[str] = [f"# {title}\n\n"]
    api_cid = guide.get("api_course_id")
    if api_cid is not None:
        sections.append(f"Golf Course API course id: {api_cid}\n\n")

    club = (guide.get("club_name") or "").strip()
    course_only = (guide.get("course_name") or "").strip()
    if club or course_only:
        sections.append("## Names (API)\n\n")
        if club:
            sections.append(f"Club: {club}\n")
        if course_only:
            sections.append(f"Course: {course_only}\n")
        sections.append("\n")

    loc_lines: list = guide.get("location_lines") or []
    if loc_lines:
        sections.append("## Course information\n\n")
        sections.extend(f"{line}\n" for line in loc_lines)
        sections.append("\n")

    ref_tee_lines: list = guide.get("reference_tee_lines") or []
    if ref_tee_lines:
        sections.append("## Reference tee (this book)\n\n")
        sections.extend(f"{line}\n" for line in ref_tee_lines)
        sections.append("\n")

    all_tee_lines: list = guide.get("all_tees_summary_lines") or []
    if all_tee_lines:
        sections.append("## All tee sets (API)\n\n")
        sections.extend(f"{line}\n" for line in all_tee_lines)
        sections.append("\n")

    sections.append("## Hole-by-hole (reference tee)\n\n")

    for idx, h in enumerate(holes):
        if not isinstance(h, dict):
            continue
        num = int(h.get("number") or idx + 1)
        par = int(h.get("par") or 4)
        yds = h.get("yardage")
        handicap = h.get("handicap")
        hdcp_suffix = f", HCP {handicap}" if handicap is not None else ""
        text = _expand_hole_yardage_book_llm(num, par, yds, title)
        yds_disp = yds if yds is not None else "N/A"
        sections.append(
            f"### Hole {num} (Par {par}, {yds_disp} yds{hdcp_suffix})\n\n{text}\n\n"
        )
    return "\n".join(sections)


def _pdf_safe_line(s: str) -> str:
    """Core Helvetica only supports Latin-1; avoid encoding errors."""
    return s.encode("latin-1", errors="replace").decode("latin-1")


def _write_pdf(path: Path, content: str) -> None:
    """Write markdown-like content to PDF using fpdf2."""
    from fpdf import FPDF

    margin = 15
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=margin)
    pdf.set_left_margin(margin)
    pdf.set_right_margin(margin)
    pdf.add_page()
    epw = pdf.w - pdf.l_margin - pdf.r_margin

    for raw in content.split("\n"):
        line = raw.strip()
        if not line:
            continue
        line = _pdf_safe_line(line[:2000])
        pdf.set_x(pdf.l_margin)
        if line.startswith("# "):
            pdf.set_font("Helvetica", "B", 16)
            pdf.multi_cell(epw, 10, line[2:], ln=1)
            pdf.set_font("Helvetica", size=11)
        elif line.startswith("## "):
            pdf.set_font("Helvetica", "B", 12)
            pdf.multi_cell(epw, 8, line[3:], ln=1)
            pdf.set_font("Helvetica", size=11)
        elif line.startswith("### "):
            pdf.set_font("Helvetica", "B", 11)
            pdf.multi_cell(epw, 7, line[4:], ln=1)
            pdf.set_font("Helvetica", size=11)
        else:
            pdf.set_font("Helvetica", size=11)
            pdf.multi_cell(epw, 6, line, ln=1)
    pdf.output(str(path))


async def generate_course_guide(course_name: str) -> Path:
    """
    Generate or return cached course guide PDF.
    Requires Golf Course API + OpenAI. Returns path to PDF file.
    """
    if not course_name or not course_name.strip():
        raise GolfCourseAPINoDataError("Course name is required to generate a guide")
    cn = course_name.strip()
    courses_data_dir()
    path = course_pdf_path(cn)
    if path.exists():
        return path
    guide = await fetch_golf_course_api(cn)
    content = _generate_guide_content(guide)
    _write_pdf(path, content)
    return path
