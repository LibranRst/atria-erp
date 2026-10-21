"""Dump/restore synthetic local data and verify actual finance invariants. No cloud calls."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import uuid
from urllib.parse import urlparse


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", required=True)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--cutoff", required=True)
    args = parser.parse_args()
    configured = os.environ.get("ATRIA_LOCAL_TEST_DATABASE_URL")
    if not configured or os.environ.get("NODE_ENV") == "production":
        parser.error("Explicit non-production ATRIA_LOCAL_TEST_DATABASE_URL is required")
    target = urlparse(configured)
    if (target.scheme != "postgresql" or target.hostname not in {"127.0.0.1", "localhost"}
            or not re.fullmatch(r"/atria_audit_[a-z0-9_]+", target.path)
            or not target.username or not target.password or target.query or target.fragment):
        parser.error("Only authenticated local atria_audit_* sources are allowed")
    label = subprocess.check_output([
        "docker", "inspect", "--format", '{{index .Config.Labels "atria.purpose"}}', args.container,
    ], text=True).strip()
    binding = subprocess.check_output(["docker", "port", args.container, "5432"], text=True).strip()
    if label != "readiness-audit" or binding != f"127.0.0.1:{target.port}":
        parser.error("Source must match the labelled disposable container's loopback port")
    cutoff = datetime.datetime.fromisoformat(args.cutoff.replace("Z", "+00:00"))
    if cutoff.tzinfo is None:
        parser.error("Cutoff must contain a timezone")
    source = target.path.removeprefix("/")
    restored = "atria_audit_restore_" + uuid.uuid4().hex[:10]
    args.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(args.directory, 0o700)
    archive = args.directory / "database.dump"
    if archive.exists():
        parser.error("Choose a new directory; existing archive will not be overwritten")
    source_metadata = subprocess.check_output([
        "docker", "exec", args.container, "psql", "-U", "postgres", "-d", source, "-At", "-c",
        "SELECT json_build_object('database',current_database(),'migrationCount',(SELECT count(*) FROM drizzle.__drizzle_migrations),'latestMigrationHash',(SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1),'userCount',(SELECT count(*) FROM \"user\"));",
    ], text=True)
    with archive.open("wb") as output:
        subprocess.run([
            "docker", "exec", args.container, "pg_dump", "-U", "postgres", "-d", source,
            "--format=custom", "--no-owner", "--no-acl",
        ], stdout=output, check=True)
    archive.chmod(0o600)
    if archive.stat().st_size == 0:
        raise RuntimeError("Backup archive is empty")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    with archive.open("rb") as input_file:
        subprocess.run(["docker", "exec", "-i", args.container, "pg_restore", "--file=/dev/null"], stdin=input_file, check=True)
    subprocess.run(["docker", "exec", args.container, "createdb", "-U", "postgres", restored], check=True)
    try:
        with archive.open("rb") as input_file:
            subprocess.run([
                "docker", "exec", "-i", args.container, "pg_restore", "-U", "postgres", "-d", restored,
                "--exit-on-error", "--no-owner", "--no-acl",
            ], stdin=input_file, check=True)
        app = Path(__file__).resolve().parents[1]
        env = os.environ.copy()
        env["ATRIA_LOCAL_TEST_DATABASE_URL"] = target._replace(path=f"/{restored}").geturl()
        env["NODE_ENV"] = "test"
        env["GEMINI_API_KEY"] = ""
        with (args.directory / "invariants.log").open("w") as output:
            result = subprocess.run([
                "bun", "--preload", "./scripts/local-postgres-preload.ts", "scripts/check-invariants.ts",
            ], cwd=app, env=env, stdout=output, stderr=subprocess.STDOUT)
        if result.returncode:
            raise RuntimeError("Restored database failed finance/material invariants; inspect private local log")
        restored_metadata = subprocess.check_output([
            "docker", "exec", args.container, "psql", "-U", "postgres", "-d", restored, "-At", "-c",
            "SELECT json_build_object('migrationCount',(SELECT count(*) FROM drizzle.__drizzle_migrations),'latestMigrationHash',(SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1),'userCount',(SELECT count(*) FROM \"user\"));",
        ], text=True)
        source_info = json.loads(source_metadata)
        restored_info = json.loads(restored_metadata)
        for key in ["migrationCount", "latestMigrationHash", "userCount"]:
            if source_info[key] != restored_info[key]:
                raise RuntimeError("Restored schema/data identity does not match source")
        repo = app.parent.parent
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip()
        dirty = subprocess.run(["git", "diff", "--quiet"], cwd=repo).returncode != 0
        source_digest = hashlib.sha256()
        files = sorted([*list((app / "src").rglob("*.ts")), *list((repo / "packages/core/src").rglob("*.ts")), repo / "bun.lock"])
        for file in files:
            source_digest.update(str(file.relative_to(repo)).encode())
            source_digest.update(hashlib.sha256(file.read_bytes()).digest())
        manifest = {
            "kind": "atria-synthetic-local-restore-v1", "cutoff": args.cutoff,
            "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "codeCommit": commit, "workingTreeDirty": dirty,
            "workspaceSourceSha256": source_digest.hexdigest(), "source": source_info,
            "restored": restored_info, "sha256": digest, "bytes": archive.stat().st_size,
            "invariantsPassed": True, "cloudUploadPerformed": False, "attachmentBytesIncluded": False,
        }
        path = args.directory / "manifest.json"
        path.write_text(json.dumps(manifest, indent=2) + "\n")
        path.chmod(0o600)
        print(json.dumps({"restore": "passed", "sha256": digest, "bytes": manifest["bytes"],
                          "migrationCount": source_info["migrationCount"], "userCount": source_info["userCount"],
                          "manifest": str(path), "cloudUploadPerformed": False}))
    finally:
        subprocess.run(["docker", "exec", args.container, "dropdb", "-U", "postgres", "--force", restored], check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
