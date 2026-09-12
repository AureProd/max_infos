import pytest

from app.core.config import Settings


def test_database_url_is_async_and_carries_every_part() -> None:
    s = Settings(
        postgres_user="max",
        postgres_password="s3cret",
        db_host="db",
        db_port=5433,
        postgres_db="umdi",
    )
    assert s.database_url == "postgresql+asyncpg://max:s3cret@db:5433/umdi"


PROD_SECRETS = {
    "postgres_password": "x",
    "secret_encryption_key": "y",
    "session_secret": "z",
    "google_client_id": "id",
    "google_client_secret": "cs",
}


def test_is_prod_only_for_prod() -> None:
    assert Settings(app_env="prod", **PROD_SECRETS).is_prod is True
    assert Settings(app_env="preview").is_prod is False
    assert Settings(app_env="dev").is_prod is False


def test_defaults_are_safe_for_a_fresh_checkout() -> None:
    """Une configuration vide ne doit jamais prétendre être la production."""
    s = Settings()
    assert s.app_env == "dev"
    assert s.secret_encryption_key == ""
    assert s.session_secret == ""


def test_prod_refuses_to_start_without_secrets() -> None:
    """Un oubli de variable doit casser au démarrage, pas en silence."""
    with pytest.raises(ValueError, match="manquantes en production"):
        Settings(app_env="prod")


def test_prod_starts_once_every_secret_is_present() -> None:
    assert Settings(app_env="prod", **PROD_SECRETS).is_prod is True
