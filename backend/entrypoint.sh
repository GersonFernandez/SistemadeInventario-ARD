#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput || true
python manage.py create_default_superuser || true

if [ "$SEED_DEV_DATA_100" = "true" ] || [ "$SEED_DEV_DATA_100" = "1" ]; then
	echo "SEED_DEV_DATA_100 activo: generando datos de prueba..."
	if [ "$SEED_DEV_RESET" = "true" ] || [ "$SEED_DEV_RESET" = "1" ]; then
		python manage.py seed_dev_data --count "${SEED_DEV_COUNT:-100}" --force --reset
	else
		python manage.py seed_dev_data --count "${SEED_DEV_COUNT:-100}" --force
	fi
fi

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers "${GUNICORN_WORKERS:-3}"
