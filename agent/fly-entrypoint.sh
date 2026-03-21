#!/bin/sh
# One Fly Machine: LiveKit worker (background) + guide HTTP (foreground, PID 1 for Fly proxy).
# Uses POSIX sh only; must use LF line endings (Windows CRLF breaks the shebang).
set -eu
PORT="${PORT:-8765}"
cd /app

uv run src/agent.py start &
exec uv run uvicorn aicaddy.guide.service_app:app --app-dir src --host 0.0.0.0 --port "$PORT"
