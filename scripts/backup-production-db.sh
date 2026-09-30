#!/usr/bin/env bash
set -euo pipefail

for variable in NEON_BACKUP_DATABASE_URL BACKUP_R2_BUCKET R2_ACCOUNT_ID AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY EXPECTED_NEON_HOST EXPECTED_BACKUP_USER; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required backup setting: $variable" >&2
    exit 1
  fi
done

# Never print or pass this URL through a GitHub Action expression in a run script.
python3 - <<'PY'
import os
import re
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
if not re.fullmatch(r"[a-f0-9]{32}", os.environ["R2_ACCOUNT_ID"]):
    raise SystemExit("R2 account ID must be 32 lowercase hexadecimal characters")
if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}[a-z0-9]", os.environ["BACKUP_R2_BUCKET"]):
    raise SystemExit("R2 backup bucket must have a valid lowercase name")
PY

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
backup_dir="$(mktemp -d "$temp_base/atria-db-backup.XXXXXX")"
cleanup() {
  rm -f -- "$backup_dir/database.dump" "$backup_dir/verified.dump"
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
key="atria-erp/prod/$(date -u +%Y/%m/%d)/neondb-${timestamp}-${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}.dump"

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

echo "Backup verified in R2: $BACKUP_R2_BUCKET/$key ($size bytes, SHA-256 $digest)"
