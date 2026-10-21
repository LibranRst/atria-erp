"""Test the isolated PostgreSQL command without starting Docker or connecting to a database."""

import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("isolated_integration", Path(__file__).with_name("test-integration.py"))
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
RUN_ID = "a" * 32
CONTAINER_ID = "b" * 64


class IsolationGuardTests(unittest.TestCase):
    def test_environment_is_allowlisted_instead_of_inheriting_database_or_provider_secrets(self) -> None:
        parent = {
            "PATH": "/fixture/bin", "HOME": "/fixture/home", "DOCKER_CONTEXT": "local",
            "DATABASE_URL": "postgresql://live/dev", "ATRIA_TEST_DATABASE_URL": "postgresql://live/test",
            "ATRIA_LOCAL_TEST_DATABASE_URL": "postgresql://remote/test", "ATRIA_TEST_EMPTY_DATABASE_URL": "secret",
            "BETTER_AUTH_SECRET": "live-auth-secret", "OPENAI_API_KEY": "provider-secret",
            "AWS_SECRET_ACCESS_KEY": "cloud-secret", "NODE_OPTIONS": "--import=live-preload",
            "BUN_OPTIONS": "--preload=live-preload", "PGHOST": "live", "PGPASSWORD": "live",
            "NODE_ENV": "production", "UNEXPECTED": "not-allowlisted",
        }
        child = module.safe_environment(parent)
        self.assertEqual(child["NODE_ENV"], "test")
        self.assertEqual(child["DOCKER_CONTEXT"], "local")
        self.assertEqual(set(child), {"PATH", "HOME", "DOCKER_CONTEXT", "NODE_ENV", "BETTER_AUTH_SECRET"})
        self.assertNotEqual(child["BETTER_AUTH_SECRET"], parent["BETTER_AUTH_SECRET"])
        self.assertEqual(parent["DATABASE_URL"], "postgresql://live/dev")

    def test_remote_docker_endpoints_credentials_and_malformed_ports_are_rejected(self) -> None:
        for endpoint in ["ssh://server", "tcp://example.com:2375", "tcp://user:secret@127.0.0.1:2375",
                         "tcp://127.0.0.1:bad", "tcp://127.0.0.1:2375?database=dev", "https://127.0.0.1:2375"]:
            with self.subTest(endpoint=endpoint), self.assertRaises(module.IntegrationSetupError):
                module.validate_docker_endpoint(endpoint)
        for endpoint in ["unix:///var/run/docker.sock", "tcp://127.0.0.1:2375", "tcp://localhost:2375"]:
            module.validate_docker_endpoint(endpoint)

    def test_only_one_exact_ipv4_loopback_binding_is_allowed(self) -> None:
        self.assertEqual(module.parse_loopback_port("127.0.0.1:54321\n"), 54321)
        for binding in ["0.0.0.0:54321", "[::]:54321", "127.0.0.1:0", "127.0.0.1:65536",
                        "127.0.0.1:54321\n127.0.0.1:54322", "127.0.0.1:54321/evil"]:
            with self.subTest(binding=binding), self.assertRaises(module.IntegrationSetupError):
                module.parse_loopback_port(binding)

    def test_explicit_context_overrides_host_and_its_actual_endpoint_is_validated(self) -> None:
        env = {"DOCKER_CONTEXT": "remote-context", "DOCKER_HOST": "unix:///local/docker.sock"}
        with patch.object(module, "capture", return_value="tcp://remote.example:2375") as inspect:
            with self.assertRaises(module.IntegrationSetupError):
                module.validate_docker_endpoint(module.effective_docker_endpoint(env, Path("/fixture")))
            self.assertEqual(inspect.call_args.args[0], [
                "docker", "context", "inspect", "remote-context", "--format", "{{.Endpoints.docker.Host}}",
            ])
        env = {"DOCKER_CONTEXT": "local-context", "DOCKER_HOST": "tcp://remote.example:2375"}
        with patch.object(module, "capture", return_value="unix:///local/docker.sock"):
            module.validate_docker_endpoint(module.effective_docker_endpoint(env, Path("/fixture")))

    def test_host_without_context_is_used_without_inspecting_an_unrelated_context(self) -> None:
        with patch.object(module, "capture") as inspect:
            endpoint = module.effective_docker_endpoint({"DOCKER_HOST": "tcp://remote.example:2375"}, Path("/fixture"))
            with self.assertRaises(module.IntegrationSetupError):
                module.validate_docker_endpoint(endpoint)
            inspect.assert_not_called()

    def test_both_container_labels_and_exact_id_are_required(self) -> None:
        module.validate_container_identity(f"{CONTAINER_ID} readiness-audit {RUN_ID}", CONTAINER_ID, RUN_ID)
        for identity in [f"{CONTAINER_ID} development {RUN_ID}", f"{CONTAINER_ID} readiness-audit other",
                         f"{'c' * 64} readiness-audit {RUN_ID}", ""]:
            with self.subTest(identity=identity), self.assertRaises(module.IntegrationSetupError):
                module.validate_container_identity(identity, CONTAINER_ID, RUN_ID)

    def test_container_command_has_no_password_value_mount_or_caller_database(self) -> None:
        command = module.container_command(RUN_ID)
        self.assertIn("--rm", command)
        self.assertEqual(command[-1], "postgres:17-alpine")
        self.assertIn("127.0.0.1::5432", command)
        self.assertIn("POSTGRES_PASSWORD", command)
        self.assertNotIn("--volume", command)
        self.assertNotIn("--mount", command)
        self.assertFalse(any(value.startswith("POSTGRES_PASSWORD=") for value in command))
        self.assertFalse(any(value.startswith("postgresql:") for value in command))
        with self.assertRaises(module.IntegrationSetupError):
            module.container_command("existing-container")

    def test_environment_metadata_contains_hashes_only_and_detects_edits(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            app = root / "apps/api"
            app.mkdir(parents=True)
            source = app / ".env"
            source.write_text("DATABASE_URL=secret-development-url\n")
            first = module.environment_fingerprint(root)
            self.assertEqual(first, {"apps/api/.env": hashlib.sha256(source.read_bytes()).hexdigest()})
            self.assertNotIn("secret-development-url", json.dumps(first))
            source.write_text("DATABASE_URL=changed-secret\n")
            self.assertNotEqual(module.environment_fingerprint(root), first)

    def test_source_fingerprint_changes_with_source_but_never_reads_environment_content(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "apps/api").mkdir(parents=True)
            source = root / "apps/api/test.ts"
            source.write_text("export const fixture = 1;")
            (root / "apps/api/.env").write_text("private")
            with patch.object(module, "capture", return_value="apps/api/test.ts\0apps/api/.env\0"):
                first = module.source_fingerprint(root, {})
                (root / "apps/api/.env").write_text("private-changed")
                self.assertEqual(module.source_fingerprint(root, {}), first)
                source.write_text("export const fixture = 2;")
                self.assertNotEqual(module.source_fingerprint(root, {}), first)


class LifecycleTests(unittest.TestCase):
    def scenario(self, *, daemon_failure: bool = False, wrong_label: bool = False,
                 malformed_port: bool = False, preparation_exit: int = 0,
                 runner_exit: int = 0, interrupt: bool = False,
                 mutate_environment: bool = False, skipped_tests: int = 0,
                 docker_context: str | None = None) -> tuple[int, dict, list, str]:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "apps/api").mkdir(parents=True)
            env_file = root / "apps/api/.env"
            env_file.write_text("DATABASE_URL=private-development-url")
            (root / "apps/api/test.ts").write_text("fixture-source")
            calls = []

            def run(command: list[str], **kwargs: object) -> SimpleNamespace:
                calls.append((command, kwargs["env"]))
                if command[:2] == ["git", "ls-files"]:
                    return SimpleNamespace(returncode=0, stdout="apps/api/test.ts\0", stderr="")
                if command[:3] == ["docker", "context", "inspect"]:
                    return SimpleNamespace(returncode=0, stdout="unix:///fixture/docker.sock", stderr="")
                if command[:2] == ["docker", "info"]:
                    return SimpleNamespace(returncode=1 if daemon_failure else 0, stdout="17", stderr="secret-diagnostic")
                if command[:2] == ["docker", "run"]:
                    return SimpleNamespace(returncode=0, stdout=CONTAINER_ID, stderr="")
                if command[:2] == ["docker", "inspect"]:
                    label = "somebody-else" if wrong_label else RUN_ID
                    return SimpleNamespace(returncode=0, stdout=f"{CONTAINER_ID} readiness-audit {label}", stderr="")
                if command[:2] == ["docker", "port"]:
                    return SimpleNamespace(returncode=0, stdout="0.0.0.0:54321" if malformed_port else "127.0.0.1:54321", stderr="")
                if command[:2] in [["docker", "exec"], ["docker", "stop"]]:
                    return SimpleNamespace(returncode=0, stdout="ready", stderr="")
                raise AssertionError(f"Unexpected subprocess: {command}")

            def step(command: list[str], child_env: dict[str, str], cwd: Path,
                     log: Path, timeout: float) -> int:
                calls.append((command, child_env))
                self.assertNotIn("DATABASE_URL", child_env)
                self.assertNotIn("OPENAI_API_KEY", child_env)
                self.assertIn("@127.0.0.1:54321/atria_audit_baseline", child_env["ATRIA_LOCAL_TEST_DATABASE_URL"])
                log.write_text("synthetic log")
                if command[0] == "bun":
                    self.assertIn("--no-env-file", command)
                    return preparation_exit
                if interrupt:
                    raise KeyboardInterrupt
                if mutate_environment:
                    env_file.write_text("deliberate-test-only-change")
                results = [{"coverageComplete": True, "counts": {"pass": 560, "fail": 0, "skip": skipped_tests}}]
                destination = Path(command[command.index("--logs") + 1])
                destination.mkdir()
                (destination / "results.json").write_text(json.dumps(results))
                return runner_exit

            output = io.StringIO()
            with patch.object(module.subprocess, "run", side_effect=run), \
                    patch.object(module, "logged_step", side_effect=step), \
                    patch.object(module.uuid, "uuid4", return_value=SimpleNamespace(hex=RUN_ID)), \
                    contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                parent = {"PATH": "/fixture/bin", "HOME": "/fixture/home",
                          "DATABASE_URL": "private-development-url", "OPENAI_API_KEY": "provider-secret"}
                if docker_context:
                    parent["DOCKER_CONTEXT"] = docker_context
                code = module.run_integration(root, parent)
            metadata = json.loads((root / "output/test-integration" / RUN_ID / "run.json").read_text())
            self.assertNotIn("private-development-url", json.dumps(metadata) + output.getvalue())
            self.assertNotIn("provider-secret", json.dumps(metadata) + output.getvalue())
            self.assertNotIn("secret-diagnostic", output.getvalue())
            for command, child_env in calls:
                self.assertNotIn("DATABASE_URL", child_env)
                self.assertNotIn("OPENAI_API_KEY", child_env)
                self.assertFalse(any("private-development-url" in argument for argument in command))
            return code, metadata, calls, output.getvalue()

    def test_success_prepares_runs_and_stops_only_the_returned_owned_id(self) -> None:
        code, metadata, calls, _ = self.scenario()
        self.assertEqual(code, 0)
        self.assertEqual(metadata["counts"], {"pass": 560, "fail": 0, "skip": 0})
        self.assertEqual(metadata["cleanup"], "stopped-owned-container")
        self.assertTrue(metadata["sourceUnchanged"])
        self.assertTrue(metadata["environmentFilesUnchanged"])
        stops = [command for command, _ in calls if command[:2] == ["docker", "stop"]]
        self.assertEqual(stops, [["docker", "stop", "--time", "5", CONTAINER_ID]])
        health_checks = [command for command, _ in calls if command[:2] == ["docker", "exec"]]
        self.assertEqual(health_checks, [[
            "docker", "exec", CONTAINER_ID, "pg_isready", "-h", "127.0.0.1",
            "-U", "postgres", "-d", "atria_audit_baseline",
        ]])

    def test_unavailable_daemon_does_not_create_or_stop_any_container(self) -> None:
        code, metadata, calls, _ = self.scenario(daemon_failure=True)
        self.assertEqual(code, 1)
        self.assertEqual(metadata["cleanup"], "not-created")
        self.assertFalse(any(command[:2] in [["docker", "run"], ["docker", "stop"]] for command, _ in calls))

    def test_verified_context_endpoint_is_pinned_for_all_remaining_docker_commands(self) -> None:
        code, _, calls, _ = self.scenario(docker_context="audited-local-context")
        self.assertEqual(code, 0)
        inspections = [command for command, _ in calls if command[:3] == ["docker", "context", "inspect"]]
        self.assertEqual(inspections, [[
            "docker", "context", "inspect", "audited-local-context", "--format", "{{.Endpoints.docker.Host}}",
        ]])
        for command, child_env in calls:
            if command[0] == "docker" and command[1] != "context":
                self.assertEqual(child_env["DOCKER_HOST"], "unix:///fixture/docker.sock")
                self.assertNotIn("DOCKER_CONTEXT", child_env)

    def test_wrong_ownership_label_fails_closed_without_stopping_any_container(self) -> None:
        code, metadata, calls, _ = self.scenario(wrong_label=True)
        self.assertEqual(code, 1)
        self.assertEqual(metadata["cleanup"], "ownership-or-cleanup-failed")
        self.assertFalse(any(command[:2] == ["docker", "stop"] for command, _ in calls))

    def test_bad_port_failed_prepare_runner_failure_and_interrupt_cleanup_owned_container(self) -> None:
        for options, expected in [({"malformed_port": True}, 1), ({"preparation_exit": 1}, 1),
                                  ({"runner_exit": 1}, 1), ({"interrupt": True}, 130)]:
            with self.subTest(options=options):
                code, metadata, calls, _ = self.scenario(**options)
                self.assertEqual(code, expected)
                self.assertEqual(metadata["cleanup"], "stopped-owned-container")
                self.assertEqual(sum(command[:2] == ["docker", "stop"] for command, _ in calls), 1)

    def test_configuration_changes_fail_evidence_without_rewriting_configuration(self) -> None:
        code, metadata, _, _ = self.scenario(mutate_environment=True)
        self.assertEqual(code, 1)
        self.assertFalse(metadata["environmentFilesUnchanged"])
        self.assertEqual(metadata["status"], "failed")

    def test_success_exit_with_skipped_tests_is_not_accepted_as_complete(self) -> None:
        code, metadata, _, _ = self.scenario(skipped_tests=1)
        self.assertEqual(code, 1)
        self.assertEqual(metadata["status"], "failed")
        self.assertEqual(metadata["cleanup"], "stopped-owned-container")

    def test_logged_step_interrupt_terminates_the_owned_process_group(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            process = Mock()
            process.wait.side_effect = KeyboardInterrupt
            with patch.object(module.subprocess, "Popen", return_value=process) as spawn, \
                    patch.object(module, "terminate_child") as terminate:
                with self.assertRaises(KeyboardInterrupt):
                    module.logged_step(["fixture"], {"NODE_ENV": "test"}, Path(directory),
                                       Path(directory) / "private.log", 10)
            self.assertTrue(spawn.call_args.kwargs["start_new_session"])
            terminate.assert_called_once_with(process)

    def test_timed_out_child_group_is_terminated_then_killed_with_bounded_waits(self) -> None:
        process = Mock(pid=123)
        process.poll.return_value = None
        process.wait.side_effect = [subprocess.TimeoutExpired("fixture", 10), 0]
        with patch.object(module.os, "name", "posix"), patch.object(module.os, "killpg") as kill:
            module.terminate_child(process)
        self.assertEqual([call.args for call in kill.call_args_list], [(123, module.signal.SIGTERM), (123, module.signal.SIGKILL)])
        self.assertEqual([call.kwargs for call in process.wait.call_args_list], [{"timeout": 10}, {"timeout": 5}])


if __name__ == "__main__":
    unittest.main()
