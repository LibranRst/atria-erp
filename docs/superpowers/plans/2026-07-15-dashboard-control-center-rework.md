# Dashboard Control Center Rework

## Goal

Rebuild `/ledger` as a calm, mobile-first finance and material control center for Owner and Finance Admin. Preserve the existing application shell, RBAC, transaction/audit behavior, project scoping, and operational drill-down routes.

## Delivery

1. Replace the Dashboard DTO and derivation helpers with role-ranked actions, Jakarta-time due buckets, richer project risk context, supporting material alerts, freshness metadata, and partial-source warnings.
2. Recompose Ringkasan, Persetujuan, Budget, Jatuh Tempo, Rekening, and Material around compact summaries, grouped rows, progressive detail, and explicit actions.
3. Remove AI CFO presentation, briefing route, menu entry, and daily briefing endpoint while preserving AI OCR and historical `ai_run` data.
4. Align Dashboard loading/error/empty/offline/stale states, active product documentation, and automated/manual QA coverage.

## Product Decisions

- Keep the global `max-w-md` shell, top bar, bottom navigation, FAB, and safe-area behavior unchanged.
- Ringkasan remains the default; `?tab=` remains the only persisted tab state.
- Approval is Owner-only. Rejection requires a written reason; approval and all bank mutations keep their current Server Actions and audit behavior.
- No charts, personalization, saved filters, account-primary flag, database migration, or new stock mutation is introduced.
- All touched interaction motion uses `lib/utils/motion.ts`; buttons and tabs have 48px minimum touch targets, and Dashboard sheets retain the shared 28px rounded treatment.

## Verification

- Unit-test outstanding calculations, Jakarta due buckets, urgency sorting, approval priority, effective project risk, role visibility, and detail limits.
- Verify Owner/Finance behavior, rejection reason handling, bank actions, AI CFO removal, and OCR preservation.
- Browser-check 320, 390, and 430px widths plus centered large-screen rendering; inspect tab overflow, financial numerals, sheets, safe-area clearance, reduced motion, focus, and console output.
- Run ESLint, TypeScript, Bun tests, and the production build.

## Mobile Device Density Follow-up (2026-07-15)

- Apply Dashboard-only compact density at viewport widths up to 430px; do not alter the global mobile shell or other pages.
- Increase effective Dashboard content width by reducing its mobile-only side inset from 20px to 16px.
- Reduce Dashboard section rhythm from 24px to 20px, summary-card padding/radius, row padding, section-header height, and mobile hero-number maximum size.
- Remove nested preview-card padding so repeated rows do not receive two layers of horizontal inset.
- Add a compact SegmentedTabs density with a 48px outer control, 40px visual pills, and preserved effective touch targets and active spring animation.
- Keep financial hierarchy, data, actions, URL tab state, permissions, safe areas, and desktop `max-w-md` presentation unchanged.

## Contextual Budget Indicators Follow-up (2026-07-15)

- Replace repeated active-Dashboard progress bars with context-specific visuals: portfolio split, project threshold rail, five-block category meter, and approval before/after comparison.
- Omit the project rail from compact Ringkasan rows where the exact percentage and remaining amount already communicate the risk.
- Clamp visual geometry to 0–100 while preserving exact values and explicit overflow labels for values above 100.
- Keep the legacy ProgressBar export for inactive compatibility components; do not change Dashboard DTOs or finance calculations.
- Verify color-independent labels, mobile overflow, Owner approval detail, and Budget/Ringkasan rendering at 320–430px.

## Account Card Color Follow-up (2026-07-15)

- Render the saved account gradient and text-tone metadata in the primary Rekening list, not only in creation preview and detail sheets.
- Preserve the compact operational row content: account identity, masked number, latest transaction, balance, and inactive state.
- Keep each account as an individually tappable rounded card without changing account mutations, permissions, or detail-sheet behavior.

## Native Editorial Sections Follow-up (2026-07-15)

- Replace the repeated white summary-card and framed-list formula across all Dashboard tabs with function-specific editorial patterns.
- Keep the dark financial position and account gradients as the only strong focal surfaces; use typography, dividers, rails, timelines, and inline comparisons elsewhere.
- Render Ringkasan as a priority stack plus risk, due-date, material, and cash-ledger previews; render full tabs as decision queue, budget ledger, financial timeline, account position, and stock posture respectively.
- Preserve all Dashboard DTOs, queries, mutations, RBAC, drill-down routes, bottom sheets, tab state, and business calculations.
- Verify the resulting layouts at 320–430px, including one-line financial values, touch targets, accessibility labels, reduced motion, loading/empty states, and absence of horizontal overflow.

## Card Language Correction (2026-07-15)

- Restore the established rounded white card surfaces for section groups and tab summaries while keeping the function-specific internal layouts.
- Remove repeated colored vertical rails from priority, approval, project-risk, material, and timeline items; status remains visible through labels, icons, dots, and typography.
- Keep dividers inside grouped cards and retain account gradients plus the dark Ringkasan focal card.
- Preserve the neutral vertical connector in the Jatuh Tempo timeline; only colored severity rails beside ordinary list items are removed.
- Timeline groups omit horizontal row dividers and connect the neutral rail continuously between adjacent date markers, stopping at the first and last item.
- A single-item time bucket keeps a neutral trailing connector so the timeline treatment remains visible even when no adjacent row exists in that bucket.
- Render the due-date timeline connector as one uninterrupted rail owned by the row group, with date labels beside the rail and markers layered above it; per-row connector fragments are removed to prevent visible gaps.

## iOS Inset-Grouped Polish Follow-up (2026-07-15)

- Preserve the current Dashboard structure, cards, data density, and operational hierarchy while shifting the visual treatment from flat ERP panels to calm iOS inset-grouped surfaces.
- Use translucent white surfaces, restrained backdrop blur, soft ambient elevation, and a subtle inner highlight instead of repeated hard white cards with identical shadows.
- Make section headings and compact actions feel native: stronger title rhythm, system-accent action text, capsule touch targets, and reduced visual weight for utility labels.
- Soften repeated row dividers and uppercase metadata; introduce rounded pressed states and layered status/icon treatments without adding decorative gradients or new motion.
- Keep the dark financial position as the anchor, but give it finer depth, softer internal grouping, and less dashboard-like metric framing.
- Apply the same shared surface treatment across Ringkasan and detail tabs so the Dashboard remains consistent, then verify 320–430px density, focus states, reduced motion, and contrast.

## Selected Surface Interaction Follow-up (2026-07-15)

- Recompose account rows as compact iOS Wallet-style cards: account identity and exact balance remain primary, while masked account context and the latest real transaction sit in a secondary glass strip.
- Preserve each account's saved gradient and text tone; add only restrained highlight depth, an explicit disclosure affordance, and unified spring tap feedback.
- Rework Ringkasan's decision queue from numbered operational rows into icon-led actionable rows with calm severity treatment, preserved source copy/counts, and a clear disclosure target.
- Do not derive or invent new monetary values in the decision queue. Titles, counts, descriptions, destinations, account balances, and latest transactions continue to use the existing Dashboard DTO.
- Verify the two selected surfaces at 320–430px, including truncation, one-line balances, focus visibility, touch targets, reduced motion, and detail-sheet navigation.

## Dashboard Count Source-of-Truth Fix (2026-07-15)

- Derive the pending approval count from the fully resolved actionable approval queue, not raw `approval` rows whose references may be stale, unsupported, or no longer eligible.
- Use the same resolved count for Ringkasan actions, the Persetujuan tab badge, and the Persetujuan summary so every entry point matches the items users can actually review.
- Define overdue payables and receivables through the shared Asia/Jakarta `OVERDUE` bucket instead of raw timestamp comparison, preventing items due today from being mislabeled as late.
- Keep outstanding filters unchanged: paid/void items remain excluded and partially paid documents continue to use their remaining amount.
- Add regression coverage for stale approval references and the Jakarta calendar boundary between `OVERDUE` and `TODAY`.

## Risk and Material Preview Interaction Follow-up (2026-07-15)

- Rework compact project-risk rows into a decision-ready comparison: project and reason first, followed by actual versus internal budget, exact remaining/overrun amount, used percentage, and a clear project disclosure affordance.
- Keep contextual threshold rails exclusive to the full Budget tab; Ringkasan uses direct comparison values to avoid repeating the same progress visualization.
- Rework compact material rows into fulfillment alerts with real shortage quantity, available-versus-required context, project impact copy, and an explicit disclosure affordance.
- Preserve the existing DTO, calculations, status, destinations, and preview limits. No inferred stock or budget values are introduced.
- Add unified spring press feedback with reduced-motion support and verify both selected sections at 320–430px for truncation, touch targets, contrast, and horizontal overflow.

## Cross-tab Ringkasan Design Consistency Follow-up (2026-07-15)

- Treat the approved Ringkasan visual language as the source of truth for Persetujuan, Budget, Jatuh Tempo, Rekening, and Material: translucent inset-grouped cards, compact editorial headers, layered icon tiles, direct value comparisons, and explicit disclosure affordances.
- Introduce a shared Dashboard summary surface so each tab has a recognizable focal block without forcing identical information layouts or turning every surface dark.
- Upgrade actionable full-tab rows to the same interaction contract as Ringkasan previews: rounded pressed state, focus ring, Framer Motion snappy feedback with reduced-motion support, calm status labels, and a clear chevron target.
- Preserve the functional visual grammar of each tab: approvals remain a decision queue, budget remains a threshold monitor, due dates remain a connected timeline, accounts retain saved gradients, and materials remain fulfillment/activity alerts.
- Keep all DTOs, source counts, calculations, routes, RBAC, server actions, account mutations, approval confirmation, and timeline grouping unchanged.
- Verify all tabs at 320, 390, and 430px for financial-value wrapping, horizontal overflow, touch targets, connected timeline continuity, gradient identity, keyboard focus, and console errors.
