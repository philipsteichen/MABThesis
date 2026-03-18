import logging
from datetime import datetime
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger("mab.analytics")
router = APIRouter()


class AnalyticsEvent(BaseModel):
    event: str = Field(..., max_length=100)
    page: str = Field(..., max_length=200)
    detail: Optional[str] = Field(None, max_length=500)


@router.post("/event")
async def track_event(body: AnalyticsEvent, request: Request):
    """Track a frontend analytics event."""
    from app.middleware import get_client_ip

    client_ip = get_client_ip(request)
    country = request.headers.get("cf-ipcountry", "")
    ua = request.headers.get("user-agent", "")

    logger.info(
        "ANALYTICS event=%s page=%s detail=%s ip=%s country=%s ua=%s ts=%s",
        body.event,
        body.page,
        body.detail or "",
        client_ip,
        country,
        ua[:120],
        datetime.utcnow().isoformat(),
    )
    return {"ok": True}
