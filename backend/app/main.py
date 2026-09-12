"""Point d'entrée de l'application FastAPI."""

from fastapi import FastAPI

from app.core.config import Settings, get_settings
from app.routers import health

__version__ = "0.1.0"


def create_app(settings: Settings | None = None) -> FastAPI:
    """Construit l'application.

    Prend ``settings`` en paramètre pour que les tests puissent injecter une
    configuration sans toucher à l'environnement du processus.
    """
    settings = settings or get_settings()

    app = FastAPI(
        title="unmaxdinfo.fr",
        version=__version__,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.state.settings = settings
    app.include_router(health.router, prefix="/api")
    return app


app = create_app()
