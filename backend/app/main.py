from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import basis, forecast, market

app = FastAPI(title="MAB Thesis - Basis Spread Analyzer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://thesis.northofprosper.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(basis.router, prefix="/api/basis", tags=["basis"])
app.include_router(forecast.router, prefix="/api/forecast", tags=["forecast"])
app.include_router(market.router, prefix="/api/market", tags=["market"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
