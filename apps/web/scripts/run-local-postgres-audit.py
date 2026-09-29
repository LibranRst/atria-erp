"""Run each DB integration suite against its own disposable PostgreSQL clone.

Requires an explicitly labelled local container and prepared seed/empty templates.
Never reads DATABASE_URL or changes the application's env files.
"""

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", required=True)
    parser.add_argument("--seed-template", default="atria_audit_baseline")
    parser.add_argument("--empty-template", default="atria_audit_empty42")
    parser.add_argument("--logs", type=Path, required=True)
    args = parser.parse_args()
    for name in [args.seed_template, args.empty_template]:
        if not re.fullmatch(r"atria_audit_[a-z0-9_]+", name):
            parser.error("Template names must use the atria_audit_ prefix")
    label = subprocess.check_output([
        "docker", "inspect", "--format", '{{index .Config.Labels "atria.purpose"}}', args.container,
    ], text=True).strip()
    if label != "readiness-audit":
        parser.error("Container must carry atria.purpose=readiness-audit")
    binding = subprocess.check_output(["docker", "port", args.container, "5432"], text=True).strip()
    match = re.fullmatch(r"127\.0\.0\.1:(\d+)", binding)
    if not match:
        parser.error("PostgreSQL must have exactly one loopback port binding")
    port = match.group(1)
    app = Path(__file__).resolve().parents[1]
    args.logs.mkdir(parents=True, exist_ok=True)
    files = sorted(
        str(path.relative_to(app)) for path in (app / "lib").rglob("*.test.ts")
        if "describeIntegration(" in path.read_text()
    )
    files.append("lib/testing/empty-database-loaders.integration.test.ts")
    results = []
    run_id = uuid.uuid4().hex[:12]
    for index, file in enumerate(files):
        database = f"atria_audit_{run_id}_{index}"
        empty = "empty-database" in file
        template = args.empty_template if empty else args.seed_template
        subprocess.run([
            "docker", "exec", args.container, "psql", "-U", "postgres", "-d", "postgres",
            "-v", "ON_ERROR_STOP=1", "-c", f"CREATE DATABASE {database} TEMPLATE {template};",
        ], check=True, stdout=subprocess.DEVNULL)
        env = os.environ.copy()
        # Disposable local credential used only by the audit container.
        env["ATRIA_LOCAL_TEST_DATABASE_URL"] = (
            f"postgresql://postgres:atria-local-audit@127.0.0.1:{port}/{database}"
        )
        env["ATRIA_LOCAL_TEST_MODE"] = "empty" if empty else "seeded"
        log = args.logs / f"{index:02d}.log"
        started = time.monotonic()
        try:
            with log.open("w") as output:
                try:
                    result = subprocess.run([
                        "bun", "test", "--preload", "./scripts/local-postgres-preload.ts",
                        "--timeout", "30000", file,
                    ], cwd=app, env=env, stdout=output, stderr=subprocess.STDOUT, timeout=100)
                    code = result.returncode
                except subprocess.TimeoutExpired:
                    code = 124
            content = log.read_text()
            counts = {key: int(value) for value, key in re.findall(r"^ (\d+) (pass|fail|skip)$", content, re.M)}
            row = {"file": file, "exit": code, "seconds": round(time.monotonic() - started, 1), "counts": counts, "log": log.name}
            results.append(row)
            (args.logs / "results.json").write_text(json.dumps(results, indent=2) + "\n")
            print(json.dumps(row), flush=True)
        finally:
            # Only a database created above in the explicitly labelled container.
            subprocess.run(["docker", "exec", args.container, "dropdb", "-U", "postgres", "--force", database], check=True)
    return int(any(row["exit"] != 0 for row in results))


if __name__ == "__main__":
    raise SystemExit(main())
