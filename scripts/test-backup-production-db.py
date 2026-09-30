"""Process-level backup checks with fake Docker/R2; no cloud credentials or database."""
import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest

SCRIPT = Path(__file__).with_name("backup-production-db.sh")
DOCKER = '''#!/usr/bin/env python3
import os, pathlib, sys
args = sys.argv[1:]
mount = next(a for a in args if a.startswith("type=bind,src="))
source = pathlib.Path(mount.split(",")[1].split("=", 1)[1])
if "pg_dump" in " ".join(args):
    if os.environ.get("TEST_MODE") == "dump-failure":
        raise SystemExit(1)
    (source / "database.dump").write_bytes(b"PGDMP fake archive with fixture data")
else:
    if os.environ.get("TEST_MODE") == "archive-failure":
        raise SystemExit(1)
'''
AWS = '''#!/usr/bin/env python3
import base64, hashlib, json, os, pathlib, sys
args = sys.argv[1:]
state = pathlib.Path(os.environ["TEST_REMOTE"])
command = args[1]
assert args[0] == "s3api", "No AWS STS call allowed"
assert args[args.index("--endpoint-url") + 1] == "https://222cd96d186c2a56d6d502ec4f96f94f.r2.cloudflarestorage.com"
assert args[args.index("--region") + 1] == "auto"
if command == "put-object":
    if os.environ.get("TEST_MODE") == "upload-failure":
        raise SystemExit(1)
    assert "--server-side-encryption" not in args
    assert "--checksum-algorithm" not in args
    assert args[args.index("--if-none-match") + 1] == "*"
    data = pathlib.Path(args[args.index("--body") + 1]).read_bytes()
    checksum = base64.b64encode(hashlib.md5(data, usedforsecurity=False).digest()).decode()
    assert args[args.index("--content-md5") + 1] == checksum
    digest = args[args.index("--metadata") + 1].split("=", 1)[1]
    (state / "metadata.json").write_text(json.dumps([len(data), digest]))
    (state / "object.dump").write_bytes(data)
elif command == "head-object":
    size, digest = json.loads((state / "metadata.json").read_text())
    print(size, digest)
elif command == "get-object":
    data = (state / "object.dump").read_bytes()
    if os.environ.get("TEST_MODE") == "remote-corruption":
        data += b"corrupt"
    pathlib.Path(args[-1]).write_bytes(data)
else:
    raise SystemExit(2)
'''


class BackupTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        bins = self.root / "bin"
        bins.mkdir()
        remote = self.root / "remote"
        remote.mkdir()
        for name, contents in {"docker": DOCKER, "aws": AWS}.items():
            executable = bins / name
            executable.write_text(contents)
            executable.chmod(0o755)
        self.env = dict(os.environ)
        self.env.update({
            "PATH": f"{bins}:{self.env['PATH']}",
            "RUNNER_TEMP": str(self.root),
            "TEST_REMOTE": str(remote),
            "NEON_BACKUP_DATABASE_URL": "postgresql://atria_backup:dummy-db-password@ep-wispy-unit-az0r7nao.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
            "EXPECTED_NEON_HOST": "ep-wispy-unit-az0r7nao.c-3.ap-southeast-1.aws.neon.tech",
            "EXPECTED_BACKUP_USER": "atria_backup",
            "R2_ACCOUNT_ID": "222cd96d186c2a56d6d502ec4f96f94f",
            "BACKUP_R2_BUCKET": "atria-erp-backups",
            "AWS_ACCESS_KEY_ID": "dummy-r2-key",
            "AWS_SECRET_ACCESS_KEY": "dummy-r2-secret",
        })

    def run_backup(self) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(["bash", str(SCRIPT)], env=self.env, capture_output=True, text=True)
        self.assertFalse(list(self.root.glob("atria-db-backup.*")), "Temporary dumps must be removed")
        for secret in ("dummy-db-password", "dummy-r2-key", "dummy-r2-secret"):
            self.assertNotIn(secret, result.stdout + result.stderr)
        return result

    def test_success_checks_remote_content(self) -> None:
        result = self.run_backup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Backup verified in R2:", result.stdout)

    def test_remote_corruption_fails_despite_matching_metadata(self) -> None:
        self.env["TEST_MODE"] = "remote-corruption"
        result = self.run_backup()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("does not match the local archive", result.stderr)
        self.assertNotIn("Backup verified", result.stdout)

    def test_dump_archive_and_upload_failures_never_report_success(self) -> None:
        for mode in ("dump-failure", "archive-failure", "upload-failure"):
            with self.subTest(mode=mode):
                self.env["TEST_MODE"] = mode
                result = self.run_backup()
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("Backup verified", result.stdout)

    def test_invalid_sources_stop_before_upload(self) -> None:
        original = self.env["NEON_BACKUP_DATABASE_URL"]
        for value in (
            original.replace("atria_backup:", "neondb_owner:"),
            original.replace("ep-wispy-unit-az0r7nao.", "ep-wispy-unit-az0r7nao-pooler."),
            original.replace("/neondb?", "/wrong_database?"),
            original.replace("sslmode=require", "sslmode=disable"),
        ):
            with self.subTest(value=value.replace("dummy-db-password", "redacted")):
                self.env["NEON_BACKUP_DATABASE_URL"] = value
                self.assertNotEqual(self.run_backup().returncode, 0)
                self.assertFalse((self.root / "remote" / "object.dump").exists())

    def test_invalid_r2_account_cannot_redirect_credentials(self) -> None:
        self.env["R2_ACCOUNT_ID"] = "example.com/credential-target"
        self.assertNotEqual(self.run_backup().returncode, 0)
        self.assertFalse((self.root / "remote" / "object.dump").exists())

    def test_missing_credentials_stop_early(self) -> None:
        del self.env["AWS_SECRET_ACCESS_KEY"]
        self.assertNotEqual(self.run_backup().returncode, 0)
        self.assertFalse((self.root / "remote" / "object.dump").exists())


if __name__ == "__main__":
    unittest.main()
