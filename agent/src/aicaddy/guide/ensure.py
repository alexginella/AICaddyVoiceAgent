"""
Ensure a course yardage PDF exists and is indexed into Chroma (lookup-first).
"""

from __future__ import annotations

import contextlib
import logging
from pathlib import Path

import chromadb

from aicaddy.guide.common import (
    chroma_collection_name_for_course,
    course_pdf_path,
    guide_fully_ready,
    index_pdf_to_chroma,
    vector_store_dir,
)

logger = logging.getLogger(__name__)


async def ensure_course_guide(course_name: str, *, force: bool = False) -> dict:
    """
    If PDF + Chroma index exist, return cached without work.
    If PDF exists only, index from PDF.
    Otherwise generate PDF then index.

    Returns: {"status": "ready", "cached": bool, "rebuilt_index_only": bool}
    """
    cn = (course_name or "").strip()
    if not cn:
        raise ValueError("courseName is required")

    logger.info("ensure_course_guide start course=%r force=%s", cn, force)

    if force:
        logger.info(
            "ensure_course_guide force=true: removing PDF and Chroma for %r", cn
        )
        pdf_path = course_pdf_path(cn)
        if pdf_path.is_file():
            pdf_path.unlink()
        coll_name = chroma_collection_name_for_course(cn)
        client = chromadb.PersistentClient(path=str(vector_store_dir()))
        with contextlib.suppress(Exception):
            client.delete_collection(coll_name)

    if not force and guide_fully_ready(cn):
        logger.info("ensure_course_guide cache hit (PDF + index) for %r", cn)
        return {"status": "ready", "cached": True, "rebuilt_index_only": False}

    only_index_from_existing_pdf = course_pdf_path(cn).is_file()
    logger.info(
        "ensure_course_guide will generate/index course=%r pdf_already_exists=%s",
        cn,
        only_index_from_existing_pdf,
    )

    from aicaddy.guide.course_guide import generate_course_guide

    pdf_path: Path = await generate_course_guide(cn)
    index_pdf_to_chroma(cn, pdf_path)

    rebuilt_index_only = only_index_from_existing_pdf and not force
    logger.info(
        "ensure_course_guide finished course=%r rebuilt_index_only=%s pdf_path=%s",
        cn,
        rebuilt_index_only,
        pdf_path,
    )
    return {
        "status": "ready",
        "cached": False,
        "rebuilt_index_only": rebuilt_index_only,
    }
