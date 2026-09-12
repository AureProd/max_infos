"""Démarrage du serveur : rechargement à chaud en dev, Gunicorn ailleurs."""

import uvicorn

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",  # noqa: S104 -- dans un conteneur, Traefik est seul devant
        port=80,
        reload=settings.app_env == "dev",
        reload_dirs=["app"] if settings.app_env == "dev" else None,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
