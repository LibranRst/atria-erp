#!/usr/bin/env bash
set -euo pipefail

for variable in BACKUP_R2_BUCKET R2_ACCOUNT_ID AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required R2 setting: $variable" >&2
    exit 1
  fi
done
if [[ ! "$R2_ACCOUNT_ID" =~ ^[a-f0-9]{32}$ || ! "$BACKUP_R2_BUCKET" =~ ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$ ]]; then
  echo "Invalid R2 account or bucket identifier" >&2
  exit 1
fi

export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
export AWS_EC2_METADATA_DISABLED=true
endpoint="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
umask 077
probe_dir="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/atria-r2-check.XXXXXX")"
cleanup() {
  rm -f -- "$probe_dir/source.probe" "$probe_dir/download.probe"
  rmdir -- "$probe_dir"
}
trap cleanup EXIT

printf 'Atria R2 storage check; no database or personal data.\n' > "$probe_dir/source.probe"
digest="$(shasum -a 256 "$probe_dir/source.probe" | awk '{print $1}')"
content_md5="$(openssl dgst -md5 -binary "$probe_dir/source.probe" | openssl base64 -A)"
key="atria-erp/prod/_checks/$(date -u +%Y%m%dT%H%M%SZ)-${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}.probe"

aws s3api put-object --endpoint-url "$endpoint" --region auto \
  --bucket "$BACKUP_R2_BUCKET" --key "$key" --body "$probe_dir/source.probe" \
  --content-md5 "$content_md5" --if-none-match '*' --metadata "sha256=$digest" \
  --no-cli-pager >/dev/null
aws s3api get-object --endpoint-url "$endpoint" --region auto \
  --bucket "$BACKUP_R2_BUCKET" --key "$key" \
  --no-cli-pager "$probe_dir/download.probe" >/dev/null
download_digest="$(shasum -a 256 "$probe_dir/download.probe" | awk '{print $1}')"
if [[ "$download_digest" != "$digest" ]]; then
  echo "R2 storage probe failed content verification" >&2
  exit 1
fi
echo "R2 upload/download verified: $BACKUP_R2_BUCKET/$key (SHA-256 $digest). This is a diagnostic probe, not a database backup."
