from hashlib import sha256
import json
import time

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .models import (
    AgentStepRequest,
    AgentStepResponse,
    EvaluateRequest,
    EvaluateResponse,
    GenerateSqlRequest,
    GenerateSqlResponse,
    HealthResponse,
)
from .provider import MockAgentProvider, OpenAIAgentProvider
from .security import require_api_key

settings = get_settings()
provider = OpenAIAgentProvider(settings) if settings.openai_api_key else MockAgentProvider()
_cache: dict[str, tuple[float, object]] = {}

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="OpenAI-backed read-only Text-to-SQL agent for KLTN.",
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
    configured = getattr(provider, "api_key_configured", True)
    return HealthResponse(status="ok" if configured else "degraded", provider=provider.name)


@app.post(
    "/v1/agent/generate-sql",
    response_model=GenerateSqlResponse,
    dependencies=[Depends(require_api_key)],
)
def generate_sql(request: GenerateSqlRequest) -> GenerateSqlResponse:
    payload = json.dumps(
        request.model_dump(mode="json", by_alias=True, exclude_none=True),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    key = sha256(payload.encode()).hexdigest()
    cached = _cache.get(key)
    if cached and cached[0] > time.monotonic():
        result = cached[1]
        return GenerateSqlResponse(**result, provider=provider.name, model=provider.model, cache_hit=True)
    try:
        generated = provider.generate(request)
    except Exception as error:
        # Do not expose provider responses, prompts, or API credentials.
        if isinstance(error, (ValueError, RuntimeError)):
            raise HTTPException(status_code=502, detail=str(error)[:500]) from error
        raise
    result = {"title": generated.title, "sql": generated.sql, "rule": generated.rule, "chart": generated.chart.model_dump()}
    _cache[key] = (time.monotonic() + get_settings().cache_ttl_seconds, result)
    return GenerateSqlResponse(**result, provider=provider.name, model=provider.model)


@app.post(
    "/v1/agent/chat",
    response_model=GenerateSqlResponse,
    dependencies=[Depends(require_api_key)],
)
def chat(request: GenerateSqlRequest) -> GenerateSqlResponse:
    """Alias suitable for the frontend/backend chat flow."""
    return generate_sql(request)


@app.post(
    "/v1/agent/step",
    response_model=AgentStepResponse,
    dependencies=[Depends(require_api_key)],
)
def step(request: AgentStepRequest) -> AgentStepResponse:
    """One iteration of the agent loop: the backend executes the chosen tool and calls back with the result."""
    try:
        return provider.step(request)
    except Exception as error:
        # Do not expose provider responses, prompts, or API credentials.
        if isinstance(error, (ValueError, RuntimeError)):
            raise HTTPException(status_code=502, detail=str(error)[:500]) from error
        raise


@app.post(
    "/v1/agent/evaluate",
    response_model=EvaluateResponse,
    dependencies=[Depends(require_api_key)],
)
def evaluate(request: EvaluateRequest) -> EvaluateResponse:
    """Analyze executed result rows into a natural-language evaluation + chart recommendation."""
    try:
        return provider.evaluate(request)
    except Exception as error:
        # Do not expose provider responses, prompts, or API credentials.
        if isinstance(error, (ValueError, RuntimeError)):
            raise HTTPException(status_code=502, detail=str(error)[:500]) from error
        raise

