#!/usr/bin/env sh
set -e

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build --pull always --wait
