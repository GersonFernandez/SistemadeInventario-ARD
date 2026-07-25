#!/usr/bin/env sh
set -e

if [ ! -f .env.prod ]; then
	cp .env.prod.example .env.prod
	echo "Se creo .env.prod desde .env.prod.example."
	echo "Edita .env.prod (SECRET_KEY, passwords, hosts) y vuelve a ejecutar este script."
	exit 1
fi

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build --pull always --wait
