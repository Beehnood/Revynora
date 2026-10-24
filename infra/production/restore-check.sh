#!/bin/sh
# Restore into a NEW, dedicated validation database only; never overwrite revynora.
set -eu
cd "$(dirname "$0")"
archive=${1:?Usage: restore-check.sh archive.dump revynora_restore_CHECKID}
target=${2:?Dedicated validation database required}
case "$target" in revynora_restore_*) ;; *) echo 'A new revynora_restore_ database is required.' >&2; exit 1;; esac
case "$target" in *[!a-zA-Z0-9_]*) echo 'Invalid validation database name.' >&2; exit 1;; esac
[ -f "$archive" ] || exit 1
docker compose --env-file .env.production -f compose.yaml exec -T postgres createdb -U revynora "$target"
docker compose --env-file .env.production -f compose.yaml exec -T postgres pg_restore --exit-on-error --no-owner -U revynora -d "$target" < "$archive"
docker compose --env-file .env.production -f compose.yaml exec -T postgres psql -U revynora -d "$target" -c 'SELECT count(*) AS users FROM "User";'
echo "Restoration validated in $target. No live database changed."
