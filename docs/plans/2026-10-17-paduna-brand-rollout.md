# Paduna brand handoff and rollout

## Authorized scope

The user selected Paduna as the main brand and requested a complete branding package before applying it to the applications. Current deliverables are canonical strategy/voice/visual/naming documents, final-name metadata, a brand book and quick reference, editable templates, vector/raster assets and a technical naming inventory. The approved Temu paths and ink/terracotta palette remain unchanged. The Build tagline remains a candidate.

## Product truth

Paduna Build names the existing project finance/material product. Paduna Office is separately planned. No HR/payroll/manufacturing scope or shared platform is introduced by branding.

## Deliverables

- [x] Canonical docs under `docs/brand/paduna/` and naming conventions for Build/Office.
- [x] Export brand book, quick reference, application assets and editable templates.
- [x] Verify artwork identity, geometry/alpha, document layout, asset manifest and archive integrity.
- [x] Update PRODUCT.md, DESIGN.md and the branding sidecar to the final name decision.

## Follow-on implementation, not executed here

1. Apply display names and compatible asset updates in bounded web/native batches.
2. Rename repo/workspace/packages only with all consumers, lockfile and tooling mapped.
3. Plan explicit compatibility for deep links, auth origins, env, cookies/storage and PWA identity.
4. Update owned external services/store/domain references with verified targets and test installed builds.

The detailed naming map and observed entry points live in the brand docs. Preserve the current checkout, runtime identifiers and infrastructure during this documentation-only phase.

## Web rollout authorized next

The user subsequently authorized applying Paduna Build name/visuals to `apps/web` and verifying desktop/mobile. This batch changes display identity, metadata, favicon/PWA/share assets, notifications and visible web copy. It retains package names, API/auth contracts, native application identity, service-worker registration/cache/tag namespaces, routes and tenant/company branding on RAB.

Implementation: reuse `Button`, `FormSection`, `FormField`, `TextInput`, shared shell/navigation and feedback owners. Render approved outlined SVG artwork with Next Image; no new UI primitive or control behavior. Login uses the horizontal product logo at >=240px; the 208px sidebar uses the official compact lockup at 176px. No candidate tagline in default UI.

Verification: isolated loopback synthetic API and separate Next build directory, metadata/manifest/assets, keyboard login and offline fallback, then screenshots at 320/360/390/430 and 1024/1280/1440px. Run applicable typechecks/lint/format and existing PWA, shell, and reconciliation presentation checks. Review once across the matrix, fix in one batch and confirm once. Record any unrelated baseline failures separately.

- [x] Apply assets, metadata and visible web identity.
- [x] Verify responsive layout and interactions using synthetic data.
- [x] Complete quality gates, finishing review and current rollout documentation.
