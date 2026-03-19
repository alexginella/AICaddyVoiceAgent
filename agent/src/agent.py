"""
LiveKit voice agent CLI entrypoint.

Implementation lives in ``aicaddy.voice.main`` so imports resolve as a package.
"""

from aicaddy.voice.main import cli, server

if __name__ == "__main__":
    cli.run_app(server)
