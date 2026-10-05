# Workspace Desktop Atria

Implemented 1 October 2026. `/admin` is part of the existing web app, with the same Better Auth session, database and finance/material actions.

## Entry and permissions

- Desktop is selected on browser entry/login at widths >=1024px. Resize only changes layout; it never changes the route or discards draft input.
- The profile offers **Buka desktop admin**; the desktop header offers **Tampilan ringkas**. The explicit choice is remembered per user/browser.
- `NEXT_PUBLIC_DESKTOP_ADMIN_AUTO=false` disables the automatic default while retaining manual entry. It is a build-time public setting; rebuild/restart after changing it.
- `use:desktop_admin` grants workspace entry only. Owner/Finance have the initial grant. Owner can grant/revoke it for custom roles in Settings -> Organisasi -> Peran & Akses. Module permissions and `ASSIGNED`/`GLOBAL`/`NONE` scope stay authoritative.
- Expo browser fallback carries `surface=mobile`. Login and mapped navigation preserve the marker; an admin URL carrying it redirects to its canonical mobile equivalent.

## Workflow parity

| Desktop destination     | Existing workflows retained                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard               | Budget/category/margin overview, approvals, due cash, accounts/transfers, material risks, activity details                                                                                                       |
| Proyek / project detail | Creation/editing, budget setup/approval, RAP draft/lock, Material/Tukang/Subcon packages, RAB/revisions/change orders/export, stock, expenses/bills, invoices/client payments, profitability, activation/closing |
| Pengeluaran             | Field expense drafts/OCR/items, verification/payment, vendor bills/payments, receipts, history                                                                                                                   |
| Persetujuan             | Existing approval decisions and impact review, including change orders and stock exceptions                                                                                                                      |
| Material                | Inventory/shortages/activity, locations, receipt/reservation/use/return/waste, transfer, counts, adjustment/reversal                                                                                             |
| Rekonsiliasi            | Statement import, bank/cash queues, matching/proposals and immutable history                                                                                                                                     |
| Pengaturan              | Readiness/initial stock, budget defaults/categories/thresholds, master material/library/import/pricing templates, users/vendors/roles                                                                            |
| Ancillary               | Onboarding/review, notifications/deep links, profile/session management and existing AI assistant                                                                                                                |

Desktop list/detail panels reuse existing handlers and outer overlays. Tables scroll within their owning surface when necessary. The header's permission-scoped **Tambah**, **Pergerakan stok** and **Kontrol stok** menus open the existing global workflows. Large RAP/RAB/Settings workspaces occupy the available page width; the library template editor is inline on desktop.

Presentation is explicit at the admin layout boundary as well as the client shell, so independently streamed/prefetched route content hydrates consistently. Consumer links/router hooks use the shared navigation adapters. Mutation cache invalidation expands known routes to their desktop equivalents; public/auth/API routes remain outside that mapping.

## Shared UI and HeroUI tooling

HeroUI React/styles are pinned to **3.2.6**. Shared public adapters are `DesktopTable`, `DesktopButton`, `DesktopInput`, `DesktopSelect`, and `DesktopUIProvider`. Money, business/status labels, icons, tabs, form association, outer sheets/dialogs, focus/dismissal, motion and overlay layers remain shared Atria primitives.

Selective component CSS is compiled, CSS nesting is resolved, and selectors are AST scoped to the desktop subtree/portal root. The canonical layer order prevents preflight from overriding component styles. Capsule radii remain finite 9999px; no second root theme/reset is imported.

```sh
bun run heroui:styles
bun run heroui:styles:check
```

The official project skill is `.agents/skills/heroui-react/SKILL.md`. MCP is configured in `.codex/config.toml` with the pinned stdio server `@heroui/react-mcp@1.1.2`. Node 22+ is required. Initialize/list-components/get-component-docs smoke checks succeeded. Reload Codex for the configured server to enter an already-running chat's tool inventory; the skill is discoverable on the next turn. Atria/Impeccable rules remain the visual and domain authority.

## Migration and verification evidence

Migration `0042_grant_desktop_admin` grants only the two system roles, once. Existing grants/scopes are preserved and later revocation is never reversed by startup.

The configured development database had three historical tracking differences and pending `0041`. A separate expiring Neon clone was used first. Narrow baseline adoption proved `0033`'s additional role INSERT was a no-op, `0039` differed only by the final newline, and all `0035` live schema/default/FK/index/removal postconditions matched. Only those three tracking hashes were adopted; private before/after metadata backups were saved under `/tmp`. Then reviewed additive `0041` and `0042` were applied. The original now matches 43 migration entries. No finance/stock data was mutated or reset.

Guarded tooling lives under `apps/api/scripts`: `adopt-desktop-admin-migration-baseline.ts`, `apply-desktop-admin-migration.ts`, and `prepare-desktop-admin-preview.ts`. They default to dry-run or require explicit isolated target/host flags; there is no generic force option. Do not use the historical baseline tool as a general migration repair shortcut.

Verified:

- Full workspace tests: 1,399 pass (297 core, 18 mobile, 1,084 web), zero failures; 151 separate-DB cases skipped by default. Web/mobile/core TypeScript, lint, production build, scoped-style drift and token checks pass. A pre-existing core approval fixture was given its required `consumesBudgetActual` field to restore standalone core typechecking.
- Eleven real read-only loader/scope/invariant cases on both the clone and development database. Actual PM assignment success and unassigned-project denial were checked. Six finance/material invariants checked 53 rows with zero violations.
- Desktop 1024/1280/1440px: no steady-state page overflow; project draft input and route survive resize. Expense selection/detail and shared dropdown-in-sheet Escape/focus behavior work.
- Mobile 320/360/390/430px after visiting desktop: fixed one-column shell, no page overflow, original canvas/ink tokens unchanged. Native presentation marker remains mobile.
- Existing richer seeded mutation walkthroughs are skipped by the default test command when their separate test database is not configured. Existing mutation handlers were retained; QA did not disburse money or modify stock.
- Repository-wide formatting check has pre-existing failures outside this implementation; implementation files are formatted and generated HeroUI CSS is checked by its generator rather than Prettier.

The QA clone `codex-desktop-admin-2026-10-01` expires automatically on **2 October 2026 at 11:30 WIB**. Its QA account and temporary credentials are isolated from the original database. No production deployment was performed.

## Refinement: HeroUI-first desktop controls

Desktop now uses the native HeroUI compound Table (primary variant, single selection for detail panels and sortable columns when a sort value is supplied), Tabs, Avatar, Dropdown, Button/Link, Input, TextArea, Switch and standard anchored Select. They remain behind the public shared UI contract. Custom money formatting, business/status labels, icons, managed form dismissal and rich search/create selectors retain their domain-specific contracts.

Peer/filter tabs use an intrinsic-width desktop track bounded by the parent; the mobile SegmentedTabs backend is unchanged. Dashboard tab updates preserve the active workspace URL, other filters and hash. The generic history helper also maps canonical URLs to the current desktop/native surface, preventing future history-based controls from accidentally leaving `/admin`.

The topbar AI link uses one inline icon/label row. HeroUI Avatar owns image/fallback behavior while the render size gives a fixed square box. Hover/selection/column separators are provided by native Table styles rather than overridden cell backgrounds. Desktop controls use the same Atria tokens and scoped stylesheet; no global HeroUI reset is introduced.

Refinement verification: 1,406 workspace tests pass (297 core, 18 mobile, 1,091 web), zero failures, with the same 151 separate-database cases skipped. TypeScript, lint/token checks, production build, scoped-style drift and `git diff --check` pass. Browser checks confirmed that Dashboard tabs stay under `/admin`, the topbar controls render correctly, project table sorting changes row order, and the native action menu restores trigger focus on Escape with one button/focus stop. No finance or stock mutations were performed.
