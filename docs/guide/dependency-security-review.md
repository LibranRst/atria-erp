# Dependency advisory review — 4 October 2026

The fresh registry audit was classified against Bun lock SHA-256 `49afbb563705c63a40503340fa4258205e7ab07abe4b9112fac9d9afe8590629` at 10:06 WIB. It contained 42 matching locked advisory instances across 12 package names. One instance belongs to a direct web/API production dependency closure; all other paths are development, mobile, declaration-contract, or required/optional peer contexts. The resolver found zero missing dependency edges.

This measures package reachability. It does not prove exploitability, final bundle contents, or deployment safety. Versions and counts can change with registry disclosures; regenerate the report after lock changes.

## Reproduce

```sh
bun scripts/security/classify-dependencies.ts --output output/security-classification.json --fail-on-production high
bun scripts/security/classify-dependencies.ts --audit output/security-audit.json --format markdown --output output/security-classification.md
cd apps/api
bun test ../../scripts/security/classify-dependencies.test.ts
```

Without `--audit`, the script obtains a fresh full `bun audit --json`. The script never installs packages or edits manifests/locks. JSON contains audit/lock hashes, exact locked versions, advisory URLs and shortest paths per context. The optional `--fail-on-production high` gate fails on high/critical dependency-closure findings; `any` also fails on the reviewed moderate UUID finding. Unresolved graph edges fail classification with exit 2. The web-to-API workspace contract is declaration-only; API dependencies are still reviewed separately under the API profile.

## Remaining web production advisory

`apps/web → exceljs@4.4.0 → uuid@8.3.2` matches [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq). The vulnerable APIs are UUID v3/v5/v6 with caller-provided output buffers. Installed ExcelJS source `lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js` imports and invokes v4 without an output buffer. The reviewed source does not meet the advisory's prerequisites. This is a documented conditional exposure assessment; the package remains reported, and this is not a blanket security exemption.

Do not force UUID 11 across ExcelJS's declared CommonJS `^8.3.0` dependency. Reassess when ExcelJS/UUID changes or when code begins using v3/v5/v6 with external buffers. Export regression coverage remains required.

## Other installed advisory contexts

| Package                  | Matching versions | Relevant context                                               |
| ------------------------ | ----------------- | -------------------------------------------------------------- |
| `@xmldom/xmldom`         | 0.8.14, 0.9.11    | Mobile/Expo tooling; optional Expo peer paths from API         |
| `braces`                 | 3.0.3             | Mobile/Metro and development glob tooling; optional peer paths |
| `decode-uri-component`   | 0.2.2             | Mobile/Expo; optional peer paths                               |
| `elliptic`               | 6.6.1             | Web Storybook/Node polyfill development closure                |
| `esbuild`                | 0.18.20           | API Drizzle tooling and optional Expo peer closure             |
| `fast-uri`               | 3.1.5             | Web development/peer tooling closure                           |
| `image-size`             | 1.2.1, 2.0.2      | Storybook and Mobile/Expo; optional peer closure               |
| `js-yaml`                | 4.3.1             | ESLint/Mobile/tooling development and peer closure             |
| `node-forge`             | 1.4.0             | Mobile/Expo; optional peer closure                             |
| `qs`                     | 6.15.3            | Web development closure                                        |
| `uuid`                   | 7.0.3             | Mobile/Expo and optional peer closure                          |
| `webpack-dev-middleware` | 6.1.3             | Web Storybook development closure                              |

These are still installed findings, not ignored vulnerabilities. They are not established as direct web/API runtime paths by the dependency graph. Keep development/Storybook servers private and apply separate, compatible tooling updates; do not treat this classification as proof that every vulnerable API is unreachable.

## Brace-expansion remediation

Same-major registry targets are **1.1.21, 2.1.7 and 5.0.12**. Version 2.1.5 only fixes one recursion advisory; later [nested-recursion](https://github.com/advisories/GHSA-qhr7-859c-m2p7) and [quadratic-expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) advisories require later patches. Registry metadata confirms the old/new dependency lists are identical for all three lines.

An isolated Bun 1.3.14 experiment showed version-scoped override keys were silently ignored. Current [Bun override documentation](https://bun.com/docs/pm/overrides) describes newer scoped rules which produce lockfile version 3; the repository's pinned runtime uses lock version 1. A minimal refresh of the relevant version/integrity tuples was accepted by frozen installation, preserved the manifest, and preserved ordinary CommonJS brace expansion behavior for versions 1 and 2. Do not replace all old CommonJS dependents with brace-expansion 5.

The refreshed lock no longer matches the brace-expansion advisories. Undici 7.29.1 and Next 16.3.6 also no longer match the earlier audit snapshot. Re-run the classifier against a fresh registry audit to keep this evidence current.
