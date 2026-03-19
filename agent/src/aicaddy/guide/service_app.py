"""
Course Guide Service — HTTP API for lookup-first yardage PDF + Chroma indexing.

Run from repo (dev):
  cd agent && uv sync && uv run uvicorn aicaddy.guide.service_app:app --app-dir src --host 127.0.0.1 --port 8765
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from aicaddy.paths import repo_root

_env_path = repo_root() / ".env"
load_dotenv(_env_path)

_root = logging.getLogger()
if not _root.handlers:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
log = logging.getLogger("guide_service")

app = FastAPI(title="AI Caddy Course Guide Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EnsureGuideBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    course_name: str = Field(..., min_length=1, alias="courseName")
    force: bool = False


@app.post("/ensure-guide")
async def ensure_guide(body: EnsureGuideBody):
    course = body.course_name.strip()
    force = bool(body.force)
    log.info("POST /ensure-guide course_name=%r force=%s", course, force)
    if not os.environ.get("OPENAI_API_KEY"):
        log.warning("ensure-guide rejected: OPENAI_API_KEY missing")
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured (required for embeddings)",
        )
    try:
        from aicaddy.guide.course_guide import (
            GolfCourseAPIAuthError,
            GolfCourseAPIConfigError,
            GolfCourseAPIError,
            GolfCourseAPIHTTPError,
            GolfCourseAPINoDataError,
        )
        from aicaddy.guide.ensure import ensure_course_guide

        result = await ensure_course_guide(course, force=force)
        log.info(
            "POST /ensure-guide done course_name=%r status=%s cached=%s rebuilt_index_only=%s",
            course,
            result.get("status"),
            result.get("cached"),
            result.get("rebuilt_index_only"),
        )
        return result
    except GolfCourseAPIAuthError as e:
        log.warning(
            "ensure-guide Golf Course API auth failed course_name=%r: %s", course, e
        )
        raise HTTPException(status_code=401, detail=str(e)) from e
    except GolfCourseAPIConfigError as e:
        log.warning("ensure-guide config error course_name=%r: %s", course, e)
        raise HTTPException(status_code=503, detail=str(e)) from e
    except GolfCourseAPINoDataError as e:
        log.warning("ensure-guide no API data course_name=%r: %s", course, e)
        raise HTTPException(status_code=404, detail=str(e)) from e
    except GolfCourseAPIHTTPError as e:
        log.warning(
            "ensure-guide Golf Course API HTTP status=%s course_name=%r: %s",
            e.status_code,
            course,
            e,
        )
        raise HTTPException(status_code=502, detail=str(e)) from e
    except GolfCourseAPIError as e:
        log.warning("ensure-guide Golf Course API error course_name=%r: %s", course, e)
        raise HTTPException(status_code=502, detail=str(e)) from e
    except ValueError as e:
        log.warning("ensure-guide validation error course_name=%r: %s", course, e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        log.exception("ensure-guide failed course_name=%r", course)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/health")
async def health():
    return {"ok": True}
