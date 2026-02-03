#!/bin/bash

# Start AirCal services

cd "$(dirname "$0")"

# Cleanup on exit
trap 'kill $(jobs -p) 2>/dev/null' EXIT

# Start backend
echo "Starting backend on http://localhost:8000..."
(cd backend && source .venv/bin/activate && uvicorn app.main:app --reload) &

# Start frontend
echo "Starting frontend on http://localhost:5173..."
(cd frontend && npm run dev) &

# Wait for both
wait
