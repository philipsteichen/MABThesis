import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("mab")


def get_client_ip(request: Request) -> str:
    """Extract real client IP, respecting Cloudflare and proxy headers."""
    # Cloudflare sets this header with the real visitor IP
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        client_ip = get_client_ip(request)
        method = request.method
        path = request.url.path
        query = str(request.url.query) if request.url.query else ""
        ua = request.headers.get("user-agent", "")
        country = request.headers.get("cf-ipcountry", "")

        response = await call_next(request)

        elapsed_ms = round((time.monotonic() - start) * 1000)
        status = response.status_code

        logger.info(
            "%s %s %s%s status=%d time=%dms ip=%s country=%s ua=%s",
            method,
            path,
            f"?{query}" if query else "",
            "",
            status,
            elapsed_ms,
            client_ip,
            country,
            ua[:120],
        )

        return response
