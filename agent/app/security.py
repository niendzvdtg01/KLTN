from typing import Annotated

from fastapi import Header, HTTPException, status

from .config import get_settings


def require_api_key(
    x_api_key: Annotated[str | None, Header()] = None,
) -> str:
    """Protect the agent with a mockable API key.

    Replace AGENT_API_KEY in the environment when connecting the service to
    another backend. The default is intentionally non-secret for local MVP use.
    """
    if x_api_key != get_settings().api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key",
        )
    return x_api_key

