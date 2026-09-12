"""Configuration de l'application, lue une seule fois depuis l'environnement."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["dev", "preview", "prod"]


class Settings(BaseSettings):
    """Toutes les variables d'environnement du service.

    Les secrets applicatifs (jetons Meta) ne sont PAS ici : ils vivent chiffrés
    en base, dans la table ``secret``. Seules les clés nécessaires au démarrage
    figurent dans l'environnement.
    """

    model_config = SettingsConfigDict(env_file=None, extra="ignore", case_sensitive=False)

    app_env: Environment = "dev"
    log_level: str = "INFO"
    url_host: str = "unmaxdinfo.localhost"
    public_base_url: str = "http://unmaxdinfo.localhost:8080"

    postgres_db: str = "unmaxdinfo"
    postgres_user: str = "unmaxdinfo"
    postgres_password: str = ""
    db_host: str = "db"
    db_port: int = 5432

    secret_encryption_key: str = ""
    session_secret: str = ""
    session_cookie_name: str = "umdi_session"
    session_max_age: int = 60 * 60 * 24 * 14

    google_client_id: str = ""
    google_client_secret: str = ""
    bootstrap_tech_email: str = ""

    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "unmaxdinfo-media"
    r2_endpoint: str = ""
    r2_public_base_url: str = ""

    instagram_app_id: str = ""
    instagram_app_secret: str = ""
    instagram_sync_interval_minutes: int = Field(default=60, ge=5)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        """URL SQLAlchemy asynchrone."""
        return str(
            PostgresDsn.build(
                scheme="postgresql+asyncpg",
                username=self.postgres_user,
                password=self.postgres_password,
                host=self.db_host,
                port=self.db_port,
                path=self.postgres_db,
            )
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_prod(self) -> bool:
        return self.app_env == "prod"

    @model_validator(mode="after")
    def refuse_to_start_in_prod_without_secrets(self) -> "Settings":
        """Mieux vaut un démarrage qui échoue qu'une production ouverte.

        Les valeurs par défaut sont vides plutôt que factices : rien ne peut
        donc tourner en production avec un secret de démonstration.
        """
        if not self.is_prod:
            return self
        missing = [
            name
            for name in (
                "postgres_password",
                "secret_encryption_key",
                "session_secret",
                "google_client_id",
                "google_client_secret",
            )
            if not getattr(self, name)
        ]
        if missing:
            raise ValueError("Variables d'environnement manquantes en production : " + ", ".join(sorted(missing)))
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Instance unique, mise en cache pour la durée du processus."""
    return Settings()
