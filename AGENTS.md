# AI Agent Development Guidelines

You are working on Paduna Build, Paduna's Project Finance & Material Control product, developed from the workflows of Dekoria, an interior design and build company. The product direction is Project Finance & Material Control, not a generic ERP. Existing `atria`/`ATRIA_*` technical names, package names, env vars and identifiers remain compatibility concerns; do not rename them automatically.

The product promise is: **Project Budget Control upgraded into a real ERP with material stock visibility.** Workbook logic is source material for ratios and team habits, but user-facing screens must not be labeled as Excel.

## Workspace Layout

This repo is a **Bun workspace monorepo**. `apps/api/` is the Hono + Bun backend; `apps/web/` is the Next.js presentation/HTTP adapter client; `apps/mobile/` is the Expo client. Pure shared calculations, DTOs and Zod schemas belong in `packages/core/`.

Backend business code, Better Auth, Drizzle, schema and operator tooling belong to `apps/api/src/backend/` (`@backend/*`). Presentation paths (`app/`, `features/`, `components/`, `lib/`) and `@/*` still refer to `apps/web/` unless an API path is explicitly specified. Web actions/loaders preserve their public signatures as typed HTTP facades; add backend behavior in the API and register an explicit compatibility operation or tRPC procedure. API clients import declaration-only contracts; backend runtime modules stay inside the API.

Run workspace scripts from the root (`bun run test`, `bun run build`, `bun run lint`). **Never run bare `bun test` from the root**: each app has its own Bun configuration and safe test preload. Use `cd apps/api && bun test <file>` for backend tests and `cd apps/web && bun test <file>` for presentation tests. Live Postgres integration suites require a disposable database through `ATRIA_TEST_DATABASE_URL`; normal tests cannot use the development database.

For API startup, transport, environment ownership, mobile-only development and deployment preparation, read `docs/guide/mobile-api-development.md` and `docs/06-technical/ARCHITECTURE.md`. The implementation matrix is `docs/plans/2026-10-01-independent-backend.md`. Earlier Expo migration plans are historical context; their backend paths predate this extraction.

## Planning and Documentation

1. Read existing schema, actions, docs, and UI before changing code.
2. Before major executable changes, write or update a plan under `docs/plans/`.
3. Keep documentation aligned with the current product direction.
4. Do not leave docs saying inventory is out of MVP scope.
5. Do not refer to a non-existent `field_request` table; the implemented field expense table is `project_cost`.
6. Do not let material/inventory screens replace the category-based project budget workflow.
7. Treat Settings as the source of truth for budget allocation defaults, expense categories, item/price library, and material master settings.
8. Consult `.agents/rules/` and `docs/ANTIGRAVITY_INDEX.md` for detailed rules, schemas, and flow definitions.

## Product Vocabulary

- Project Budget: ERP internal budget setup with project value, approved RAB value, internal budget cap, category allocations, pending review, consumed budget, paid amount, remaining budget, used percentage, and margin visibility.
- Expense Categories: canonical budget buckets are Material, Tukang, Operasional, Lain-lain, and Subcon.
- Settings: owner/admin-controlled defaults for Budget Allocation, Expense Categories, Item & Price Library, and Material Master. Code constants are seed/fallback values, not the long-term source of truth.
- Budget Category Usage: allocated amount, actual spend, remaining amount, used percentage, and risk status per category.
- RAP: internal execution/material plan and cost baseline.
- Tukang Work Package: lightweight internal labor/scope plan linked to Tukang expenses.
- Subcon Package: lightweight internal vendor/subcon scope plan linked to vendor bills or Subcon expenses.
- RAB: client-facing estimate/proposal that may be generated from selected RAP Material items, Tukang packages, Subcon packages, and manual client-safe rows, but must be client-safe.
- Material Master: structured material list with specs, category, unit, brand/code/color, and vendor context.
- Inventory: current stock, reserved stock, available stock, minimum/buffer stock, location, and cost context.
- Stock Movement: stock in, stock out, reserve, use, return, transfer, adjustment, and waste.

## Preserve Useful Work

Do not blindly delete or rewrite existing auth, RBAC, project scoping, ledger, bank mutation helper, project budget, expenses, vendor bills, client payments, approvals, AI OCR/briefing, mobile shell, project pages, or reusable components.

When replacing the budget model, introduce canonical tables additively and preserve compatibility with legacy `project_budget`, `project_budget_item`, and `project_cost` until reads, writes, tests, approvals, vendor bills, and dashboards have been migrated.

## Strict TypeScript

- Do not introduce `any`.
- Give function arguments and return types explicit types.
- Avoid type assertions unless interfacing with untyped third-party data.
- Use Zod for Server Action input validation.

## Drizzle and Finance Safety

- Do not execute raw SQL in application code.
- Use Drizzle query APIs and query builder.
- Balance-changing actions must run in `db.transaction`.
- Reconciled `cash_transaction` rows must not be edited or deleted.
- Every balance-changing operation must write `audit_log`.
- Money movement requires explicit user action and appropriate permission.

## Material-Control Safety

- Material control is attached to the Material budget category. It must not replace Tukang, Operasional, Lain-lain, Subcon, or project margin tracking.
- Material/RAP/stock links are allowed only for Material category expenses.
- Tukang/Subcon package links are allowed only for their matching category and project.
- Operasional and Lain-lain should stay fast and simple; do not add heavy RAP/BOQ-style planning to them by default.
- Non-material expense entry must stay fast and simple.
- Stock-changing actions must run in `db.transaction`.
- Stock-changing actions must write `stock_movement` and `audit_log`.
- Reservation does not create a cash transaction.
- Usage does not create a cash transaction by itself; cash impact belongs to expense/vendor payment flows.
- Adjustments and waste require an audit note.

## RBAC and Scoping

- Mutations must read the Better Auth session server-side.
- Do not trust client-provided user IDs.
- PMs may only access projects assigned to them.
- Owner and Finance Admin have global finance access within their permissions.
- Purchasing has material/inventory permissions but still must use explicit actions.
- Owner and Finance Admin can manage finance Settings; Purchasing can manage Material Master settings but must not change budget formula or margin defaults.

## AI Guardrails

- AI can analyze, summarize, suggest, and prefill forms.
- AI must analyze category budget usage before or alongside material shortage details.
- AI must not mutate finance/material data without explicit human approval.
- AI must not generate or execute arbitrary SQL.
- AI output for owner should be practical and written in simple Bahasa Indonesia.
- AI must not expose internal RAP cost/margin/markup/vendor notes/internal notes in client-facing RAB output.

## UI/UX Rules

- Before planning, implementing, styling, redesigning, reworking, auditing, or reviewing any UI, load the `impeccable` skill and consult `PRODUCT.md`, `DESIGN.md`, and `.impeccable/design.json` at the repo root. The `impeccable` skill is the canonical UI workflow; finance, material, and QA skills remain separate domain runbooks.
- **Shared UI first:** before creating any UI component, inspect the public `@/components/ui` inventory in `apps/web/components/ui/index.ts`, its stories/tests, and the relevant `DESIGN.md` taxonomy. Reuse first, compose or extend second, and add a new primitive only when the existing interaction contract cannot represent the behavior. Feature code must not recreate shared overlay, selection, form-control, money, motion, focus, or touch-target infrastructure. Follow `.agents/rules/05-shared-ui-first.md`, and identify the reused/extended primitive—or justify a new one—in the final handoff.
- Treat the current Dashboard (`/ledger`, all tabs) as the reference implementation. Reuse its design grammar and shared primitives; do not copy its layout blindly into another workflow.
- Mobile widths 320–430 px remain the source of truth for existing/mobile routes. Mobile and native-pinned presentation keep the fixed `max-w-md` shell in one column. Canonical authenticated routes adapt to desktop at >=1024px for every role within its domain permissions/project scope, using HeroUI v3 shared adapters, sidebar and contextual tables/detail panels. Native `surface=mobile` fallback retains the mobile composition. Verify desktop at 1024/1280/1440px and mobile at 320/360/390/430px; desktop evidence never substitutes for mobile regression evidence.
- Build hierarchy through one justified focal summary, concise section headers, grouped surfaces, purpose-built rows, inset metric grids, dividers, and whitespace. Do not turn every metric or repeated item into an elevated standalone card.
- Use compact neutral inset metric cells for 2–3 values that must be compared inside one owning surface or decision-heavy item. Keep semantic tone on the value, icon, or status rather than tinting every cell. Simple operational rows still share one soft surface with dividers; preserve standalone cards for focal or independently interactive units and configured gradients for identity surfaces such as bank accounts.
- Use shared `MoneyValue` formatting, tabular numerals, compact primary amounts, and exact secondary amounts. Primary financial values must not wrap at supported mobile widths.
- Use the shared `SegmentedTabs` for peer views and filters. Horizontal auto-centering must never move the document vertically; changing a tab or filter must preserve a stable reading position.
- Every main route needs a structural skeleton matching its final hierarchy. Do not use a generic centered spinner or unrelated loading card for core pages.
- Keep visible controls compact while preserving an effective minimum touch target of 48x48 px, keyboard focus, screen-reader labels, safe-area clearance, and reduced-motion support.
- Status must combine concise Bahasa Indonesia copy with icon/shape/position; color alone is insufficient. Do not add colored vertical severity rails to ordinary rows. Continuous vertical connectors are reserved for real timelines.
- Never render a raw enum, `snake_case`, or internal reference code directly to users; translate at the presentation boundary with `formatBusinessLabel` (raw codes belong only in an explicitly developer-only technical disclosure).
- Use only the semantic surface, ring, focus-ring, and shadow tokens defined in `app/globals.css` and `DESIGN.md`. Neutral UI uses the cool iOS system-gray family; do not add warm neutral hex values, raw gray palette utilities, arbitrary Tailwind shadows, `ring-black/*`, raw `box-shadow`, or component-local focus-ring colors.
- Use contextual budget indicators, comparisons, or timelines. Do not repeat the same progress bar across unrelated sections or add decorative charts.
- Avoid generic admin compositions, AI-looking repeated patterns, oversized mobile typography/spacing, excessive gradients/glass/blur, and animated decoration.
- Owner dashboard must be understandable within 30 seconds.
- Owner and finance must immediately see project value, budget, consumed budget, remaining budget, category usage, and margin risk before drilling into material details.
- Keep the UI calm, premium, operational, and trustworthy.

### iOS-Inspired Contextual Form Style (Paten)

We enforce a contextual iOS form style for a premium, native-app feel:

- **Standalone Inputs & Dropdowns**: Text inputs, date pickers, and selectors outside grouped forms MUST use a white fully rounded control (`rounded-full`) with a minimum height of `min-h-12` (48px) and side padding `px-5`.
- **Grouped Forms**: Controls inside `FormSection` MUST render as borderless rows on one white grouped surface. Apply the radius to the outer panel, use subtle dividers between rows, keep labels visible, and do not nest a capsule around every value.
- **Textareas**: Standalone textareas use `rounded-2xl`; grouped textareas grow inside their row without an additional rounded container.
- **Buttons**: All primary, secondary, and option cards/buttons (including toggles and selectors) must use `rounded-full` (capsule style).
- **Drawers & Sheets**: Sliding bottom drawers and bottom sheets use a `surface-container-low` canvas, white grouped content surfaces, large soft rounded top corners (`rounded-t-[28px]`), and a pull bar where applicable.

### Unified Motion & Animation Tokens

All animations MUST use Framer Motion and reference the unified animation presets in `lib/utils/motion.ts` to ensure consistency:

- **Drawers & Sheets sliding up**: Use `slideUpDrawerVariants` with `transitionSpringSmooth` (`type: "spring", stiffness: 300, damping: 32`) to achieve a natural sliding momentum.
- **Backdrops & Fades**: Use `fadeVariants` with `transitionEaseSmooth` (`type: "tween", ease: [0.32, 0.94, 0.6, 1], duration: 0.35`) for a smooth translucent fade-in/fade-out overlay.
- **Snappy Micro-interactions**: For tap active scales, hover effects, or quick popovers, use `transitionSpringSnappy` (`type: "spring", stiffness: 380, damping: 30, mass: 0.8`) e.g. with `whileTap={{ scale: 0.97 }}` or `scale: [1, 1.02]`.
- **Bouncy celebratory animations**: Use `transitionSpringBouncy` (`type: "spring", stiffness: 300, damping: 26`).
- Avoid defining custom/ad-hoc spring properties or inline CSS keyframes directly.

<!-- graft:start -->

## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->

## Desktop workspace and HeroUI

- Current direction is unified responsive `apps/web`; read `docs/plans/2026-10-06-unified-responsive-web.md`. All roles receive desktop at >=1024px on canonical URLs, with ordinary domain permissions/project scope. `surface=mobile` remains a presentation-only native fallback hint.
- Keep workflow providers, route children, draft/selection state and portal owners stable across resize. Shared controls keep their DOM/presentation while focused or inside an open overlay. Desktop fine-pointer controls use compact HeroUI sizes32–40px with Paduna identity; mobile/coarse-pointer targets remain48px. The blanket mobile geometry rules above do not force desktop controls to48px.
- Review the combined shell + Dashboard/Proyek/Budget before remaining module acceptance and final standalone removal. `apps/admin` remains transitional during this review; its default theme/session namespace does not become web authority.

- The historical `use:desktop_admin` key/grants/migrations stay for compatibility and never grant domain rights. Responsive presentation has no extra authorization gate.
- Use `@/lib/navigation/workspace-navigation` and `workspace-link` for canonical consumer navigation, and `revalidateWorkspacePath` for action cache invalidation. Presentation never prefixes URLs. Old `/admin` links canonicalize while auth/public/API paths stay outside mapping.
- HeroUI v3 official project skill: `.agents/skills/heroui-react/SKILL.md`; project MCP: `.codex/config.toml`. Impeccable and Paduna Build domain rules stay authoritative.
- HeroUI imports belong in shared `components/ui/desktop`; feature consumers use the public UI inventory. Never import Hero default global styles. Generate scoped component styles with `bun run heroui:styles`, check with `bun run heroui:styles:check`. Shared outer dialogs/sheets remain the only focus/dismissal owner.
