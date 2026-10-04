# Dependency advisory classification

Run from the repository root:

```sh
bun scripts/security/classify-dependencies.ts --output output/security-classification.json --fail-on-production high
bun scripts/security/classify-dependencies.ts --audit output/security-audit.json --format markdown --output output/security-classification.md
```

Without `--audit`, the script runs a fresh `bun audit --json`. Audit findings may make that subprocess exit 1; this is expected. The script never installs packages or edits manifests/locks. An input audit snapshot is re-matched against current locked versions; stale advisories are listed separately. JSON output includes hashes for both inputs. Review unresolved edges before treating a result as complete.

The script reads Bun's JSONC lock with TypeScript's parser and validates its shape. It follows each workspace's production/development roots independently; crossing a workspace follows only its production dependencies. It distinguishes required/optional peers and mobile profiles. The web `@atria/api` edge is a declaration-only boundary by this repository's architecture, not web backend runtime. Optional dependencies are conservatively included; platform and final bundle analysis remain separate.

Reachability is package-level evidence. It does not prove that untrusted application input reaches an advisory's vulnerable function. ExcelJS, for example, is a production export dependency; its UUID use must be checked against the advisory's specific APIs rather than classifying the entire installed package as exploitable.

Run regression tests with the API's safe test preload:

```sh
cd apps/api
bun test ../../scripts/security/classify-dependencies.test.ts
```

`--fail-on-production high` gates high/critical direct web/API dependency findings; `any` gates every such finding. The moderate UUID advisory remains visible even though the reviewed ExcelJS call sites do not meet its prerequisites. Unresolved graph edges exit 2. This is not a final-bundle or exploitability scanner.
