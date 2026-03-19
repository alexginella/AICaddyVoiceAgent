"""
LLM prompts for professional yardage-book PDF generation (facts only, no strategy).
Used only when GolfCourseAPI provides per-hole structured data.
"""

# --- Per-hole expansion (API provides hole list + par/yardage) ---

HOLE_YARDAGE_BOOK_SYSTEM = (
    "You write professional golf yardage-book entries only: "
    "measurable facts (yards, carries, hazard names, green depth/width). "
    "Do not give strategy, club advice, or how to play the hole. "
    "80-120 words. Use complete sentences with numbers."
)


def hole_yardage_book_user_message(
    course_name: str,
    hole_num: int,
    par: int,
    ref_yards: int,
) -> str:
    return (
        f"Yardage book entry for {course_name}, hole {hole_num}, par {par}, "
        f"reference yardage ~{ref_yards} yds from back tee. "
        "Include: tee yardages if missing, carry over hazards, "
        "distance to front/middle/back green, fairway pinch points if standard for such holes."
    )
