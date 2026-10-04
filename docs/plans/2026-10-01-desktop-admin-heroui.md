# Atria Desktop Admin dengan HeroUI

Status: implemented. Approved scope: full existing admin workflow parity. Verification and operational notes: `docs/guide/desktop-admin-heroui.md`.

## Architecture and access

- Add `/admin` inside `apps/web`, sharing auth, database, loaders, actions and domain rules.
- Separate desktop/mobile shells; share workflow providers and global drawers.
- Add `use:desktop_admin` to the permission catalog and system Owner/Finance defaults; additive idempotent data migration for existing instances.
- Preserve per-action permissions and assigned project scope. Custom roles can receive desktop access without additional domain rights.
- Browser-only desktop default at >=1024px on entry/login, after password/onboarding gates. Persist manual preference per user/browser. Resize does not navigate. Native web fallback remains mobile.
- Centralize surface-aware URLs and invalidation, preserving IDs, queries, hashes and mobile links.

## UI and parity

- HeroUI v3 themed with Atria tokens; shared UI owns controls, tables, focus, money and overlays.
- Sidebar and contextual desktop workspaces; lists/detail side by side at >=1280px, sequential below it. Large editors use full pages.
- Preserve finance dashboard, project budgets/RAP/RAB/packages/change orders/payments/closing, expenses/OCR/vendor bills, approvals, accounts/transfers, material/inventory, reconciliation, Settings/library/users/roles, onboarding and ancillary profile/notification/AI workflows.
- Do not introduce bulk finance actions or AI CFO. Keep all finance/material transaction and audit invariants.
- Compile selective HeroUI styles scoped to desktop and its portal root; no global default theme/reset. Reuse shared outer overlays and motion presets.
- Every route has structural loading, error and empty states. Shared mutation invalidation covers both surfaces; no refresh that discards dirty forms.

## Tooling and documentation

- Pin HeroUI React/styles 3.2.6 in web; project MCP `@heroui/react-mcp@1.1.2` and official `.agents/skills/heroui-react` skill.
- Update AGENTS, PRODUCT, DESIGN, Impeccable contract, tooling guide and parity evidence.
- Preserve pre-existing working-tree changes; no database resets or destructive migrations.

## Acceptance

- Permission grant/revoke, custom scoped roles, restricted landing, login/onboarding/preferences/deep links/native fallback/draft resize.
- Domain mutation invariants, immutable reconciliation, client-safe RAB, fresh results on both surfaces.
- Desktop 1024/1280/1440 and mobile 320/360/390/430, keyboard/focus/nested overlays/reduced motion/CSS isolation.
- TypeScript, root test/lint/format/build/token checks; distinguish pre-existing failures.
- Enable automatic desktop only after parity acceptance; maintain a checked workflow matrix in the handoff.
