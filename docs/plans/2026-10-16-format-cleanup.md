# Existing formatting findings cleanup

Normalize the files currently reported by the repository's Prettier configuration so `bun run format:check` passes. Preserve all existing work and configuration; do not reset files, suppress findings, run migrations or change application behavior.

Capture the current offender list and byte-for-byte before snapshots outside the repository, run Prettier only on those paths, and compare before/after structure. JSON values must remain identical. TypeScript/JavaScript changes must be limited to formatter normalization, including the configured Tailwind class ordering. Verify the global format check, then run relevant lint/type/test checks for source-inspection regressions. Record generated-file findings separately from source files.

Status: completed. The fresh inventory matched the prior 83 paths, and the global `bun run format:check` now passes.

## Verification

- Prettier normalized exactly the 83 reported files using existing configuration and ignore rules. No findings were suppressed and no existing work was reset.
- Private before snapshots and verification records are under `/tmp/atria-format-clean-2026-10-16/`. Every final change matches the configured formatter output; all 24 JSON files preserve their parsed values, including Drizzle metadata, generated outputs and local settings.
- One TypeScript fixture, `private-attachments-case.ts`, needed a second formatter pass. The first output was reproducibly non-idempotent; the second and third outputs matched. Only the stable formatter result was retained, and its existing business/policy tests were rerun successfully.
- Existing affected test files passed: API 10, web 71, mobile 44 and core 51 (176 passed, zero failures; 15 live-integration cases skipped by their existing configuration). No migrations, seed/reset or development database mutations were run.
- Workspace lint passed with the existing `accept` effect-dependency warning in `material-master-proposal-card.tsx:171`. Graft refreshed successfully. A build was unnecessary for formatter-only changes verified against exact Prettier output.
- Final global format log: `/tmp/atria-format-clean-2026-10-16/format-check-final.log`. It reports “All matched files use Prettier code style!” with exit code zero.
