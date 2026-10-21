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
from urllib.parse import ParseResult, urlparse


# These ordinary subprocess tests explicitly clear both selectors and use
# isolated PGlite/mocked fixtures; mentioning the env is not a live DB suite.
UNIT_DATABASE_SELECTOR_ALLOWLIST = frozenset({
    "src/backend/app/actions/administration-bootstrap.test.ts",
    "src/backend/app/actions/material/operations-dashboard.test.ts",
    "src/backend/features/projects/detail/server/project-operations-read.test.ts",
    "src/backend/features/projects/detail/server/project-planning-read.test.ts",
    "src/backend/features/projects/list/server/projects-desktop-read.test.ts",
    "src/backend/features/settings/server/settings-read-tenant.test.ts",
    "src/backend/server/usecases/finance/client-payment-tenant.test.ts",
    "src/backend/server/usecases/material/material-desktop.test.ts",
})
INTEGRATION_HELPER = "@backend/lib/testing/integration-db"
DEVELOPMENT_SUITE = "scripts/development-seed.integration.test.ts"


def reviewed_unit_boundary(relative: str, source: str) -> bool:
    if relative in UNIT_DATABASE_SELECTOR_ALLOWLIST:
        return all(
            re.search(r"\b" + variable + r"\s*:\s*undefined\b", source)
            and len(re.findall(r"\b" + variable + r"\b", source)) == 1
            for variable in ["ATRIA_TEST_DATABASE_URL", "ATRIA_TEST_EMPTY_DATABASE_URL"]
        )
    if relative == "scripts/local-postgres-preload.test.ts":
        return (source.count("ATRIA_TEST_EMPTY_DATABASE_URL") == 1
                and "ATRIA_TEST_DATABASE_URL" not in source
                and "127.0.0.1:1/atria_audit_seed" in source
                and "./scripts/local-postgres-preload.ts" in source
                and "@backend/db" not in source)
    if relative == "tests/native-http.test.ts":
        return (source.count("ATRIA_TEST_DATABASE_URL") == 1
                and "ATRIA_TEST_EMPTY_DATABASE_URL" not in source
                and "ATRIA_TEST_DATABASE_URL: undefined" in source
                and "postgresql://fixture:fixture@127.0.0.1:1/disposable-only" in source
                and "fixtures/native-http-case.ts" in source)
    return False


def discover_suites(app: Path) -> list[dict[str, str]]:
    """Fail closed for live/marked suites without a recognized database guard."""
    suites = []
    paths = sorted(path for root in [app / "src", app / "scripts", app / "tests"]
                   for path in root.rglob("*") if root.exists())
    for path in paths:
        if not path.is_file() or not path.name.endswith((".test.ts", ".test.tsx")):
            continue
        source = path.read_text()
        relative = path.relative_to(app).as_posix()
        if relative == DEVELOPMENT_SUITE:
            required = [
                'const enabled = process.env.ATRIA_TEST_DEVELOPMENT_SEED === "true";',
                "if (enabled) disposablePostgresTarget(process.env.ATRIA_TEST_DATABASE_URL, process.env.NODE_ENV);",
                "const suite = enabled ? describe : describe.skip;", "suite(",
                'from "./disposable-postgres-guard"',
            ]
            if not all(marker in source for marker in required):
                raise ValueError(f"Development profile guard requires review: {relative}")
            suites.append({"file": relative, "mode": "development"})
            continue
        bindings = re.findall(
            r"\bimport\s*\{([^}]+)\}\s*from\s*['\"]"
            + re.escape(INTEGRATION_HELPER) + r"['\"]", source, re.S,
        )
        modes = set()
        for binding in bindings:
            for item in binding.split(","):
                match = re.fullmatch(
                    r"\s*(describeIntegration|describeEmptyIntegration)"
                    r"(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*", item,
                )
                if not match:
                    continue
                original, alias = match.groups()
                if re.search(r"\b" + re.escape(alias or original) + r"\s*\(", source):
                    modes.add("empty" if original == "describeEmptyIntegration" else "seeded")
        if len(modes) > 1:
            raise ValueError(f"Mixed seeded/empty guards require separate suite files: {relative}")
        if modes:
            suites.append({"file": relative, "mode": modes.pop()})
            continue
        database_case = (
            path.name.endswith((".integration.test.ts", ".integration.test.tsx"))
            or "ATRIA_TEST_DATABASE_URL" in source
            or "ATRIA_TEST_EMPTY_DATABASE_URL" in source
            or "describeIntegration" in source or "describeEmptyIntegration" in source
            or INTEGRATION_HELPER in source
        )
        if not database_case:
            continue
        if reviewed_unit_boundary(relative, source):
            continue
        raise ValueError(f"Unreviewed database test lacks a supported integration guard: {relative}")
    if not suites:
        raise ValueError("No guarded integration suites discovered")
    return suites


def suite_environment(parent: dict[str, str], target: ParseResult,
                      database: str, mode: str) -> dict[str, str]:
    """Both Bun preloads see only the new clone, never an inherited dev URL."""
    if not re.fullmatch(r"atria_audit_[a-f0-9]{12}_[0-9]+", database):
        raise ValueError("Only a run-owned generated clone may be selected")
    if mode not in {"seeded", "empty", "development"}:
        raise ValueError("Unknown integration database mode")
    env = parent.copy()
    for key in ["DATABASE_URL", "ATRIA_TEST_DATABASE_URL", "ATRIA_TEST_EMPTY_DATABASE_URL",
                "ATRIA_LOCAL_TEST_DATABASE_URL", "ATRIA_LOCAL_TEST_MODE",
                "ATRIA_AUDIT_RUN_ID", "ATRIA_AUDIT_SUITE_INDEX", "ATRIA_AUDIT_SUITE_TOKEN",
                "ATRIA_TEST_DEVELOPMENT_SEED"]:
        env.pop(key, None)
    clone = target._replace(path=f"/{database}").geturl()
    env["DATABASE_URL"] = clone
    env["ATRIA_LOCAL_TEST_DATABASE_URL"] = clone
    env["ATRIA_LOCAL_TEST_MODE"] = "empty" if mode == "empty" else "seeded"
    if mode == "development":
        env["ATRIA_TEST_DEVELOPMENT_SEED"] = "true"
    identity = re.fullmatch(r"atria_audit_([a-f0-9]{12})_([0-9]+)", database)
    if identity is None:
        raise ValueError("Missing generated clone identity")
    env["ATRIA_AUDIT_RUN_ID"], env["ATRIA_AUDIT_SUITE_INDEX"] = identity.groups()
    env["ATRIA_AUDIT_SUITE_TOKEN"] = ":".join(identity.groups())
    env["ATRIA_TEST_EMPTY_DATABASE_URL" if mode == "empty"
        else "ATRIA_TEST_DATABASE_URL"] = clone
    return env


def failure_summary(content: str, protected_values: list[str]) -> list[str]:
    """Return bounded assertion locations, never raw request/DB/provider payloads."""
    clean = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", content)
    for value in protected_values:
        if value:
            clean = clean.replace(value, "<REDACTED>")
    details = []
    for line in clean.splitlines():
        stripped = line.strip()
        if (stripped.startswith("(fail)")
                or re.fullmatch(r"(?:Expected|Received): (?:true|false|null|undefined|-?[0-9]+(?:\.[0-9]+)?)", stripped)
                or re.fullmatch(r"at .{1,240}\.test\.ts:[0-9]+:[0-9]+\)?", stripped)):
            details.append(stripped[:320])
            if len(details) >= 40:
                break
    return details


def coverage_complete(exit_code: int, counts: dict[str, int]) -> bool:
    return (exit_code == 0 and counts.get("pass", 0) > 0
            and counts.get("fail", 0) == 0 and counts.get("skip", 0) == 0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", required=True)
    parser.add_argument("--seed-template", default="atria_audit_baseline")
    parser.add_argument("--empty-template", default="atria_audit_empty")
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
    configured = os.environ.get("ATRIA_LOCAL_TEST_DATABASE_URL")
    if not configured:
        parser.error("ATRIA_LOCAL_TEST_DATABASE_URL must identify this disposable container")
    target = urlparse(configured)
    if (target.scheme != "postgresql" or target.hostname not in {"localhost", "127.0.0.1"}
            or target.port != int(port) or not target.username or not target.password
            or not re.fullmatch(r"/atria_audit_[a-z0-9_]+", target.path)
            or target.query or target.fragment or os.environ.get("NODE_ENV") == "production"):
        parser.error("Test URL must match the labelled container's loopback port and atria_audit_* database")
    app = Path(__file__).resolve().parents[1]
    args.logs.mkdir(parents=True, exist_ok=True)
    try:
        suites = discover_suites(app)
    except ValueError as error:
        parser.error(str(error))
    (args.logs / "inventory.json").write_text(json.dumps(suites, indent=2) + "\n")
    results = []
    run_id = uuid.uuid4().hex[:12]
    for index, suite in enumerate(suites):
        file = suite["file"]
        database = f"atria_audit_{run_id}_{index}"
        empty = suite["mode"] == "empty"
        template = args.empty_template if empty or suite["mode"] == "development" else args.seed_template
        subprocess.run([
            "docker", "exec", args.container, "psql", "-U", "postgres", "-d", "postgres",
            "-v", "ON_ERROR_STOP=1", "-c", f"CREATE DATABASE {database} TEMPLATE {template};",
        ], check=True, stdout=subprocess.DEVNULL)
        # Preserve supplied disposable credentials without printing them or
        # assuming a fixed password. Only the database created above is selected.
        env = suite_environment(dict(os.environ), target, database, suite["mode"])
        log = args.logs / f"{index:02d}.log"
        started = time.monotonic()
        try:
            with log.open("w") as output:
                try:
                    prepared = 0
                    if suite["mode"] == "development":
                        prepared = subprocess.run([
                            "bun", "--no-env-file", "--preload", "./scripts/local-postgres-preload.ts",
                            "scripts/prepare-audit-development-fixture.ts",
                        ], cwd=app, env=env, stdout=output, stderr=subprocess.STDOUT, timeout=100).returncode
                    result = subprocess.run([
                        "bun", "--no-env-file", "test", "--preload", "./scripts/local-postgres-preload.ts",
                        "--timeout", "30000", file,
                    ], cwd=app, env=env, stdout=output, stderr=subprocess.STDOUT, timeout=100) if prepared == 0 else None
                    code = result.returncode if result is not None else prepared
                except subprocess.TimeoutExpired:
                    code = 124
            content = log.read_text()
            counts = {key: int(value) for value, key in re.findall(r"^ (\d+) (pass|fail|skip)$", content, re.M)}
            row = {"file": file, "mode": suite["mode"], "exit": code, "seconds": round(time.monotonic() - started, 1), "counts": counts, "log": log.name}
            row["coverageComplete"] = coverage_complete(code, counts)
            if code != 0:
                protected = [configured, env["DATABASE_URL"], target.password]
                protected.extend(value for key, value in env.items()
                                 if re.search(r"(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|ACCESS_KEY|API_KEY)$", key)
                                 and value)
                row["failures"] = failure_summary(content, protected)
            elif not row["coverageComplete"]:
                row["failures"] = ["Selected integration suite has skipped or unexecuted tests."]
            results.append(row)
            (args.logs / "results.json").write_text(json.dumps(results, indent=2) + "\n")
            print(json.dumps(row), flush=True)
        finally:
            # Only a database created above in the explicitly labelled container.
            subprocess.run(["docker", "exec", args.container, "dropdb", "-U", "postgres", "--force", database], check=True)
    return int(any(not row["coverageComplete"] for row in results))


if __name__ == "__main__":
    raise SystemExit(main())
