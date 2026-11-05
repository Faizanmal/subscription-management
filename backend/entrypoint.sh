#!/bin/sh
set -e
if [ "$1" = "daphne" ]; then
    python manage.py migrate --noinput
fi
if [ "$1" = "celery" ]; then
    if ! python manage.py migrate --check; then
        echo "Celery startup blocked: database migrations must be applied with the same backend image. Run python manage.py migrate --noinput, then restart Celery." >&2
        exit 1
    fi
fi
exec "$@"
