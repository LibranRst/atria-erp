---
version: 1
slug: "app-ledger-page-tsx"
primary_target: "app/ledger/page.tsx"
# prettier-ignore
related_targets: ["features/finance-dashboard/components/workspaces/finance-dashboard.tsx","features/finance-dashboard/components/desktop/desktop-dashboard-overview.tsx","components/ui/feedback/cash-flow-trend-chart.tsx"]
---

# Dashboard workspace

Mode: Operate. Owner and finance read project-budget position, category consumption and margin risk before deciding which approval, obligation or material issue to inspect.

This is the approved light Atria adaptation of the supplied dense dashboard reference. Desktop content uses one four-metric band, independent cash/category panels with 16px gaps, up to five priority projects and a compact operational surface. Manrope, cool canvas, white 16px panels, ink/terracotta and native HeroUI 20px tables retain Atria identity. Global chrome and the mobile/native composition are preserved.

All six tabs are complete: Ringkasan, Persetujuan, Budget, Jatuh Tempo, Rekening and Material. Public DesktopTable, SegmentedTabs, MoneyValue, filters, status and overlays own interaction infrastructure. GroupedSurface/PanelSection opt into desktopPanel. CashFlowTrendChart is the single new shared primitive, with exact-value tooltips and an accessible table alternative.

Structural desktop loading follows the same six compositions and URL tab/page-size/period hints. Native tables supply loading headers, row/cell geometry and footer; the cash placeholder supplies legend, plot, months and exclusion-footer space. Independent reads keep loaded summaries and filters visible. Static placeholder content is inert and hidden beneath truthful busy announcements, with no fake counts or financial zeros. Mobile/native loading is preserved. Six desktop skeleton stories and isolated responsive/loading/focus evidence accompany the implementation.

Budget figures are current active-project snapshots. The 6/12-month control changes cashflow only, using Jakarta calendar boundaries and the fixed read cutoff. Cash in is not revenue. Opening balances, transfers, adjustments and ambiguous history are disclosed exclusions. Empty, zero and unavailable sources remain distinct. Complete domain-gated table reads filter/sort all rows before 10/25/50 pagination and keep URL state. Existing controllers retain drafts, selection, pending decisions and one overlay owner across resize.

Verified using isolated synthetic populated/empty fixtures at desktop 1024/1280/1440 and mobile 320/360/390/430, plus real API read-only empty data. Independent finish review disposition: ship. No unresolved design decisions. An incumbent mobile ApprovalWorkbenchRow amount/reason overlap for unusually long reasons at 320/360 is documented separately; its component was preserved by this redesign.

Visited desktop data retention follows the shared Retained Desktop Tab Data Rule. Independently fetched tab pages retain exact-query results in a stable owner through conditional presenters; already supplied/client-filtered collections remain instant. Refresh, successful writes and source/actor generation changes invalidate the read result, and denial purges it. Do not retain discarded form intent or reuse stale action/candidate evidence. First visits and new queries remain honest loading states.
