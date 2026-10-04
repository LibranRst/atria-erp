"""Check bounded, credential-free PostgreSQL failure diagnostics."""

import importlib.util
from pathlib import Path
import sys
import unittest

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


if __name__ == "__main__":
    unittest.main()
