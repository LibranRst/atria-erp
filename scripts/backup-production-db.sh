#!/usr/bin/env bash
set -euo pipefail

for variable in NEON_BACKUP_DATABASE_URL BACKUP_S3_BUCKET AWS_REGION EXPECTED_NEON_HOST EXPECTED_BACKUP_USER; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required backup setting: $variable" >&2
    exit 1
  fi
done

# Never print or pass this URL through a GitHub Action expression in a run script.
python3 - <<'PY'
import os
from urllib.parse import parse_qs, unquote, urlsplit

url = urlsplit(os.environ["NEON_BACKUP_DATABASE_URL"])
expected_host = os.environ["EXPECTED_NEON_HOST"]
database = unquote(url.path.removeprefix("/"))
sslmode = parse_qs(url.query).get("sslmode", [None])[0]

if url.scheme not in {"postgres", "postgresql"}:
    raise SystemExit("Backup source must be a PostgreSQL URL")
if url.hostname != expected_host or url.hostname is None or "-pooler" in url.hostname:
    raise SystemExit("Backup source must be the direct production Neon endpoint")
if database != "neondb" or url.port not in {None, 5432}:
    raise SystemExit("Backup source database or port does not match production")
if url.username != os.environ["EXPECTED_BACKUP_USER"]:
    raise SystemExit("Backup source must use the dedicated read-only role")
if not url.username or url.password is None or sslmode not in {"require", "verify-ca", "verify-full"}:
    raise SystemExit("Backup source requires login credentials and SSL")
PY

command -v docker >/dev/null
command -v aws >/dev/null
aws sts get-caller-identity --region "$AWS_REGION" >/dev/null

umask 077
temp_base="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
backup_dir="$(mktemp -d "$temp_base/atria-db-backup.XXXXXX")"
cleanup() {
  rm -f -- "$backup_dir/database.dump"
  rmdir -- "$backup_dir"
}
trap cleanup EXIT

archive="$backup_dir/database.dump"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env NEON_BACKUP_DATABASE_URL \
  --env PGCONNECT_TIMEOUT=10 \
  --mount "type=bind,src=$backup_dir,dst=/backup" \
  postgres:18-alpine \
  sh -euc 'umask 077; pg_dump --format=custom --compress=6 --no-owner --no-acl --dbname="$NEON_BACKUP_DATABASE_URL" --file=/backup/database.dump'

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

size="$(wc -c < "$archive" | tr -d '[:space:]')"
digest="$(shasum -a 256 "$archive" | awk '{print $1}')"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
key="atria-erp/prod/$(date -u +%Y/%m/%d)/neondb-${timestamp}-${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}.dump"

aws s3api put-object \
  --bucket "$BACKUP_S3_BUCKET" \
  --key "$key" \
  --body "$archive" \
  --region "$AWS_REGION" \
  --server-side-encryption AES256 \
  --checksum-algorithm SHA256 \
  --if-none-match '*' \
  --metadata "sha256=$digest" \
  --no-cli-pager >/dev/null

head_result="$(aws s3api head-object \
  --bucket "$BACKUP_S3_BUCKET" \
  --key "$key" \
  --region "$AWS_REGION" \
  --query '[ContentLength, Metadata.sha256]' \
  --output text \
  --no-cli-pager)"
read -r remote_size remote_digest <<< "$head_result"
if [[ "$remote_size" != "$size" || "$remote_digest" != "$digest" ]]; then
  echo "Uploaded backup metadata does not match the local archive" >&2
  exit 1
fi

echo "Backup uploaded: s3://$BACKUP_S3_BUCKET/$key ($size bytes, SHA-256 $digest)"
