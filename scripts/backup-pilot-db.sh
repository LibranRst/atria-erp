#!/usr/bin/env bash
set -euo pipefail

# Opt-in is separate from the existing production backup workflow and source guard.
if [[ "${ATRIA_PILOT_BACKUP_ENABLED:-false}" != "true" ]]; then
  echo "Pilot backup is disabled; no database or cloud operation performed."
  exit 0
fi
for variable in PILOT_BACKUP_DATABASE_URL BACKUP_R2_BUCKET R2_ACCOUNT_ID AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY EXPECTED_PILOT_NEON_HOST EXPECTED_PILOT_DATABASE EXPECTED_PILOT_BACKUP_USER PILOT_CUTOFF_ISO PILOT_API_RELEASE_COMMIT PILOT_WEB_RELEASE_COMMIT; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required pilot backup setting: $variable" >&2
    exit 1
  fi
done

# No credentials are printed or placed in command arguments on the host.
python3 - <<'PY_GUARD'
import datetime
import os
import re
from urllib.parse import parse_qs, unquote, urlsplit
try:
    url = urlsplit(os.environ["PILOT_BACKUP_DATABASE_URL"])
    port = url.port
except ValueError:
    raise SystemExit("Pilot backup URL is malformed")
expected_host = os.environ["EXPECTED_PILOT_NEON_HOST"]
expected_database = os.environ["EXPECTED_PILOT_DATABASE"]
expected_user = os.environ["EXPECTED_PILOT_BACKUP_USER"]
if not re.fullmatch(r"ep-[a-z0-9-]+(?:\.[a-z0-9-]+)*\.neon\.tech", expected_host):
    raise SystemExit("Explicit direct pilot Neon host is required")
if expected_host == "ep-wispy-unit-az0r7nao.c-3.ap-southeast-1.aws.neon.tech":
    raise SystemExit("Existing production source is forbidden for pilot backup")
if not re.fullmatch(r"[a-z][a-z0-9_]{0,62}", expected_database):
    raise SystemExit("Explicit pilot database name is required")
if expected_user != "atria_pilot_backup":
    raise SystemExit("Pilot backup must use its dedicated read-only role")
query = parse_qs(url.query)
if (url.scheme not in {"postgres", "postgresql"} or url.hostname != expected_host
        or "-pooler" in expected_host or port not in {None, 5432}
        or unquote(url.path.removeprefix("/")) != expected_database
        or unquote(url.username or "") != expected_user or not url.password
        or query.get("sslmode", [None])[0] not in {"require", "verify-ca", "verify-full"}
        or set(query) - {"sslmode", "channel_binding"} or any(len(values) != 1 for values in query.values()) or url.fragment):
    raise SystemExit("Pilot source must match the explicit host/database/user with TLS and no routing override")
if not re.fullmatch(r"[a-f0-9]{32}", os.environ["R2_ACCOUNT_ID"]):
    raise SystemExit("R2 account ID must be 32 lowercase hexadecimal characters")
if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}[a-z0-9]", os.environ["BACKUP_R2_BUCKET"]):
    raise SystemExit("Pilot backup bucket name is invalid")
try:
    cutoff = datetime.datetime.fromisoformat(os.environ["PILOT_CUTOFF_ISO"].replace("Z", "+00:00"))
except ValueError:
    raise SystemExit("Pilot cutoff must be a timestamp with timezone")
if cutoff.tzinfo is None:
    raise SystemExit("Pilot cutoff must include a timezone")
for name in ["PILOT_API_RELEASE_COMMIT", "PILOT_WEB_RELEASE_COMMIT"]:
    if not re.fullmatch(r"[a-f0-9]{40,64}", os.environ[name]):
        raise SystemExit("Deployed API/web commit identity must be explicit")
PY_GUARD

if [[ "${1:-}" == "--validate-only" ]]; then
  echo "Pilot backup configuration validated; no database or cloud operation performed."
  exit 0
fi
command -v docker >/dev/null
command -v aws >/dev/null
# R2 uses its S3 endpoint, not AWS STS or IAM. Optional AWS SDK checksums are
# disabled because R2 accepts Content-MD5 but not all AWS checksum headers.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
export AWS_EC2_METADATA_DISABLED=true
endpoint="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

umask 077
temp_base="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
backup_dir="$(mktemp -d "$temp_base/atria-pilot-backup.XXXXXX")"
cleanup() {
  rm -f -- "$backup_dir/database.dump" "$backup_dir/verified.dump" "$backup_dir/source.json" "$backup_dir/source-after.json" "$backup_dir/manifest.json"
  rmdir -- "$backup_dir"
}
trap cleanup EXIT

archive="$backup_dir/database.dump"

source_info() {
  local source_sql
  IFS= read -r -d '' source_sql <<'SQL_SOURCE' || true
SELECT json_build_object(
  'database', current_database(), 'user', current_user,
  'migrationCount', (SELECT count(*) FROM drizzle.__drizzle_migrations),
  'latestMigrationHash', (SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1),
  'latestMigrationAt', (SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1),
  'canWrite', EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','drizzle') AND c.relkind IN ('r','p')
    AND has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
)
SQL_SOURCE
  export PILOT_BACKUP_SCHEMA_QUERY="$source_sql"
  docker run --rm --env PILOT_BACKUP_DATABASE_URL --env PILOT_BACKUP_SCHEMA_QUERY \
    --env PGCONNECT_TIMEOUT=10 postgres:18-alpine \
    sh -euc 'psql "$PILOT_BACKUP_DATABASE_URL" -X -At -c "$PILOT_BACKUP_SCHEMA_QUERY"'
}
source_info > "$backup_dir/source.json"
python3 - "$backup_dir/source.json" <<'PY_SOURCE'
import json, os, sys
source=json.load(open(sys.argv[1]))
if (source.get("database") != os.environ["EXPECTED_PILOT_DATABASE"]
        or source.get("user") != os.environ["EXPECTED_PILOT_BACKUP_USER"]
        or source.get("canWrite") is not False or source.get("migrationCount",0) < 1):
    raise SystemExit("Pilot backup source identity/read-only role/schema verification failed")
PY_SOURCE

docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env PILOT_BACKUP_DATABASE_URL \
  --env PGCONNECT_TIMEOUT=10 \
  --mount "type=bind,src=$backup_dir,dst=/backup" \
  postgres:18-alpine \
  sh -euc 'umask 077; pg_dump --format=custom --compress=6 --no-owner --no-acl --dbname="$PILOT_BACKUP_DATABASE_URL" --file=/backup/database.dump'

if [[ ! -s "$archive" ]]; then
  echo "pg_dump did not produce a non-empty archive" >&2
  exit 1
fi

# Render every archived object to /dev/null so corrupt compressed data fails before upload.
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$backup_dir,dst=/backup,readonly" \
  postgres:18-alpine \
  pg_restore --file=/dev/null /backup/database.dump

source_info > "$backup_dir/source-after.json"
if ! cmp -s "$backup_dir/source.json" "$backup_dir/source-after.json"; then
  echo "Schema changed during pilot backup; archive will not be uploaded" >&2
  exit 1
fi

size="$(wc -c < "$archive" | tr -d '[:space:]')"
digest="$(shasum -a 256 "$archive" | awk '{print $1}')"
content_md5="$(python3 - "$archive" <<'PY'
import base64
import hashlib
import sys

checksum = hashlib.md5(usedforsecurity=False)
with open(sys.argv[1], "rb") as archive:
    for chunk in iter(lambda: archive.read(1024 * 1024), b""):
        checksum.update(chunk)
print(base64.b64encode(checksum.digest()).decode("ascii"))
PY
)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
key="atria-erp/pilot/$(date -u +%Y/%m/%d)/${EXPECTED_PILOT_DATABASE}-${timestamp}-${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}.dump"

aws s3api put-object \
  --endpoint-url "$endpoint" \
  --bucket "$BACKUP_R2_BUCKET" \
  --key "$key" \
  --body "$archive" \
  --region auto \
  --content-md5 "$content_md5" \
  --if-none-match '*' \
  --metadata "sha256=$digest" \
  --no-cli-pager >/dev/null

head_result="$(aws s3api head-object \
  --endpoint-url "$endpoint" \
  --bucket "$BACKUP_R2_BUCKET" \
  --key "$key" \
  --region auto \
  --query '[ContentLength, Metadata.sha256]' \
  --output text \
  --no-cli-pager)"
read -r remote_size remote_digest <<< "$head_result"
if [[ "$remote_size" != "$size" || "$remote_digest" != "$digest" ]]; then
  echo "Uploaded backup metadata does not match the local archive" >&2
  exit 1
fi

# Validate actual remote bytes, not only metadata supplied during upload.
aws s3api get-object \
  --endpoint-url "$endpoint" \
  --bucket "$BACKUP_R2_BUCKET" \
  --key "$key" \
  --region auto \
  --no-cli-pager "$backup_dir/verified.dump" >/dev/null
verified_digest="$(shasum -a 256 "$backup_dir/verified.dump" | awk '{print $1}')"
if [[ "$verified_digest" != "$digest" ]]; then
  echo "Downloaded R2 backup does not match the local archive" >&2
  exit 1
fi


# Sidecar records code, actual source schema, cutoff and verified archive identity.
export PILOT_ARCHIVE_SHA256="$digest" PILOT_ARCHIVE_BYTES="$size" PILOT_ARCHIVE_KEY="$key"
python3 - "$backup_dir/source.json" "$backup_dir/manifest.json" <<'PY_MANIFEST'
import datetime, json, os, sys
manifest={
  "kind":"atria-pilot-backup-v1", "createdAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "cutoff":os.environ["PILOT_CUTOFF_ISO"], "host":os.environ["EXPECTED_PILOT_NEON_HOST"],
  "source":json.load(open(sys.argv[1])), "apiCommit":os.environ["PILOT_API_RELEASE_COMMIT"],
  "webCommit":os.environ["PILOT_WEB_RELEASE_COMMIT"], "backupWorkflowCommit":os.environ.get("GITHUB_SHA"),
  "archiveKey":os.environ["PILOT_ARCHIVE_KEY"], "sha256":os.environ["PILOT_ARCHIVE_SHA256"],
  "bytes":int(os.environ["PILOT_ARCHIVE_BYTES"]), "attachmentBytesIncluded":False,
}
with open(sys.argv[2],"w") as output: json.dump(manifest,output,indent=2)
PY_MANIFEST
manifest_key="${key%.dump}.manifest.json"
manifest_digest="$(shasum -a 256 "$backup_dir/manifest.json" | awk '{print $1}')"
aws s3api put-object --endpoint-url "$endpoint" --bucket "$BACKUP_R2_BUCKET" \
  --key "$manifest_key" --body "$backup_dir/manifest.json" --region auto \
  --if-none-match '*' --metadata "sha256=$manifest_digest" --no-cli-pager >/dev/null
# Manifest success is required; incomplete backups must not report overall success.
aws s3api get-object --endpoint-url "$endpoint" --bucket "$BACKUP_R2_BUCKET" \
  --key "$manifest_key" --region auto --no-cli-pager "$backup_dir/verified.dump" >/dev/null
verified_manifest_digest="$(shasum -a 256 "$backup_dir/verified.dump" | awk '{print $1}')"
if [[ "$verified_manifest_digest" != "$manifest_digest" ]]; then
  echo "Downloaded pilot manifest checksum mismatch" >&2
  exit 1
fi
echo "Pilot backup and manifest verified in private R2: $BACKUP_R2_BUCKET/$key ($size bytes, SHA-256 $digest)"
