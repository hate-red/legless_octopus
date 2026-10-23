#!/bin/sh
set -e

echo "[entrypoint] waiting for database..."
python -m app.wait_for_db

echo "[entrypoint] applying migrations..."
alembic upgrade head

echo "[entrypoint] seeding demo data..."
python -m app.seed

echo "[entrypoint] starting API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
