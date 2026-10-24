#!/bin/sh
set -eu
umask 077
cd "$(dirname "$0")"
archive_dir=${REVYNORA_BACKUP_DIR:?Set an encrypted or access-restricted backup directory}
[ -d "$archive_dir" ] || { echo 'Backup directory must already exist.' >&2; exit 1; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="$archive_dir/revynora-$stamp.dump"
# Dedicated project/file: never back up or alter another application's database.
docker compose --env-file .env.production -f compose.yaml exec -T postgres pg_dump -U revynora -d revynora --format=custom > "$archive.partial"
docker compose --env-file .env.production -f compose.yaml exec -T postgres pg_restore --list < "$archive.partial" > /dev/null
mv "$archive.partial" "$archive"
sha256sum "$archive" > "$archive.sha256"
echo "Revynora backup verified: $archive"
# No automatic deletion. Retention/off-site copy policy must be approved separately.
