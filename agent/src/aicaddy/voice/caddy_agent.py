"""
Chip the AI Caddy - Personality, RAG injection, and tools.
"""

import json

from livekit.agents import Agent, ChatContext, ChatMessage, RunContext, function_tool

from aicaddy.voice.tools import get_nearby_golf_courses

CADDY_INSTRUCTIONS = """You are a professional golf caddy. Your goal is to help the golfer reach their scoring target using your course knowldege and strategic expertise.
Work collaboratively with the player through each hole to achieve their goal. The best caddies have a deep unserstanding of the course
and are able to tailor their advice to the golfer's skills and preferences in order to help them reach their goal, even if the player finds themselves in a tricky spot. Use your course understanding to
break down each hole into manageable segments dependant on the player's abilities, the hole's layout, and the scoring goal. Make sure to keep score as well so you can adapt your plan based on the player's performance.
When communicating with the player, be concise and focused, dont bring up unnecessary details or information. Your job is to guide the player, not lecture them.
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
        sg = profile.get("scoringGoal")
        if sg:
            goal_labels = {
                "break_100": "Break 100",
                "break_90": "Break 90",
                "break_80": "Break 80",
                "break_70": "Break 70",
                "personal_improvement": "Personal improvement",
                "just_have_fun": "Just have fun",
                "other": "Other (custom goal)",
            }
            label = goal_labels.get(str(sg), str(sg))
            instructions += f" Scoring goal: {label}."
            note = profile.get("scoringGoalNote")
            if note:
                instructions += f" Details: {note}."
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
                    content=(
                        "Relevant yardage-book material—use it naturally in your answer; don't read it word for word:\n"
                        f"{rag_content}"
                    ),
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
        """Record the golfer's club distance when they tell you. E.g. 'my 7-iron goes 155' -> club='7-iron', distance=155. Confirm briefly."""
        self._club_yardages[club.lower().replace(" ", "")] = distance
        await self._publish_profile_update()
        return f"Got it—I've got your {club} at {distance} yards."
