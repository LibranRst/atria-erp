# Atria Main Surface Design Language

Status: **active source of truth** for new pages and substantial UI rework.

This document defines the visual and interaction grammar established by the current Dashboard (`/ledger`) and Expenses (`/expenses`). These pages are reference implementations, not layout templates. New work must reuse their hierarchy, density, surface treatment, financial formatting, interaction behavior, and state quality while choosing a content pattern appropriate to the workflow.

Read this document together with:

- `.agents/skills/atria-ui-ux/SKILL.md` as the mandatory UI/UX workflow and verification entrypoint.
- `docs/05-ui-ux/CONTROL_LANGUAGE.md` for buttons, sheet actions, badges, and color-token policy.
- `docs/05-ui-ux/IOS26_SOLID_DESIGN_SYSTEM.md` for controls, sheets, and motion.
- `docs/05-ui-ux/MOBILE_FIRST_UI_UX.md` for role and workflow priorities.
- `AGENTS.md` for finance, material, RBAC, and implementation safety.

## Product Character

Atria should feel like a focused financial and operational application made for frequent mobile use:

- calm, premium, and native-feeling;
- compact without becoming cramped;
- information-dense through hierarchy, not small type;
- actionable without showing buttons everywhere;
- visually alive through material, depth, and state—not decoration;
- specific to project finance and material control, not a generic SaaS dashboard.

“iOS-inspired” means clear grouping, confident typography, soft depth, responsive controls, and disciplined motion. It does not mean glass on every surface, oversized controls, or decorative gradients.

## Reference Implementations

Before changing a main surface, inspect the current implementation instead of relying on screenshots or old plans:

- Dashboard composition and states: `features/finance-dashboard/components/`
- Dashboard primitives: `features/finance-dashboard/components/dashboard-primitives.tsx`
- Dashboard tabs: inspect Ringkasan, Persetujuan, Budget, Jatuh Tempo, Rekening, and Material in the current `features/finance-dashboard/components/` implementation.
- Expenses composition and states: `features/expenses/components/`
- Expenses primitives: `features/expenses/components/expenses-primitives.tsx`
- Approved form references: `features/expenses/components/expense-form.tsx`, `features/expenses/components/vendor-bill-form.tsx`, and `features/projects/list/components/project-drawer.tsx`
- Shared tabs: `components/ui/segmented-tabs.tsx`
- Shared financial values and page primitives: `components/ui/page-primitives.tsx`
- Route skeletons: `app/ledger/loading.tsx` and `app/expenses/loading.tsx`

Reuse shared primitives when their semantics fit. Do not duplicate their class strings into a new domain just to make it look similar.

Global main-surface primitives live under `components/ui/feedback/`. Use `SummarySurface`,
`GroupedSurface`, `SectionHeader`, `DetailSection`, `RowGroup`, `SummaryFact`, and
`InlineStateRow` directly when their semantic contract fits. Do not create feature-prefixed copies
of these primitives; feature-owned components should compose them with domain data and actions.

## Configuration Workspaces

Settings-style workspaces keep the application identity stable while the configuration domain changes:

- keep one fixed page title and place the active module title inside its content;
- use sticky peer navigation when several configuration modules share one workspace;
- summarize defaults as a relationship or posture, not a generic KPI grid;
- show related master data as grouped rows with detail/edit actions in a sheet;
- expose save actions only when values have changed, while preserving explicit confirmation for high-impact defaults;
- keep search and structured filters mutually exclusive when combining them would obscure which dataset is being searched;
- distinguish operational data from editable defaults, especially for inventory and finance settings.

The Settings workspace is the reference for this pattern after its current rework. It must not become a second operational Material, Project, or Expenses surface.

## Account and Profile Surfaces

Profile-style surfaces describe identity and access without imitating a metrics dashboard:

- use one calm identity surface for avatar, name, email, role, and account status;
- summarize access as available application modules, not raw permission totals or generic KPI tiles;
- show repeated account facts and module access as grouped rows with dividers;
- place detailed permission descriptions in a bottom sheet so the main page remains scannable;
- keep unsupported account editing, password, and device/session actions out of the interface;
- separate sign-out as a destructive account action and require explicit confirmation;
- do not expose deferred modules, routes, or permissions as active product capabilities.

## Mobile Shell and Density

- The fixed `max-w-md` application shell remains the source of truth at every viewport.
- Design and verify at 320, 360, 390, and 430 px. A desktop browser preview is not sufficient evidence.
- Keep the global top bar, bottom navigation, FAB, safe areas, and bottom clearance intact.
- Main content remains one column. Do not introduce an internal desktop grid using `sm`, `md`, or `xl` breakpoints inside the shell.
- Prefer a page rhythm around 20 px between major sections and 8–12 px within a section. Increase space only to express a real hierarchy change.
- Use compact type and padding on narrow screens. Compact does not permit clipped labels, wrapped primary money values, or touch targets below 48 px.

## Information Hierarchy

Every main page should answer, in order:

1. What is the current position or workload?
2. What needs attention?
3. What can the user do next?
4. Where is the supporting detail?

Use one focal summary when the page has a genuinely dominant state. Follow it with section headers and grouped content. Do not give every metric, status, and action equal visual weight.

The type hierarchy is expressed as semantic tokens in `@theme`. Each token names the role and
carries its own line-height, so a call site never picks a size and a leading separately:

| Token           | Size / leading | Use                                                     |
| --------------- | -------------- | ------------------------------------------------------- |
| `text-focal`    | 28 / 32 px     | The one justified focal financial value on a surface    |
| `text-title`    | 17 / 24 px     | Page or major section title                             |
| `text-section`  | 15 / 20 px     | Section title                                           |
| `text-row`      | 13 / 16 px     | Row title or primary row value                          |
| `text-support`  | 11 / 16 px     | Supporting context                                      |
| `text-meta`     | 10 / 16 px     | Dense metadata and inset metric cell labels             |
| `text-eyebrow`  | 9 / 12 px      | Eyebrow and uppercase metadata, with restrained tracking |

Use the token whose role matches. Do not pick one because its pixel value happens to be close: an
arbitrary `text-[Npx]` remains correct for a size that carries no role in this table, and a
narrow-screen override such as `max-[430px]:text-[15px]` is still the way to shrink a role.

Icon sizes use the separate `icon-xs` through `icon-2xl` utilities. `AppIcon` renders a `1em` SVG,
so its size follows `font-size`; without a distinct utility an icon size is indistinguishable from a
type size at the call site.

Monospace financial values resolve through `--font-mono`, which is mapped to JetBrains Mono. Use
`font-mono` with `tabular-nums`; do not reintroduce role-named font-family aliases.

## Surface System

Use surfaces according to information ownership:

- **Focal surface:** one strong summary or independent decision unit. A dark financial surface is allowed when it creates a clear anchor.
- **Grouped surface:** one soft white or translucent container holding related rows separated by subtle dividers.
- **Inset metric grid:** two or three compact neutral metric cells owned by a focal, grouped, or decision surface. It decomposes a comparison without creating a second layer of standalone cards.
- **Decision item:** one independently actionable entity card or row that may contain identity, supporting context, an inset metric grid, and one comparison or status treatment.
- **Identity surface:** a branded or user-configured entity such as a bank account. Existing account gradients belong here and must remain visible.
- **Inline section:** simple supporting content that needs hierarchy and whitespace but no container.
- **Tinted state surface:** reserved for a meaningful warning, critical state, selection, or comparison.

Choose the owner before styling its contents. Simple repeated events, transactions, master data, and title/meta/value rows normally share one grouped surface with dividers. A decision-heavy entity may own an individual card when the whole item is actionable or its internal comparisons are necessary to judge it.

An inset metric cell is not an independent card. Keep it compact and neutral, use spacing rather than hard dividers between cells, and do not give each cell its own shadow or elevation. Put semantic tone on the value, icon, or explicit status by default; tint the cell only when the whole cell represents a meaningful warning, critical state, selection, or comparison.

Use the semantic ring and shadow roles from `CONTROL_LANGUAGE.md` instead of local recipes. Large
radii belong to owning focal, grouped, decision, and identity surfaces. Nested metric cells use a
quieter radius and surface contrast so the owner remains visually dominant; they never receive
independent elevation.

The main canvas and low containers use the cool iOS system-gray foundation. Owning grouped surfaces
remain white. Never warm a neutral surface with cream, beige, brown, red, or yellow undertones, and
never select a palette utility merely because it appears visually close to a surface token.

Gradients are reserved for meaningful identity or established focal surfaces, such as bank account colors. Do not spread gradients across generic summaries or status cards.

Functional edge scrims are the narrow exception: fixed bottom-sheet chrome may use a token-based
surface-to-transparent fade so scrolling content passes beneath readable controls without a hard
cutoff. Keep the fade attached to the overlay edge, preserve an opaque-enough area beneath text and
actions, and do not reuse it as decorative page or card styling.

### Inset metric grid

Use an inset metric grid when:

- two or three values must be scanned together to understand position, composition, or risk;
- the values support one focal summary or one identifiable decision item;
- labels can remain short and each primary value stays on one line at 320 px;
- the grid reduces scanning effort compared with a sentence or stacked label/value list.

Common examples are available cash decomposed into receivables, payables, and near-term exposure; actual versus internal budget; consumed versus remaining budget; or compact approval workload facts.

Do not use an inset metric grid for a single title/meta/value row, activity or transaction history, long narrative values, unrelated KPIs, or decoration. Keep grids to two or three cells in one row. If four or more facts are essential, establish hierarchy by promoting one value, grouping secondary facts, or moving detail into a sheet instead of shrinking the typography.

The owning focal or decision surface remains the interaction target. Inset cells are non-interactive unless each cell genuinely leads to a different destination and has its own accessible 48px target.

## Section and Row Grammar

A standard section consists of:

- a concise title;
- an optional compact light-blue capsule action with a chevron;
- an optional compact neutral count pill for a cardinal workload count;
- one grouped surface, timeline, or purpose-built comparison;
- a functional empty/error state in the same visual footprint.

Small section actions may appear visually 32–40 px tall, but their effective touch target must remain at least 48 px. Use direct labels such as `Lihat semua`, `Tinjau`, or `Buka project`.

Use the shared compact section count pill when the trailing value answers “how many items are
in this section?” The outer pill names the item type and the inner count badge carries the number.
Keep status, dates, periods, ratios such as `3 dari 8`, and descriptive context as plain metadata.
Do not show a count pill beside a section action when both compete for the same trailing slot.

A standard grouped row should expose only what is needed to scan and decide:

- optional semantic icon tile;
- title and one short context line;
- primary value or status aligned consistently;
- chevron or contextual action only when the entire row is interactive.

Use an icon tile around 36 px with a compact radius for repeated rows. Use soft horizontal dividers between related rows, not a border around every row.

A decision item may use a different internal grammar when a plain row would hide the comparison:

- keep entity identity and status readable before the numbers;
- place two or three comparable facts in a compact neutral inset metric grid;
- use at most one full-width comparison, indicator, or consequence below it;
- keep the whole item visually and interactively owned by one card or row.

Do not retrofit this grammar onto activity, history, recent-transaction, or simple master-data rows. Those remain grouped operational rows unless the workflow introduces a real independent decision.

Do not use colored vertical severity rails beside ordinary list items. A vertical line is valid only when it represents an actual timeline relationship; timeline connectors must visually continue between items and replace horizontal row dividers.

### Activity and history rows

- Every visible row that represents one identifiable event in an activity, history, recent-transaction, or timeline section must open a contextual detail surface.
- The full row is the primary 48px touch target and carries a chevron, keyboard focus, and an explicit screen-reader label. Nested actions remain separate and must not trigger the row.
- Activity detail is re-read from the canonical server record when opened. It explains identity, actor/time, facts, supported before/after evidence, business impact, and notes without exposing raw audit JSON.
- Missing historical evidence is disclosed plainly; never estimate a before-state or decision reason.
- Aggregate summaries and master-data rows are not activity events and must not imitate the interactive event-row affordance.

## Tabs and Filters

- Page-level sticky tabs, filters, and search controls are temporarily disabled through `WORKSPACE_STICKY_CONTROLS_ENABLED`. Keep them in normal document flow while the flag is off; the global shell and transactional save docks are unaffected.
- Use the shared `SegmentedTabs` for peer views or filters when it matches the information architecture.
- Keep labels short, the active state strong, and badges limited to actionable problems.
- Horizontal overflow may scroll and auto-center the active item. It must never scroll the document vertically.
- Short scrollable filter sets may fill the available strip when their intrinsic labels fit. Preserve each tab's intrinsic minimum width so the same control falls back to horizontal scrolling when space is insufficient; do not hardcode viewport breakpoints for this behavior.
- Preserve URL query state when a tab needs to be shareable or restorable.
- Keep the active-tab pill spring. Replace tab or filter content instantly; do not fade, slide, animate, or remount the whole content area merely because the selection changed.
- Filter changes must preserve a stable reading position. Avoid collapsing result containers in ways that cause the page to jump upward.

## Financial Values and Comparisons

- Use tabular numerals and the shared `MoneyValue` variants.
- Keep the primary monetary value on one line at 320–430 px.
- Use a compact primary value with an exact secondary value when the full amount is long.
- Put labels close to their values and make the cash-flow direction explicit.
- A comparison must answer a real question: budget versus actual, target versus projection, available cash versus near obligations, or required versus available material.
- Geometry may clamp at 0–100%, but the actual number must remain visible.
- Never relabel derived warning or critical data as healthy just because an upstream status is stale.

## Status and Color

The shared status vocabulary is Healthy, Warning, Critical, Pending, Completed, Neutral, and Inactive. Translate it into concise Indonesian copy in the interface.

- Combine color with a label, icon, shape, or position.
- Use red and amber sparingly for conditions that change priority.
- Keep success and reconciliation language calm.
- Do not create a rainbow of category colors or place a status pill on every neutral row.
- Status copy must describe the condition or impact, not market the product.
- Use `StatusBadge` for a meaningful state only. Keep 24px status pills, reserve their dot for pending/warning/critical, and use `CountBadge` or filter primitives instead of overloading status badges.
- Use tokenized `accent` for focus, selection, and tertiary navigation. Do not add raw blue, red, amber, or green palette utilities to UI source.

## Progress and Data Visualization

Do not put the same progress bar under every metric. Choose an indicator based on the question:

- split indicator for used versus remaining budget;
- threshold rail when 80% and 100% boundaries matter;
- block meter for discrete category health;
- before/after values for approval impact;
- timeline for due dates;
- plain values and labels when a visual would add no information.

Do not add a chart unless trend, distribution, or time-series comparison materially improves a decision. Decorative charts, gradients, stripes, and animated fills are prohibited.

## Actions, Forms, and Sheets

- Each surface should have at most one obvious primary action.
- Use the shared Button hierarchy: black primary commits, white secondary actions, accent tertiary navigation, and critical variants only for risk/destructive flows. Do not introduce local button class recipes.
- Sheets keep a single primary commit full-width in the footer. When a safe secondary action is needed, it sits beside the primary in equal columns; headers are for close/navigation, not submit.
- Keep secondary actions compact and move additional safe actions into a menu or bottom sheet.
- Primary controls and normal buttons have a minimum 48 px touch target.
- Standalone inputs and selectors use a white `min-h-12` capsule. Inside `FormSection`, controls become borderless rows on one white grouped surface with visible labels and subtle dividers.
- Text, money, and notes use stacked label/value rows. Toggles and short choices may use an explicit inline label/control layout; do not infer layout from label length.
- Helper and validation copy belongs inside the relevant row. Use a restrained error tint and text instead of a separate error card.
- Bottom sheets use a `surface-container-low` canvas, white grouped content, `rounded-t-[28px]`, a pull indicator, keyboard-safe spacing, and the shared overlay hierarchy. Their fixed header and footer use functional edge scrims over one scroll plane rather than hard opaque cutoffs.
- Selection and date sheets retain their nested behavior. Present options as grouped rows and reserve blue for focus or selection while primary submit actions remain Atria black.
- Destructive actions are visually separated and require confirmation or a reason when the business flow demands it.
- Never add an inline mutation merely to make a dashboard or summary feel interactive.

## Loading and Runtime States

Every main route must ship with a structural loading state. Skeletons must mirror the final page hierarchy:

- page header and tabs;
- focal summary when present;
- the expected grouped rows, timeline, or account cards;
- bottom navigation clearance.

Do not use a large centered spinner or a generic loading card for a core page. Avoid animated decoration; loading feedback should be calm and should not cause a large layout shift when data appears.

Design and implement fresh, refreshing, empty, no result, error, offline, partial, stale, restricted, pending, success, and failed-action states where the workflow can produce them. Preserve the last valid data for stale, offline, or partial states when safe.

Empty states should explain whether the empty condition is good and what can be done next. Keep them compact and avoid illustrations that overpower the page.

## Motion

- Use motion only to communicate selection, origin, continuity, state, or feedback.
- Allow existing drawer/sheet and backdrop transitions, restrained modal entry/exit, meaningful local morphs, disclosures, tap feedback, success feedback, progress changes, and the active segmented-tab pill.
- Keep routes, pages, tab/filter content, ordinary sections, and lists instant and stable. Do not add page transitions, whole-section entrances, or list staggers.
- Use Framer Motion tokens from `lib/utils/motion.ts`; do not add ad-hoc springs or raw CSS keyframes.
- Respect reduced motion and avoid motion that shifts the reading position.
- Record the motion decision in every UI plan and handoff, including when the decision is `no animation`.
- Refresh and syncing icons do not need to spin continuously.

## Copy

- Use concise, natural Bahasa Indonesia.
- Prefer a specific condition or action: `Perlu disetujui`, `Budget berisiko`, `Tinjau tagihan`.
- Never render enum, `snake_case`, or internal reference codes directly to users. Keep canonical values in the database/API and translate them at the presentation boundary with `formatBusinessLabel`; raw codes are only appropriate inside an explicitly developer-only technical disclosure.
- Avoid vague labels, marketing language, title case on every word, and English product jargon when a clear Indonesian term exists.
- Supporting text should add consequence or context, not restate the title.

## Anti-Patterns

Do not ship:

- a generic formula of summary card, header pill, and identical rounded cards for every section;
- oversized text, padding, tabs, or buttons that only look balanced in a desktop preview;
- an elevated standalone card around every metric or simple row;
- tonal or rainbow backgrounds across ordinary inset metric cells;
- more than three equal-weight metric cells in one mobile row;
- nested metric cells that compete with their owning focal or decision surface through shadow, elevation, or oversized radius;
- an entirely unframed operational list when independent items need established card affordance;
- identical progress lines across unrelated contexts;
- colored vertical rails on ordinary list items;
- decorative gradients, glass, blur, shadows, icons, or charts;
- wrapped primary money values;
- hidden actions or ambiguous icon-only controls;
- loading states unrelated to the final layout;
- content transitions that move the user’s reading position;
- UI generated from placeholder or dummy data when real domain data exists.

## Implementation and Review Gate

Before implementation:

- inspect Dashboard and Expenses in code and at 320–430 px;
- identify the focal information, grouped data, primary action, and exceptional states;
- decide whether repeated content is a grouped operational row, a decision item, or an inset metric grid; do not mix these patterns by visual preference alone;
- decide which existing primitive can be reused and which domain-specific pattern is needed;
- verify that the proposed pattern preserves business logic, permission, and navigation.

Before handoff:

- verify 320, 360, 390, and 430 px plus the fixed-width large-screen shell;
- check primary values and every 2–3-cell inset metric grid for wrapping and horizontal overflow;
- check that canvas, grouped surfaces, rings, and shadows use their semantic token roles with no
  warm neutral or competing nested elevation;
- verify focus order, screen-reader labels, 48 px effective touch targets, and reduced motion;
- test loading-to-content layout stability and empty/error states;
- verify tab/filter changes do not scroll the page unexpectedly;
- check bottom navigation and safe-area clearance;
- check the browser console, TypeScript, ESLint, relevant tests, and production build.

When a new reusable visual rule is introduced, update this document and its corresponding primitive or test in the same change. Historical implementation plans remain historical and must not override this active guide.
