"""Process-level pilot backup guards and integrity tests; fake Docker/R2 only."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest

SCRIPT = Path(__file__).with_name("backup-pilot-db.sh")
DOCKER = '''#!/usr/bin/env python3
import json, os, pathlib, sys
args=sys.argv[1:]
mode=os.environ.get("TEST_MODE")
if "psql" in " ".join(args):
    calls=pathlib.Path(os.environ["TEST_REMOTE"])/"source.calls"
    count=int(calls.read_text())+1 if calls.exists() else 1
    calls.write_text(str(count))
    print(json.dumps({"database":"neondb","user":"atria_pilot_backup","migrationCount":45 if mode=="schema-change" and count>1 else 44,"latestMigrationHash":"f"*64,"latestMigrationAt":1790000000000,"canWrite":mode=="writable-role"}))
elif "pg_dump" in " ".join(args):
    if mode=="dump-failure": raise SystemExit(1)
    mount=next(a for a in args if a.startswith("type=bind,src="))
    root=pathlib.Path(mount.split(",")[1].split("=",1)[1])
    (root/"database.dump").write_bytes(b"PGDMP synthetic archive")
elif mode=="archive-failure": raise SystemExit(1)
'''
AWS = '''#!/usr/bin/env python3
import base64, hashlib, json, os, pathlib, sys
args=sys.argv[1:]
assert args[0]=="s3api"
assert args[args.index("--endpoint-url")+1]=="https://"+"b"*32+".r2.cloudflarestorage.com"
assert args[args.index("--region")+1]=="auto"
key=args[args.index("--key")+1]
assert key.startswith("atria-erp/pilot/") and "/prod/" not in key
root=pathlib.Path(os.environ["TEST_REMOTE"])
name=hashlib.sha256(key.encode()).hexdigest()
body=root/(name+".body")
meta=root/(name+".meta")
mode=os.environ.get("TEST_MODE")
if args[1]=="put-object":
    if mode=="upload-failure": raise SystemExit(1)
    assert args[args.index("--if-none-match")+1]=="*"
    data=pathlib.Path(args[args.index("--body")+1]).read_bytes()
    if "--content-md5" in args:
        assert args[args.index("--content-md5")+1]==base64.b64encode(hashlib.md5(data,usedforsecurity=False).digest()).decode()
    digest=args[args.index("--metadata")+1].split("=",1)[1]
    assert digest==hashlib.sha256(data).hexdigest()
    body.write_bytes(data); meta.write_text(json.dumps([len(data),digest,key]))
elif args[1]=="head-object":
    length,digest,key=json.loads(meta.read_text()); print(length,digest)
elif args[1]=="get-object":
    data=body.read_bytes()
    if mode=="remote-corruption" or (mode=="manifest-corruption" and key.endswith(".json")): data+=b"corrupt"
    pathlib.Path(args[-1]).write_bytes(data)
else: raise SystemExit(2)
'''


class PilotBackupTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        binaries = self.root / "bin"
        remote = self.root / "remote"
        binaries.mkdir(); remote.mkdir()
        for name, content in {"docker": DOCKER, "aws": AWS}.items():
            executable = binaries / name
            executable.write_text(content)
            executable.chmod(0o755)
        self.env = dict(os.environ)
        self.env.update({
            "PATH": f"{binaries}:{self.env['PATH']}", "RUNNER_TEMP": str(self.root),
            "TEST_REMOTE": str(remote), "ATRIA_PILOT_BACKUP_ENABLED": "true",
            "PILOT_BACKUP_DATABASE_URL": "postgresql://atria_pilot_backup:dummy-db-password@ep-pilot-test.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
            "EXPECTED_PILOT_NEON_HOST": "ep-pilot-test.c-3.ap-southeast-1.aws.neon.tech",
            "EXPECTED_PILOT_DATABASE": "neondb", "EXPECTED_PILOT_BACKUP_USER": "atria_pilot_backup",
            "PILOT_CUTOFF_ISO": "2026-10-04T00:00:00+07:00",
            "PILOT_API_RELEASE_COMMIT": "a" * 40, "PILOT_WEB_RELEASE_COMMIT": "c" * 40,
            "GITHUB_SHA": "d" * 40, "R2_ACCOUNT_ID": "b" * 32,
            "BACKUP_R2_BUCKET": "atria-pilot-test-backups", "AWS_ACCESS_KEY_ID": "dummy-r2-key",
            "AWS_SECRET_ACCESS_KEY": "dummy-r2-secret",
        })

    def run_backup(self) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(["bash", str(SCRIPT)], env=self.env, capture_output=True, text=True)
        self.assertFalse(list(self.root.glob("atria-pilot-backup.*")))
        for secret in ["dummy-db-password", "dummy-r2-key", "dummy-r2-secret"]:
            self.assertNotIn(secret, result.stdout + result.stderr)
        return result

    def test_disabled_performs_no_cloud_or_database_operation(self) -> None:
        self.env = {"PATH": self.env["PATH"], "RUNNER_TEMP": str(self.root)}
        result = self.run_backup()
        self.assertEqual(result.returncode, 0)
        self.assertIn("disabled", result.stdout)
        self.assertFalse(list((self.root / "remote").iterdir()))

    def test_archive_and_manifest_are_verified_with_schema_code_and_cutoff(self) -> None:
        result = self.run_backup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Pilot backup and manifest verified", result.stdout)
        records = [json.loads(p.read_text()) for p in (self.root / "remote").glob("*.meta")]
        self.assertEqual(len(records), 2)
        manifest_meta = next(row for row in records if row[2].endswith(".json"))
        manifest_path = self.root / "remote" / (hashlib.sha256(manifest_meta[2].encode()).hexdigest() + ".body")
        manifest = json.loads(manifest_path.read_text())
        self.assertEqual(manifest["source"]["migrationCount"], 44)
        self.assertEqual(manifest["apiCommit"], "a" * 40)
        self.assertEqual(manifest["cutoff"], self.env["PILOT_CUTOFF_ISO"])
        self.assertFalse(manifest["attachmentBytesIncluded"])

    def test_source_identity_tls_routing_and_production_guards_stop_before_upload(self) -> None:
        original = self.env["PILOT_BACKUP_DATABASE_URL"]
        for value in [
            original.replace("atria_pilot_backup:", "atria_backup:"),
            original.replace("ep-pilot-test.", "ep-other-test."),
            original.replace("ep-pilot-test.", "ep-pilot-test-pooler."),
            original.replace("/neondb?", "/wrong_db?"),
            original.replace("sslmode=require", "sslmode=disable"),
            original + "&host=company.example",
            original + "&sslmode=disable",
        ]:
            with self.subTest(value=value.replace("dummy-db-password", "redacted")):
                self.env["PILOT_BACKUP_DATABASE_URL"] = value
                self.assertNotEqual(self.run_backup().returncode, 0)
                self.assertFalse(list((self.root / "remote").glob("*.body")))
        self.env["PILOT_BACKUP_DATABASE_URL"] = original.replace("ep-pilot-test.c-3.ap-southeast-1.aws.neon.tech", "ep-wispy-unit-az0r7nao.c-3.ap-southeast-1.aws.neon.tech")
        self.env["EXPECTED_PILOT_NEON_HOST"] = "ep-wispy-unit-az0r7nao.c-3.ap-southeast-1.aws.neon.tech"
        self.assertNotEqual(self.run_backup().returncode, 0)

    def test_writable_role_or_concurrent_schema_change_is_rejected(self) -> None:
        for mode in ["writable-role", "schema-change"]:
            with self.subTest(mode=mode):
                for file in (self.root / "remote").iterdir(): file.unlink()
                self.env["TEST_MODE"] = mode
                self.assertNotEqual(self.run_backup().returncode, 0)
                self.assertFalse(list((self.root / "remote").glob("*.body")))

    def test_failed_dump_archive_upload_or_remote_bytes_never_report_success(self) -> None:
        for mode in ["dump-failure", "archive-failure", "upload-failure", "remote-corruption", "manifest-corruption"]:
            with self.subTest(mode=mode):
                self.env["TEST_MODE"] = mode
                result = self.run_backup()
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("Pilot backup and manifest verified", result.stdout)

    def test_missing_settings_and_invalid_cutoff_or_release_identity_stop_early(self) -> None:
        for field, value in [("PILOT_CUTOFF_ISO", "2026-10-04"), ("PILOT_API_RELEASE_COMMIT", "unknown"), ("R2_ACCOUNT_ID", "credential.example")]:
            with self.subTest(field=field):
                previous = self.env[field]
                self.env[field] = value
                self.assertNotEqual(self.run_backup().returncode, 0)
                self.env[field] = previous
        del self.env["AWS_SECRET_ACCESS_KEY"]
        self.assertNotEqual(self.run_backup().returncode, 0)


if __name__ == "__main__":
    unittest.main()
