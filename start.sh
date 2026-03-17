#!/bin/bash
# Start both backend and frontend servers
echo "Starting Basis Spread Analyzer..."
echo ""

# Start backend
echo "[1/2] Starting FastAPI backend on http://localhost:8000"
cd "$(dirname "$0")/backend"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start frontend
echo "[2/2] Starting React frontend on http://localhost:5173"
cd "$(dirname "$0")/frontend"
npx vite --host &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000/api/health"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
