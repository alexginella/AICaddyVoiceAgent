"""
AI Caddy Voice Agent - Main entrypoint
LiveKit agent with STT, LLM, TTS pipeline, RAG, and tools.
"""
import json
import logging
from pathlib import Path

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
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from caddy_agent import CaddyAgent
from rag import get_or_create_rag_for_course, get_rag_lookup, init_rag

logger = logging.getLogger("agent")

# Load single .env from project root
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)


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

    # Use per-course RAG when a course is selected
    rag_lookup = ctx.proc.userdata.get("rag_lookup") or get_rag_lookup()
    if course_name:
        rag_lookup = await get_or_create_rag_for_course(course_name)

    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        llm=inference.LLM(model="openai/gpt-4.1-mini"),
        tts=inference.TTS(
            model="cartesia/sonic-3", voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
        ),
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
                    if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    await ctx.connect()

    greet = "Greet the user warmly as Chip the caddy. Introduce yourself briefly and offer to help with their round—course knowledge, club selection, or strategy."
    if course_name:
        greet += f" They're playing at {course_name} today."
    await session.generate_reply(instructions=greet)


if __name__ == "__main__":
    cli.run_app(server)
