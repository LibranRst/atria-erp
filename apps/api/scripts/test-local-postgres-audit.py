"""Check bounded, credential-free PostgreSQL failure diagnostics."""

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from urllib.parse import urlparse

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location(
    "postgres_audit", Path(__file__).with_name("run-local-postgres-audit.py")
)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FailureSummaryTests(unittest.TestCase):
    def test_keeps_assertions_and_redacts_known_credentials(self) -> None:
        content = (
            "\x1b[31m(fail) scope regression fixture-secret\x1b[0m\n"
            "Expected: false\nReceived: true\n"
            "    at case (/app/actions-field.test.ts:306:12)\n"
        )
        result = module.failure_summary(content, ["fixture-secret"])
        self.assertEqual(result, [
            "(fail) scope regression <REDACTED>", "Expected: false", "Received: true",
            "at case (/app/actions-field.test.ts:306:12)",
        ])
        self.assertNotIn("fixture-secret", str(result))
        self.assertNotIn("\x1b", str(result))

    def test_never_includes_payloads_or_non_scalar_received_values(self) -> None:
        content = (
            'error: provider {"token":"unlisted-secret"}\n'
            'Received: "unlisted-secret"\n'
            'DATABASE_URL=postgresql://user:password@localhost/atria_audit_db\n'
            'Expected: 12500\nReceived: 0\n'
        )
        self.assertEqual(module.failure_summary(content, []), ["Expected: 12500", "Received: 0"])

    def test_bounds_line_count_and_length(self) -> None:
        content = "\n".join("(fail) " + "x" * 1000 for _ in range(100))
        result = module.failure_summary(content, [])
        self.assertEqual(len(result), 40)
        self.assertTrue(all(len(line) <= 320 for line in result))


class DiscoveryTests(unittest.TestCase):
    def fixture(self, app: Path, file: str, source: str) -> None:
        path = app / file
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source)

    def test_discovers_all_domains_aliases_and_explicit_empty_mode(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory)
            self.fixture(app, "src/backend/app/actions/ai/action.integration.test.ts",
                         'import { describeIntegration as databaseSuite } from "@backend/lib/testing/integration-db"; databaseSuite("action", () => {});')
            self.fixture(app, "src/backend/server/usecases/profile/profile.test.ts",
                         'import { describeIntegration } from "@backend/lib/testing/integration-db"; describeIntegration("profile", () => {});')
            self.fixture(app, "src/backend/lib/testing/arbitrary-name.test.tsx",
                         'import { describeEmptyIntegration } from "@backend/lib/testing/integration-db"; describeEmptyIntegration("empty", () => {});')
            self.fixture(app, "src/unit.test.ts", 'test("ordinary unit", () => {});')
            self.assertEqual(module.discover_suites(app), [
                {"file": "src/backend/app/actions/ai/action.integration.test.ts", "mode": "seeded"},
                {"file": "src/backend/lib/testing/arbitrary-name.test.tsx", "mode": "empty"},
                {"file": "src/backend/server/usecases/profile/profile.test.ts", "mode": "seeded"},
            ])

    def test_mixed_guards_are_rejected_instead_of_selecting_one_template(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory)
            self.fixture(app, "src/mixed.integration.test.ts",
                         'import { describeIntegration, describeEmptyIntegration } from "@backend/lib/testing/integration-db"; describeIntegration("seed", () => {}); describeEmptyIntegration("empty", () => {});')
            with self.assertRaisesRegex(ValueError, "Mixed seeded/empty"):
                module.discover_suites(app)

    def test_direct_skipif_or_unmarked_integration_fails_closed(self) -> None:
        for name, source in [
            ("src/direct.test.ts", 'describe.skipIf(!process.env.ATRIA_TEST_DATABASE_URL)("db", () => {});'),
            ("src/missing.integration.test.ts", 'describe("unguarded database", () => {});'),
            ("src/fake.integration.test.ts", 'import { describeIntegration } from "./not-the-safe-helper"; describeIntegration("db", () => {});'),
            ("src/unreviewed.test.ts", 'import { hasIntegrationDatabase } from "@backend/lib/testing/integration-db"; describe.skipIf(!hasIntegrationDatabase)("db", () => {});'),
        ]:
            with tempfile.TemporaryDirectory() as directory:
                app = Path(directory)
                self.fixture(app, name, source)
                with self.assertRaisesRegex(ValueError, "Unreviewed database test"):
                    module.discover_suites(app)

    def test_reviewed_unit_exclusion_still_requires_both_database_selectors_cleared(self) -> None:
        for relative in module.UNIT_DATABASE_SELECTOR_ALLOWLIST:
            for cleared in [True, False]:
                with self.subTest(file=relative, cleared=cleared), tempfile.TemporaryDirectory() as directory:
                    app = Path(directory)
                    self.fixture(app, "src/valid.integration.test.ts",
                                 'import { describeIntegration } from "@backend/lib/testing/integration-db"; describeIntegration("db", () => {});')
                    source = ('ATRIA_TEST_DATABASE_URL: undefined, ATRIA_TEST_EMPTY_DATABASE_URL: undefined'
                              if cleared else 'ATRIA_TEST_DATABASE_URL: process.env.DATABASE_URL')
                    self.fixture(app, relative, source)
                    if cleared:
                        self.assertEqual(len(module.discover_suites(app)), 1)
                    else:
                        with self.assertRaisesRegex(ValueError, "Unreviewed database test"):
                            module.discover_suites(app)

    def test_each_reviewed_unit_wrapper_requires_both_explicit_selector_clears(self) -> None:
        for relative in module.UNIT_DATABASE_SELECTOR_ALLOWLIST:
            for removed in ["ATRIA_TEST_DATABASE_URL", "ATRIA_TEST_EMPTY_DATABASE_URL"]:
                with self.subTest(file=relative, removed=removed), tempfile.TemporaryDirectory() as directory:
                    app = Path(directory)
                    selectors = ["ATRIA_TEST_DATABASE_URL", "ATRIA_TEST_EMPTY_DATABASE_URL"]
                    self.fixture(app, relative, ", ".join(
                        f"{name}: undefined" for name in selectors if name != removed))
                    with self.assertRaisesRegex(ValueError, "Unreviewed database test"):
                        module.discover_suites(app)

    def test_unit_allowlist_cannot_hide_an_added_direct_live_database_guard(self) -> None:
        for relative in module.UNIT_DATABASE_SELECTOR_ALLOWLIST:
            with self.subTest(file=relative), tempfile.TemporaryDirectory() as directory:
                app = Path(directory)
                self.fixture(app, relative,
                             'ATRIA_TEST_DATABASE_URL: undefined, ATRIA_TEST_EMPTY_DATABASE_URL: undefined; describe.skipIf(!process.env.ATRIA_TEST_DATABASE_URL)("actual db", () => {});')
                with self.assertRaisesRegex(ValueError, "Unreviewed database test"):
                    module.discover_suites(app)

    def test_reviewed_unit_wrapper_with_recognized_live_guard_is_included(self) -> None:
        for relative in module.UNIT_DATABASE_SELECTOR_ALLOWLIST:
            with self.subTest(file=relative), tempfile.TemporaryDirectory() as directory:
                app = Path(directory)
                self.fixture(app, relative,
                             'ATRIA_TEST_DATABASE_URL: undefined, ATRIA_TEST_EMPTY_DATABASE_URL: undefined; import { describeIntegration } from "@backend/lib/testing/integration-db"; describeIntegration("actual db", () => {});')
                self.assertEqual(module.discover_suites(app), [{"file": relative, "mode": "seeded"}])

    def test_repository_inventory_contains_new_ai_actions_readers_and_profile_suites(self) -> None:
        app = Path(__file__).resolve().parents[1]
        suites = module.discover_suites(app)
        files = {row["file"] for row in suites}
        self.assertGreaterEqual(len(files), 57)
        self.assertEqual(len(files), len(suites))
        self.assertTrue({
            "src/backend/app/actions/ai/expense-batch.integration.test.ts",
            "src/backend/app/actions/ai/quick-start.integration.test.ts",
            "src/backend/lib/ai/tools/expense-status.integration.test.ts",
            "src/backend/lib/ai/tools/financial-history-tools.integration.test.ts",
            "src/backend/server/usecases/profile/role-guide.integration.test.ts",
        }.issubset(files))
        self.assertEqual(next(row["mode"] for row in suites
                              if row["file"].endswith("empty-database-loaders.integration.test.ts")), "empty")
        self.assertEqual(next(row["mode"] for row in suites
                              if row["file"] == module.DEVELOPMENT_SUITE), "development")
        self.assertNotIn("tests/native-http.test.ts", files)
        self.assertNotIn("scripts/local-postgres-preload.test.ts", files)
        self.assertTrue(module.UNIT_DATABASE_SELECTOR_ALLOWLIST.isdisjoint(files))

    def test_unknown_direct_database_guard_in_scripts_is_not_silently_ignored(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory)
            self.fixture(app, "scripts/new.integration.test.ts", 'describe.skipIf(!process.env.ATRIA_TEST_DATABASE_URL)("db", () => {});')
            with self.assertRaisesRegex(ValueError, "Unreviewed database test"):
                module.discover_suites(app)

    def test_development_profile_guard_change_requires_review(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory)
            self.fixture(app, module.DEVELOPMENT_SUITE, 'suite("dev", () => {});')
            with self.assertRaisesRegex(ValueError, "Development profile guard"):
                module.discover_suites(app)


class CloneEnvironmentTests(unittest.TestCase):
    def test_seeded_and_empty_children_only_receive_run_owned_clone_selectors(self) -> None:
        parent = {"DATABASE_URL": "postgresql://live/dev", "ATRIA_TEST_DATABASE_URL": "postgresql://other/dev",
                  "ATRIA_TEST_EMPTY_DATABASE_URL": "postgresql://other/empty", "ATRIA_LOCAL_TEST_DATABASE_URL": "postgresql://other/local",
                  "ATRIA_LOCAL_TEST_MODE": "stale", "ATRIA_TEST_DEVELOPMENT_SEED": "true", "KEEP_SETTING": "keep"}
        target = urlparse("postgresql://tester:secret@127.0.0.1:54321/atria_audit_seed")
        for mode in ["seeded", "empty", "development"]:
            env = module.suite_environment(parent, target, "atria_audit_123456abcdef_2", mode)
            clone = "postgresql://tester:secret@127.0.0.1:54321/atria_audit_123456abcdef_2"
            self.assertEqual(env["DATABASE_URL"], clone)
            self.assertEqual(env["ATRIA_LOCAL_TEST_DATABASE_URL"], clone)
            self.assertEqual(env["ATRIA_LOCAL_TEST_MODE"], "empty" if mode == "empty" else "seeded")
            self.assertEqual(env.get("ATRIA_TEST_DEVELOPMENT_SEED"), "true" if mode == "development" else None)
            self.assertEqual(env["ATRIA_AUDIT_RUN_ID"], "123456abcdef")
            self.assertEqual(env["ATRIA_AUDIT_SUITE_INDEX"], "2")
            self.assertEqual(env["ATRIA_AUDIT_SUITE_TOKEN"], "123456abcdef:2")
            self.assertEqual(env["KEEP_SETTING"], "keep")
            self.assertEqual(env["ATRIA_TEST_EMPTY_DATABASE_URL" if mode == "empty" else "ATRIA_TEST_DATABASE_URL"], clone)
            self.assertNotIn("ATRIA_TEST_DATABASE_URL" if mode == "empty" else "ATRIA_TEST_EMPTY_DATABASE_URL", env)
        self.assertEqual(parent["DATABASE_URL"], "postgresql://live/dev")

    def test_arbitrary_database_names_or_unknown_modes_are_rejected(self) -> None:
        target = urlparse("postgresql://tester:secret@127.0.0.1:54321/atria_audit_seed")
        for name, mode in [("development", "seeded"), ("atria_audit_baseline", "seeded"), ("atria_audit_123456abcdef_2", "unknown")]:
            with self.assertRaises(ValueError):
                module.suite_environment({}, target, name, mode)


class CoverageGateTests(unittest.TestCase):
    def test_skip_or_missing_run_cannot_be_a_success_even_with_zero_process_exit(self) -> None:
        self.assertTrue(module.coverage_complete(0, {"pass": 5, "fail": 0, "skip": 0}))
        for code, counts in [(1, {"pass": 5}), (0, {"pass": 5, "skip": 1}),
                             (0, {"skip": 5}), (0, {}), (0, {"pass": 5, "fail": 1})]:
            self.assertFalse(module.coverage_complete(code, counts))


if __name__ == "__main__":
    unittest.main()
