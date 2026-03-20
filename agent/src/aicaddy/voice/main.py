"""
AI Caddy Voice Agent - Main entrypoint
LiveKit agent with STT, LLM, TTS pipeline, RAG, and tools.
"""

import json
import logging
import os

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    inference,
    room_io,
)
from livekit.plugins import cartesia, deepgram, noise_cancellation, silero
from livekit.plugins import openai as lk_openai
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from aicaddy.guide.common import chroma_collection_vector_count
from aicaddy.paths import repo_root
from aicaddy.voice.caddy_agent import CaddyAgent
from aicaddy.voice.rag import get_rag_for_course, get_rag_lookup, init_rag

logger = logging.getLogger("agent")

_env_path = repo_root() / ".env"
load_dotenv(_env_path)


def _voice_inference_mode() -> str:
    """
    livekit — STT/LLM/TTS via LiveKit Cloud inference (uses project gateway credits).
    openai — STT, LLM, TTS with livekit.plugins.openai (OPENAI_API_KEY only).
    providers — Deepgram STT + OpenAI LLM + Cartesia TTS (provider keys in env).
    """
    raw = (os.environ.get("CADDY_VOICE_INFERENCE") or "livekit").strip().lower()
    if raw in ("livekit", "gateway", "cloud", "", "default"):
        return "livekit"
    if raw in ("openai", "byok-openai"):
        return "openai"
    if raw in ("byok", "direct"):
        return "openai"
    if raw in ("providers", "deepgram-cartesia"):
        return "providers"
    return "livekit"


def _voice_session_kwargs():
    """STT, LLM, TTS for AgentSession (mutually exclusive inference backends)."""
    mode = _voice_inference_mode()
    if mode == "livekit":
        return {
            "stt": inference.STT(model="deepgram/nova-3", language="multi"),
            "llm": inference.LLM(model="openai/gpt-4.1-mini"),
            "tts": inference.TTS(
                model="cartesia/sonic-3",
                voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
            ),
        }
    if mode == "openai":
        return {
            "stt": lk_openai.STT(detect_language=True),
            "llm": lk_openai.LLM(model="gpt-4.1-mini"),
            "tts": lk_openai.TTS(model="gpt-4o-mini-tts", voice="ash"),
        }

    return {
        "stt": deepgram.STT(model="nova-3", language="multi"),
        "llm": lk_openai.LLM(model="gpt-4.1-mini"),
        "tts": cartesia.TTS(
            model="sonic-3",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        ),
    }


def _parse_metadata(data) -> dict:
    if not data:
        return {}
    try:
        return json.loads(data) if isinstance(data, str) else (data or {})
    except (json.JSONDecodeError, TypeError):
        return {}


def prewarm(proc: JobProcess):
    """Load VAD and default RAG index at startup."""
    proc.userdata["vad"] = silero.VAD.load()
    proc.userdata["rag_lookup"] = init_rag()


server = AgentServer()
server.setup_fnc = prewarm


@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    """Handle incoming voice sessions."""
    ctx.log_context_fields = {"room": ctx.room.name}

    meta = _parse_metadata(ctx.job.metadata)
    if not meta:
        for p in ctx.room.remote_participants.values():
            if p.metadata:
                meta = _parse_metadata(p.metadata)
                if meta:
                    break

    user_profile = meta.get("userProfile") or {}
    selected_course = meta.get("selectedCourse") or {}
    course_name = (selected_course.get("name") or "").strip()
    club_yardages = user_profile.get("clubYardages") or meta.get("clubYardages") or {}

    # Per-course RAG from index built by Course Guide Service (read-only; no generation here).
    # Only swap from default yardage_book RAG when this worker actually has that collection;
    # otherwise get_rag_for_course returns a no-op and would disable RAG entirely.
    rag_lookup = ctx.proc.userdata.get("rag_lookup") or get_rag_lookup()
    if course_name:
        n = chroma_collection_vector_count(course_name)
        if n is not None and n > 0:
            rag_lookup = await get_rag_for_course(course_name)
        else:
            logger.warning(
                "No vectors for course %r on this worker (count=%s); keeping default RAG. "
                "Ensure agent/vector_store is deployed with the course index.",
                course_name,
                n,
            )

    vmode = _voice_inference_mode()
    logger.info("Voice inference mode: %s (set CADDY_VOICE_INFERENCE to change)", vmode)
    vk = _voice_session_kwargs()
    session = AgentSession(
        stt=vk["stt"],
        llm=vk["llm"],
        tts=vk["tts"],
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    agent = CaddyAgent(
        club_yardages=club_yardages,
        rag_lookup=rag_lookup,
        user_profile=user_profile,
        room=ctx.room,
    )

    await session.start(
        agent=agent,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind
                    == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    await ctx.connect()

    greet = (
        "You are Chip. Greet them as their caddy for this round. "
        "Introduce yourself and offer to help reaching their scoring goal using your course knowledge and strategic expertise."
    )
    if course_name:
        greet += f" They're playing {course_name} today—welcome them to that course naturally."
    await session.generate_reply(instructions=greet)


if __name__ == "__main__":
    cli.run_app(server)
