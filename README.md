# MAB Thesis - Basis Spread Analyzer

Thesis project for the Master of Agribusiness (MAB) at Kansas State University.

Analyzes and forecasts grain commodity basis spreads (the difference between local cash prices and futures prices) using historical data and Prophet time series models.

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS + Recharts
- **Backend**: FastAPI + Pandas + Prophet

### Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard overview |
| `/analysis` | Basis spread analysis |
| `/forecast` | Basis spread forecasting |
| `/price-forecast` | Futures price forecasting |

### API Endpoints

| Prefix | Description |
|--------|-------------|
| `/api/basis` | Basis spread data and calculations |
| `/api/forecast` | Forecast generation |
| `/api/market` | Market data |
| `/api/health` | Health check |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+

### Setup

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Run

```bash
# Start both servers
./start.sh

# Or run individually:
# Backend  -> http://localhost:8000
cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend -> http://localhost:5173
cd frontend && npx vite --host
```

## Project Structure

```
backend/
  app/
    main.py          # FastAPI app with CORS config
    config.py        # App configuration
    models.py        # Pydantic data models
    routes/          # API route handlers
    services/        # Business logic and data processing
frontend/
  src/
    App.tsx          # React router setup
    pages/           # Page components
    components/      # Shared UI components
    api/             # API client
start.sh             # Dev startup script
```
