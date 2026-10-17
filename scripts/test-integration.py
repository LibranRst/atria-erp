"""Run real PostgreSQL integration suites in a fresh, isolated Docker container."""

import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import sys
import time
from urllib.parse import urlparse
import uuid


IMAGE = "postgres:17-alpine"
PURPOSE_LABEL = "atria.purpose"
OWNER_LABEL = "paduna.integration-owner"
SAFE_ENVIRONMENT_KEYS = frozenset({
    "PATH", "HOME", "USERPROFILE", "TMPDIR", "TMP", "TEMP", "SYSTEMROOT",
    "LANG", "LANGUAGE", "LC_ALL", "LC_CTYPE", "TZ",
    "DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG", "DOCKER_TLS_VERIFY",
    "DOCKER_CERT_PATH", "DOCKER_API_VERSION",
})


class IntegrationSetupError(RuntimeError):
    pass


def safe_environment(parent: dict[str, str]) -> dict[str, str]:
    """Never pass application/database/provider credentials to test children."""
    result = {key: value for key, value in parent.items() if key in SAFE_ENVIRONMENT_KEYS}
    result["NODE_ENV"] = "test"
    result["BETTER_AUTH_SECRET"] = "isolated-integration-test-only-" + secrets.token_hex(24)
    return result


def validate_docker_endpoint(endpoint: str) -> None:
    if re.fullmatch(r"unix:///[^\r\n]+", endpoint) or re.fullmatch(r"npipe:////[^\r\n]+", endpoint):
        return
    try:
        target = urlparse(endpoint)
        port = target.port
    except ValueError as error:
        raise IntegrationSetupError("Docker must use a local socket or loopback endpoint.") from error
    if (target.scheme == "tcp" and target.hostname in {"localhost", "127.0.0.1", "::1"}
            and port and not target.username and not target.password
            and target.path in {"", "/"} and not target.query and not target.fragment):
        return
    raise IntegrationSetupError("Docker must use a local socket or loopback endpoint.")


def effective_docker_endpoint(env: dict[str, str], root: Path) -> str:
    # Docker gives an explicitly selected context precedence over DOCKER_HOST.
    if env.get("DOCKER_CONTEXT"):
        return capture([
            "docker", "context", "inspect", env["DOCKER_CONTEXT"], "--format",
            "{{.Endpoints.docker.Host}}",
        ], env, root)
    if env.get("DOCKER_HOST"):
        return env["DOCKER_HOST"]
    return capture([
        "docker", "context", "inspect", "--format", "{{.Endpoints.docker.Host}}",
    ], env, root)


def parse_loopback_port(binding: str) -> int:
    match = re.fullmatch(r"127\.0\.0\.1:([0-9]+)\s*", binding)
    if not match or not 1 <= int(match.group(1)) <= 65535:
        raise IntegrationSetupError("Test PostgreSQL must have one IPv4 loopback port binding.")
    return int(match.group(1))


def validate_container_identity(identity: str, container_id: str, run_id: str) -> None:
    if identity.strip().split() != [container_id, "readiness-audit", run_id]:
        raise IntegrationSetupError("Container ownership could not be verified; refusing to operate on it.")


def container_command(run_id: str) -> list[str]:
    if not re.fullmatch(r"[a-f0-9]{32}", run_id):
        raise IntegrationSetupError("Invalid integration run identity.")
    return [
        "docker", "run", "--rm", "--detach", "--name", f"paduna-integration-{run_id[:12]}",
        "--label", f"{PURPOSE_LABEL}=readiness-audit", "--label", f"{OWNER_LABEL}={run_id}",
        "--publish", "127.0.0.1::5432", "--env", "POSTGRES_PASSWORD",
        "--env", "POSTGRES_DB=atria_audit_baseline", IMAGE,
    ]


def capture(command: list[str], env: dict[str, str], cwd: Path, timeout: float = 20) -> str:
    try:
        result = subprocess.run(command, cwd=cwd, env=env, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise IntegrationSetupError(f"Unable to complete {command[0]} {command[1]}.") from error
    if result.returncode != 0:
        raise IntegrationSetupError(f"{command[0]} {command[1]} failed; check the local Docker/Bun prerequisites.")
    return result.stdout.strip()


def verify_container(container_id: str, run_id: str, env: dict[str, str], root: Path) -> None:
    if not re.fullmatch(r"[a-f0-9]{64}", container_id):
        raise IntegrationSetupError("Docker did not return an exact container ID.")
    identity = capture([
        "docker", "inspect", "--format",
        '{{.Id}} {{index .Config.Labels "atria.purpose"}} {{index .Config.Labels "paduna.integration-owner"}}',
        container_id,
    ], env, root)
    validate_container_identity(identity, container_id, run_id)


def terminate_child(process: subprocess.Popen) -> None:
    """Only terminate the fresh process group created for this test step."""
    if process.poll() is not None:
        return
    if os.name == "posix":
        os.killpg(process.pid, signal.SIGTERM)
    else:
        process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        if os.name == "posix":
            os.killpg(process.pid, signal.SIGKILL)
        else:
            process.kill()
        process.wait(timeout=5)


def logged_step(command: list[str], env: dict[str, str], cwd: Path, log: Path,
                timeout: float) -> int:
    with log.open("w") as output:
        process = subprocess.Popen(command, cwd=cwd, env=env, stdout=output,
                                   stderr=subprocess.STDOUT, start_new_session=True)
        try:
            return process.wait(timeout=timeout)
        except (KeyboardInterrupt, subprocess.TimeoutExpired):
            terminate_child(process)
            raise


def environment_fingerprint(root: Path) -> dict[str, str]:
    """Hash configuration bytes without storing or displaying any configuration values."""
    locations = [root]
    apps = root / "apps"
    if apps.is_dir():
        locations.extend(path for path in apps.iterdir() if path.is_dir())
    return {
        path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for directory in locations for path in sorted(directory.glob(".env*")) if path.is_file()
    }


def source_fingerprint(root: Path, env: dict[str, str]) -> str:
    listing = capture([
        "git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--",
        "apps/api", "packages/core", "scripts/test-integration.py",
        "apps/api/scripts/run-local-postgres-audit.py",
    ], env, root)
    digest = hashlib.sha256()
    for name in sorted(set(listing.split("\0"))):
        path = root / name
        if not name or not path.is_file() or path.name.startswith(".env"):
            continue
        digest.update(name.encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def write_metadata(path: Path, metadata: dict) -> None:
    path.write_text(json.dumps(metadata, indent=2) + "\n")
    path.chmod(0o600)


def run_integration(root: Path, parent: dict[str, str]) -> int:
    env = safe_environment(parent)
    run_id = uuid.uuid4().hex
    logs = root / "output" / "test-integration" / run_id
    logs.mkdir(parents=True, mode=0o700, exist_ok=False)
    logs.chmod(0o700)
    before_env = environment_fingerprint(root)
    before_source = source_fingerprint(root, env)
    metadata = {
        "runId": run_id, "image": IMAGE, "sourceSha256": before_source,
        "environmentFilesBefore": before_env, "status": "preparing", "cleanup": "not-created",
    }
    write_metadata(logs / "run.json", metadata)
    container_id = None
    result = 1
    try:
        endpoint = effective_docker_endpoint(env, root)
        validate_docker_endpoint(endpoint)
        # Pin the verified daemon rather than following a later global context switch.
        env = {**env, "DOCKER_HOST": endpoint}
        env.pop("DOCKER_CONTEXT", None)
        capture(["docker", "info", "--format", "{{.ServerVersion}}"], env, root)
        print("Preparing a fresh PostgreSQL container; development data is not selected.", flush=True)
        create_env = {**env, "POSTGRES_PASSWORD": secrets.token_hex(32)}
        created = capture(container_command(run_id), create_env, root, timeout=180)
        if not re.fullmatch(r"[a-f0-9]{64}", created):
            raise IntegrationSetupError("Docker did not return an exact container ID; automatic cleanup is unavailable.")
        container_id = created
        verify_container(container_id, run_id, env, root)
        metadata["cleanup"] = "pending"
        port = parse_loopback_port(capture(["docker", "port", container_id, "5432/tcp"], env, root))
        child_env = {**env, "ATRIA_LOCAL_TEST_DATABASE_URL":
                     f"postgresql://postgres:{create_env['POSTGRES_PASSWORD']}@127.0.0.1:{port}/atria_audit_baseline"}
        ready_until = time.monotonic() + 45
        while True:
            try:
                capture(["docker", "exec", container_id, "pg_isready", "-h", "127.0.0.1", "-U", "postgres",
                         "-d", "atria_audit_baseline"], env, root, timeout=5)
                break
            except IntegrationSetupError:
                if time.monotonic() >= ready_until:
                    raise IntegrationSetupError("Disposable PostgreSQL did not become ready.") from None
                time.sleep(0.5)
        print("Applying repository migrations and synthetic fixtures.", flush=True)
        prepared = logged_step([
            "bun", "--no-env-file", "scripts/prepare-disposable-postgres.ts", "atria_audit_empty",
        ], child_env, root / "apps" / "api", logs / "prepare.log", timeout=180)
        if prepared != 0:
            raise IntegrationSetupError("Disposable fixture preparation failed; see the private prepare.log.")
        print("Running integration suites with a fresh database clone per file.", flush=True)
        result = logged_step([
            sys.executable, str(root / "apps/api/scripts/run-local-postgres-audit.py"),
            "--container", container_id, "--logs", str(logs / "suites"),
        ], child_env, root, logs / "runner.log", timeout=7200)
        if result == 0:
            try:
                suites = json.loads((logs / "suites" / "results.json").read_text())
                if not isinstance(suites, list) or not suites or any(
                    not isinstance(row, dict) or row.get("coverageComplete") is not True for row in suites
                ):
                    raise ValueError("Incomplete suite coverage")
                counts = {key: sum(row.get("counts", {}).get(key, 0) for row in suites)
                          for key in ["pass", "fail", "skip"]}
                if counts["pass"] <= 0 or counts["fail"] != 0 or counts["skip"] != 0:
                    raise ValueError("Incomplete test counts")
            except (OSError, ValueError, TypeError, AttributeError) as error:
                raise IntegrationSetupError("Runner did not produce complete integration evidence.") from error
            metadata["suites"] = len(suites)
            metadata["counts"] = counts
            print(f"{len(suites)} suites: {counts['pass']} pass, {counts['fail']} fail, {counts['skip']} skip.", flush=True)
        metadata["status"] = "passed" if result == 0 else "failed"
    except KeyboardInterrupt:
        metadata["status"] = "interrupted"
        print("Integration run interrupted; cleaning up its container.", file=sys.stderr)
        result = 130
    except (IntegrationSetupError, OSError, subprocess.TimeoutExpired) as error:
        metadata["status"] = "failed"
        # Error text is intentionally bounded: never print subprocess payloads or environment values.
        message = str(error) if isinstance(error, IntegrationSetupError) else "Integration step could not complete."
        metadata["error"] = message
        print(message, file=sys.stderr)
        result = 1
    finally:
        if container_id is not None:
            try:
                verify_container(container_id, run_id, env, root)
                capture(["docker", "stop", "--time", "5", container_id], env, root, timeout=20)
                metadata["cleanup"] = "stopped-owned-container"
            except IntegrationSetupError:
                metadata["cleanup"] = "ownership-or-cleanup-failed"
                print("Could not verify/stop this run's container. Inspect its run ID before manual cleanup.", file=sys.stderr)
                result = 1
        metadata["environmentFilesAfter"] = environment_fingerprint(root)
        metadata["environmentFilesUnchanged"] = metadata["environmentFilesAfter"] == before_env
        metadata["sourceSha256After"] = source_fingerprint(root, env)
        metadata["sourceUnchanged"] = metadata["sourceSha256After"] == before_source
        if not metadata["environmentFilesUnchanged"] or not metadata["sourceUnchanged"]:
            print("Source/configuration changed during the run; inspect metadata and rerun on a stable checkout.", file=sys.stderr)
            result = 1
        metadata["exitCode"] = result
        if result != 0 and metadata["status"] == "passed":
            metadata["status"] = "failed"
        write_metadata(logs / "run.json", metadata)
        print(f"Private results: {logs.relative_to(root)}", flush=True)
    return result


def main() -> int:
    old_umask = os.umask(0o077)
    old_term = signal.getsignal(signal.SIGTERM)
    def interrupt(_signal: int, _frame: object) -> None:
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupt)
    try:
        return run_integration(Path(__file__).resolve().parents[1], dict(os.environ))
    finally:
        signal.signal(signal.SIGTERM, old_term)
        os.umask(old_umask)


if __name__ == "__main__":
    raise SystemExit(main())
