from httpx import AsyncClient


async def test_health_reports_ok(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["environment"] == "dev"
    assert body["version"]


async def test_health_is_namespaced_under_api(client: AsyncClient) -> None:
    """Traefik route /api vers le back : la sonde doit vivre sous ce préfixe."""
    assert (await client.get("/health")).status_code == 404


async def test_openapi_schema_is_served(client: AsyncClient) -> None:
    response = await client.get("/api/openapi.json")
    assert response.status_code == 200
    assert "/api/health" in response.json()["paths"]
