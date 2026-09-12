"""Sonde de disponibilité, utilisée par le healthcheck Docker et par Traefik."""

from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(tags=["système"])


class Health(BaseModel):
    status: Literal["ok"]
    version: str
    environment: str


@router.get("/health", summary="État du service")
async def health(request: Request) -> Health:
    from app.main import __version__

    return Health(status="ok", version=__version__, environment=request.app.state.settings.app_env)
