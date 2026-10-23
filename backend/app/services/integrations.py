"""Mock external integrations (ЕГРЮЛ, ГИР БО, БКИ).

In a production system these functions would be replaced by real HTTP clients.
The latency is emulated with a tiny async sleep so the orchestrator behaves like
a real external-data pipeline.
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.services import mock_data


async def fetch_egrul(inn: str) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    return mock_data.get_egrul(inn)


async def fetch_girbo(inn: str) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    return mock_data.get_girbo(inn)


async def fetch_bki(inn: str) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    return mock_data.get_bki(inn)
