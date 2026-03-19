"""Single place for filesystem roots (paths depend only on this file's location)."""

from __future__ import annotations

from pathlib import Path


def agent_root() -> Path:
    """Directory with ``data/``, ``vector_store/``, and ``pyproject.toml``."""
    return Path(__file__).resolve().parent.parent.parent


def repo_root() -> Path:
    """Monorepo root (parent of ``agent/``)."""
    return agent_root().parent
