"""
Generate RAG-compatible course guide PDFs.
Fetches structured data from GolfCourseAPI (if configured), expands via LLM,
outputs hole-by-hole guide as PDF for RAG indexing.
"""
import os
import re
from pathlib import Path

import openai

_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "courses"
_DATA_DIR.mkdir(parents=True, exist_ok=True)


def _slug(name: str) -> str:
    """Create filesystem-safe slug from course name."""
    s = re.sub(r"[^\w\s-]", "", name.lower())
    return re.sub(r"[-\s]+", "-", s).strip("-") or "unknown"


def _get_client():
    if not os.environ.get("OPENAI_API_KEY"):
        return None
    return openai.OpenAI()


async def fetch_golf_course_api(course_name: str) -> dict | None:
    """
    Fetch course data from GolfCourseAPI.
    Returns dict with holes/tees or None if not configured or not found.
    """
    api_key = os.environ.get("GOLF_COURSE_API_KEY")
    if not api_key or not course_name.strip():
        return None
    try:
        resp = await _fetch_json(
            f"https://api.golfcourseapi.com/v1/search?search_query={course_name.strip()}",
            headers={"x-api-key": api_key},
        )
        courses = (resp or {}).get("courses", [])
        if not courses:
            return None
        c = courses[0]
        cid = c.get("id")
        if not cid:
            return {"name": c.get("course_name") or course_name}
        detail = await _fetch_json(
            f"https://api.golfcourseapi.com/v1/courses/{cid}",
            headers={"x-api-key": api_key},
        )
        return detail
    except Exception:
        return None


async def _fetch_json(url: str, headers: dict):
    import httpx

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()


def _expand_hole_via_llm(hole_num: int, par: int, yardage: int | None, course_name: str) -> str:
    """Generate 150-300 word narrative for a hole via LLM."""
    client = _get_client()
    if not client:
        return f"Hole {hole_num}, par {par}. Yardage {yardage or 'varies'} yards."
    try:
        resp = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You write concise, RAG-friendly golf hole descriptions. 80-120 words. Include typical hazards, bailout areas, strategy. Be explicit with facts.",
                },
                {
                    "role": "user",
                    "content": f"Write a golf hole description for {course_name}, Hole {hole_num}, par {par}, {yardage or 400} yards. Include hazards and strategy.",
                },
            ],
            max_tokens=250,
        )
        text = (resp.choices[0].message.content or "").strip()
        return text if text else f"Hole {hole_num}, par {par}."
    except Exception:
        return f"Hole {hole_num}, par {par}, {yardage or 'N/A'} yards."


def _generate_guide_fast(course_name: str) -> str:
    """One LLM call for entire course when no API data."""
    client = _get_client()
    if not client:
        return f"# {course_name}\n\n18-hole course. Use general golf strategy."
    try:
        resp = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Write RAG-friendly hole-by-hole golf guide. For each hole 1-18, use format: ## Hole N (Par X, Y yards) then 2-3 sentences on hazards, strategy, approach. Be explicit.",
                },
                {
                    "role": "user",
                    "content": f"Write a hole-by-hole guide for {course_name}. Include par and yardage for each hole, plus hazards and strategy.",
                },
            ],
            max_tokens=2500,
        )
        body = (resp.choices[0].message.content or "").strip()
        return f"# {course_name}\n\n{body}"
    except Exception:
        return f"# {course_name}\n\n18-hole course."


def _generate_guide_content(course_name: str, api_data: dict | None) -> str:
    """Build full hole-by-hole text from API data or LLM-only."""
    if not api_data:
        return _generate_guide_fast(course_name)
    sections = [f"# {course_name}\n\n"]
    hlist = api_data.get("holes") or api_data.get("holes_data") or []
    for i, h in enumerate(hlist[:18], 1):
        num = h.get("number") or h.get("hole") or i
        par = h.get("par") or 4
        yds = h.get("yardage") or h.get("yards") or h.get("length")
        if isinstance(yds, dict):
            yds = yds.get("championship") or yds.get("back") or (list(yds.values())[0] if yds else None)
        text = _expand_hole_via_llm(num, par, yds, course_name)
        sections.append(f"## Hole {num} (Par {par}, {yds or 'N/A'} yards)\n\n{text}\n\n")
    return "\n".join(sections)


def _write_pdf(path: Path, content: str) -> None:
    """Write markdown-like content to PDF using fpdf2."""
    from fpdf import FPDF
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)
    for line in content.split("\n"):
        line = line.strip()
        if not line:
            continue
        if line.startswith("# "):
            pdf.set_font("Helvetica", "B", 16)
            pdf.cell(0, 10, line[2:], ln=True)
            pdf.set_font("Helvetica", size=11)
        elif line.startswith("## "):
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, line[3:], ln=True)
            pdf.set_font("Helvetica", size=11)
        else:
            pdf.multi_cell(0, 6, line[:500])
    pdf.output(str(path))


async def generate_course_guide(course_name: str) -> Path:
    """
    Generate or return cached course guide PDF.
    Returns path to PDF file.
    """
    if not course_name or not course_name.strip():
        course_name = "General Course"
    slug = _slug(course_name)
    path = _DATA_DIR / f"{slug}.pdf"
    if path.exists():
        return path
    api_data = await fetch_golf_course_api(course_name)
    content = _generate_guide_content(course_name, api_data)
    _write_pdf(path, content)
    return path
