# Atria Main Surface Design Language

Status: **active source of truth** for new pages and substantial UI rework.

This document defines the visual and interaction grammar established by the current Dashboard (`/ledger`) and Expenses (`/expenses`). These pages are reference implementations, not layout templates. New work must reuse their hierarchy, density, surface treatment, financial formatting, interaction behavior, and state quality while choosing a content pattern appropriate to the workflow.

Read this document together with:

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
- Expenses composition and states: `features/expenses/components/`
- Expenses primitives: `features/expenses/components/expenses-primitives.tsx`
- Shared tabs: `components/ui/segmented-tabs.tsx`
- Shared financial values and page primitives: `components/ui/page-primitives.tsx`
- Route skeletons: `app/ledger/loading.tsx` and `app/expenses/loading.tsx`

Reuse shared primitives when their semantics fit. Do not duplicate their class strings into a new domain just to make it look similar.

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

Recommended type hierarchy:

- Focal financial value: approximately 27–30 px, only once when justified.
- Page or major section title: approximately 15–20 px.
- Row title or primary value: approximately 13–15 px.
- Supporting context: approximately 11–13 px.
- Eyebrow and metadata: approximately 9–11 px, with restrained tracking.

These are density ranges, not new hardcoded tokens. Prefer existing component variants and semantic classes.

## Surface System

Use surfaces according to information ownership:

- **Focal surface:** one strong summary or independent decision unit. A dark financial surface is allowed when it creates a clear anchor.
- **Grouped surface:** one soft white or translucent container holding related rows separated by subtle dividers.
- **Identity surface:** a branded or user-configured entity such as a bank account. Existing account gradients belong here and must remain visible.
- **Inline section:** simple supporting content that needs hierarchy and whitespace but no container.
- **Tinted state surface:** reserved for a meaningful warning, critical state, selection, or comparison.

Repeated information should normally share one grouped surface. Do not create a separate rounded card for every row. Conversely, do not remove cards where an item is an independent interactive object or where the established product language uses a focal surface.

Use soft rings and shadows instead of hard borders. Large radii belong to focal and grouped surfaces; they should not be repeated on every nested element.

Gradients are reserved for meaningful identity or established focal surfaces, such as bank account colors. Do not spread gradients across generic summaries or status cards.

## Section and Row Grammar

A standard section consists of:

- a concise title;
- an optional compact text action with a chevron;
- one grouped surface, timeline, or purpose-built comparison;
- a functional empty/error state in the same visual footprint.

Small section actions may appear visually 32–40 px tall, but their effective touch target must remain at least 48 px. Use direct labels such as `Lihat semua`, `Tinjau`, or `Buka project`.

A standard grouped row should expose only what is needed to scan and decide:

- optional semantic icon tile;
- title and one short context line;
- primary value or status aligned consistently;
- chevron or contextual action only when the entire row is interactive.

Use an icon tile around 36 px with a compact radius for repeated rows. Use soft horizontal dividers between related rows, not a border around every row.

Do not use colored vertical severity rails beside ordinary list items. A vertical line is valid only when it represents an actual timeline relationship; timeline connectors must visually continue between items and replace horizontal row dividers.

## Tabs and Filters

- Page-level sticky tabs, filters, and search controls are temporarily disabled through `WORKSPACE_STICKY_CONTROLS_ENABLED`. Keep them in normal document flow while the flag is off; the global shell and transactional save docks are unaffected.
- Use the shared `SegmentedTabs` for peer views or filters when it matches the information architecture.
- Keep labels short, the active state strong, and badges limited to actionable problems.
- Horizontal overflow may scroll and auto-center the active item. It must never scroll the document vertically.
- Short scrollable filter sets may fill the available strip when their intrinsic labels fit. Preserve each tab's intrinsic minimum width so the same control falls back to horizontal scrolling when space is insufficient; do not hardcode viewport breakpoints for this behavior.
- Preserve URL query state when a tab needs to be shareable or restorable.
- Keep the active-tab spring. Do not animate or remount the whole content area merely because a filter or tab changed.
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
- Keep secondary actions compact and move additional safe actions into a menu or bottom sheet.
- Primary controls and normal buttons have a minimum 48 px touch target.
- Standalone inputs and selectors use a white `min-h-12` capsule. Inside `FormSection`, controls become borderless rows on one white grouped surface with visible labels and subtle dividers.
- Text, money, and notes use stacked label/value rows. Toggles and short choices may use an explicit inline label/control layout; do not infer layout from label length.
- Helper and validation copy belongs inside the relevant row. Use a restrained error tint and text instead of a separate error card.
- Bottom sheets use a `surface-container-low` canvas, white grouped content, `rounded-t-[28px]`, a pull indicator, keyboard-safe spacing, and the shared overlay hierarchy.
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

- Motion communicates selection, hierarchy, feedback, or spatial origin. It is never filler.
- Use Framer Motion and the tokens from `lib/utils/motion.ts`; never define ad-hoc springs.
- Respect reduced motion.
- Keep tab selection, sheet transitions, and micro-interactions; avoid section entrance animations and full-content tab transitions.
- Refresh and syncing icons do not need to spin continuously.

## Copy

- Use concise, natural Bahasa Indonesia.
- Prefer a specific condition or action: `Perlu disetujui`, `Budget berisiko`, `Tinjau tagihan`.
- Avoid vague labels, marketing language, title case on every word, and English product jargon when a clear Indonesian term exists.
- Supporting text should add consequence or context, not restate the title.

## Anti-Patterns

Do not ship:

- a generic formula of summary card, header pill, and identical rounded cards for every section;
- oversized text, padding, tabs, or buttons that only look balanced in a desktop preview;
- a card around every metric or row;
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
- decide which existing primitive can be reused and which domain-specific pattern is needed;
- verify that the proposed pattern preserves business logic, permission, and navigation.

Before handoff:

- verify 320, 360, 390, and 430 px plus the fixed-width large-screen shell;
- check primary values for wrapping and horizontal overflow;
- verify focus order, screen-reader labels, 48 px effective touch targets, and reduced motion;
- test loading-to-content layout stability and empty/error states;
- verify tab/filter changes do not scroll the page unexpectedly;
- check bottom navigation and safe-area clearance;
- check the browser console, TypeScript, ESLint, relevant tests, and production build.

When a new reusable visual rule is introduced, update this document and its corresponding primitive or test in the same change. Historical implementation plans remain historical and must not override this active guide.
