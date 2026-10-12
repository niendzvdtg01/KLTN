from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .models import GenerateSqlRequest, GenerateSqlResponse, HealthResponse
from .provider import MockAgentProvider
from .security import require_api_key

settings = get_settings()
provider = MockAgentProvider()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Mockable read-only Text-to-SQL agent core for KLTN.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", provider=provider.name)


@app.post(
    "/v1/agent/generate-sql",
    response_model=GenerateSqlResponse,
    dependencies=[Depends(require_api_key)],
)
def generate_sql(request: GenerateSqlRequest) -> GenerateSqlResponse:
    title, sql = provider.generate(request)
    return GenerateSqlResponse(title=title, sql=sql, provider=provider.name, model=provider.model)


@app.post(
    "/v1/agent/chat",
    response_model=GenerateSqlResponse,
    dependencies=[Depends(require_api_key)],
)
def chat(request: GenerateSqlRequest) -> GenerateSqlResponse:
    """Alias suitable for the frontend/backend chat flow."""
    return generate_sql(request)

