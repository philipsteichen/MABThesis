import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import basis, forecast, market
from app.routes import analytics
from app.middleware import RequestLoggingMiddleware

# ---------------------------------------------------------------------------
# Logging – structured output to stdout (captured by systemd journal)
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)

app = FastAPI(title="MAB Thesis - Basis Spread Analyzer", version="1.0.0")

# ---------------------------------------------------------------------------
# Middleware (order matters – last added runs first)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://thesis.northofprosper.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(basis.router, prefix="/api/basis", tags=["basis"])
app.include_router(forecast.router, prefix="/api/forecast", tags=["forecast"])
app.include_router(market.router, prefix="/api/market", tags=["market"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
