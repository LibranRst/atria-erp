# Atria Visual Pattern Catalog

Use this catalog to choose a pattern, then inspect the live component before implementing it. The code is authoritative when the catalog and implementation differ.

## Dashboard Taste Reference

| Area           | Inspect                                                                                 | Reuse the design reasoning                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and tabs | `finance-dashboard.tsx`, `dashboard-primitives.tsx`, `components/ui/segmented-tabs.tsx` | Compact greeting/context, strong peer navigation, stable URL-backed tab content, one-column density                                     |
| Ringkasan      | `FinancialPosition`, `DashboardOverviewTab`, `ProjectRiskRow`                           | One dominant financial position with neutral inset metrics, concise attention, and decision-heavy risk items with compact comparisons   |
| Persetujuan    | `dashboard-approvals-tab.tsx`, approval rows                                            | Decision-first summary, urgency without decorative rails, budget impact before confirmation, detail sheet followed by explicit decision |
| Budget         | `BudgetRiskTab`, project/category rows                                                  | Budget versus actual, remaining value, margin/risk context, contextual indicators instead of repeated generic progress bars             |
| Jatuh Tempo    | `CashDueTab`, due rows                                                                  | Time and cash consequence, compact status, grouped obligations and receivables, direct drill-down                                       |
| Rekening       | `AccountsTab`, `bank-accounts/`                                                         | Preserve account gradients as identity surfaces; keep transactions and actions operational and secondary to available balance           |
| Material       | `MaterialsTab`, material rows                                                           | Show category-budget context before or alongside shortages; distinguish RAP shortage, low stock, review, waste, and adjustment          |

Across every tab, preserve the calm hierarchy: position or workload, attention, next action, then supporting detail. Use shared soft surfaces, internal dividers, compact icon tiles, neutral inset metric cells, semantic status copy, `MoneyValue`, and structural empty/loading states.

All neutral surfaces, boundaries, focus states, and elevation must use the semantic color, ring, and
shadow roles in `app/globals.css` and `CONTROL_LANGUAGE.md`. Visual similarity is not permission to
copy an arbitrary shadow recipe or introduce a local gray.

For a trailing section-header workload total, use the shared compact `SectionCountPill`: noun on
the outer neutral pill and number in the inner `CountBadge`. Keep non-count context as plain text.

Do not reproduce a Dashboard section merely because another page contains numbers. Choose a focal surface only when one state genuinely dominates the workflow.

## Main Content Pattern Choice

### Inset Metric Grid

Inspect:

- `FinancialPosition` and `PositionMetric` in `features/finance-dashboard/components/workspaces/finance-dashboard.tsx`
- compact `ProjectRiskRow` in `features/finance-dashboard/components/rows/project-rows.tsx`
- `DashboardSummaryFact` in `features/finance-dashboard/components/shared/dashboard-summary-fact.tsx`

Use this pattern for two or three comparable values that support one focal summary or decision item. Keep cells compact and neutral, with no independent shadow or elevation. Place semantic tone on the value, icon, or explicit status unless a warning, critical state, selection, or comparison applies to the whole cell.

The dark `Kas tersedia` surface demonstrates a focal owner with three supporting inset metrics. The compact risky-project row demonstrates an entity owner with a two-cell metric grid and one full-width budget comparison. Neither example authorizes a generic KPI grid across unrelated sections.

### Grouped Operational Rows

Use one soft owning surface with dividers for activity, history, transactions, master data, and simple title/meta/value lists. An icon tile, status, primary value, or chevron may enrich the row, but do not convert it into a metric-card grid without a real comparison or independent decision.

### Decision Item

Use one card or purpose-built row when an entity is independently actionable and the user needs multiple facts to judge it. Keep identity before metrics, limit the inset grid to two or three cells, allow at most one full-width comparison or consequence, and make the owner—not decorative inner cells—the primary interaction target.

## Approved Form References

### Expense Lapangan

Inspect `features/expenses/components/expense-form.tsx`, its section components, and the global drawer wrapper.

- Keep project/category context early and non-material entry fast.
- Use grouped rows for transaction identity, item details, documents, and review.
- Expose budget effect and overbudget approval consequences before commit.
- Preserve OCR as prefill/review assistance, not an automatic financial mutation.
- Preserve draft recovery, conflict resolution, unsaved-change confirmation, and explicit submit.

### Tagihan Vendor Baru

Inspect `features/expenses/components/vendor-bill-form.tsx` and finance form primitives.

- Separate vendor/project/category context from bill-document fields.
- Preserve draft continuation and discard affordances.
- Use a review step that shows vendor, project, category, number, amount, due date, and remaining budget.
- Explain that bill creation records an obligation and does not move cash until payment.

### Proyek Baru

Inspect `features/projects/list/components/project-drawer.tsx` and `project-drawer-sections.tsx`.

- Keep name, client, and PM as the core identity group.
- Put schedule, location, cover, and notes behind a compact optional disclosure.
- Preserve local recovery and review-before-create behavior.
- Explain automatically prepared budget defaults and access/workflow consequences.

## Shared Form and Overlay Grammar

- `FormSection`: one owning surface with labeled, borderless rows and dividers.
- `OperationalFormSheet`: focused entry with a stable header and action/status footer.
- `WorkflowFormSheet`: review, confirmation, and explicit commit.
- `BottomSheet`: light canvas, white grouped content, 28px top corners, pull handle, circular header controls, and a safe-area footer. Header/footer chrome floats over one scroll plane with functional token-based edge scrims, never decorative gradients.
- `ConfirmationModal` and `ConfirmationSheet`: use only for meaningful consequence or irreversible choice.
- Success state: restrained confirmation, useful facts, and one clear next action.

Keep overlays layered above navigation through the established portal and z-index system. Preserve presented data until exit completes so closing sheets never flash empty content.
