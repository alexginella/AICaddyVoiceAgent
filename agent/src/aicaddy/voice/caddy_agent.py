"""
Chip the AI Caddy - Personality, RAG injection, and tools.
"""

import json

from livekit.agents import Agent, ChatContext, ChatMessage, RunContext, function_tool

from aicaddy.voice.tools import get_nearby_golf_courses

CADDY_INSTRUCTIONS = """You are Chip, a seasoned virtual golf caddy who's ready to help golfers of all levels out on the course.
You speak in a warm, confident, and friendly tone. You reference course knowledge, wind, elevation, and the mental game.

Guidelines:
- Keep responses concise and voice-friendly: no emojis, asterisks, or complex formatting.
- Use the golfer's club yardages when recommending clubs. If you don't know their distances, ask!
- When you have course yardage, layout, and hole info from the knowledge base, use it precisely.
- You're knowledgeable and willing to collaborate with the golfer to give the best advice for their skill level in any situation.
"""


class CaddyAgent(Agent):
    """Chip the AI Caddy - extends Agent with RAG and tools."""

    def __init__(
        self,
        club_yardages: dict | None = None,
        rag_lookup=None,
        user_profile: dict | None = None,
        room=None,
    ):
        instructions = CADDY_INSTRUCTIONS
        profile = user_profile or {}
        if profile.get("handicap") is not None:
            instructions += f"\n\nGolfer handicap: {profile['handicap']}."
        if profile.get("age") is not None:
            instructions += f" Age: {profile['age']}."
        if profile.get("handedness"):
            instructions += f" Handedness: {profile['handedness']}."
        if profile.get("gender"):
            instructions += f" Gender: {profile['gender']} (for tee suggestions)."
        if club_yardages:
            yardages_str = ", ".join(
                f"{k}: {v} yards" for k, v in club_yardages.items()
            )
            instructions += f"\n\nThe golfer's known club yardages: {yardages_str}. Use these when recommending clubs."

        super().__init__(instructions=instructions)

        self._club_yardages = dict(club_yardages or {})
        self._rag_lookup = rag_lookup
        self._user_profile = dict(profile)
        self._room = room

    async def on_user_turn_completed(
        self, turn_ctx: ChatContext, new_message: ChatMessage
    ) -> None:
        """Inject RAG context before the LLM generates a response."""
        if not self._rag_lookup:
            return

        tc = getattr(new_message, "text_content", None)
        text = tc() if callable(tc) else (tc or "")
        if not text or len(text.strip()) < 3:
            return

        try:
            rag_content = await self._rag_lookup(text)
            if rag_content and rag_content.strip():
                turn_ctx.add_message(
                    role="assistant",
                    content=f"Relevant info from the yardage book and knowledge base:\n{rag_content}",
                )
        except Exception:
            pass

    @function_tool()
    async def get_nearby_golf_courses_tool(
        self, context: RunContext, location: str
    ) -> str:
        """Find nearby golf courses for the given location. Use when the user first joins the call so you can confirm which course youre playing"""
        return await get_nearby_golf_courses(location)

    async def _publish_profile_update(self) -> None:
        """Send updated profile (including yardages) to frontend via data channel."""
        if not self._room:
            return
        try:
            profile = {**self._user_profile, "clubYardages": dict(self._club_yardages)}
            payload = json.dumps({"type": "profile_update", "userProfile": profile})
            await self._room.local_participant.publish_data(
                payload=payload,
                reliable=True,
                topic="caddy",
            )
        except Exception:
            pass

    @function_tool()
    async def update_my_yardages_tool(
        self, context: RunContext, club: str, distance: int
    ) -> str:
        """Record the golfer's club distance when they tell you. E.g. 'my 7-iron goes 155' -> club='7-iron', distance=155. Confirm you've noted it."""
        self._club_yardages[club.lower().replace(" ", "")] = distance
        await self._publish_profile_update()
        return f"Got it. I've noted your {club} at {distance} yards."
