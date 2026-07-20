# Expenses Dashboard-Language Rework

## Goal

Bring the approved Dashboard visual and interaction language to `/expenses` while preserving every finance workflow, server action, permission, transaction, audit behavior, drawer, and recovery mechanism.

## Scope

- Rework the global Expenses inbox, Pengeluaran Lapangan content, Tagihan Vendor content, pending-approval entry point, filters, grouped rows, history, empty states, and route loading skeleton.
- Keep expense/vendor creation forms and payment/disbursement sheets functionally unchanged; only shared visual tokens may be inherited.
- Preserve the global shell, top bar, bottom navigation, FAB, safe areas, and `max-w-md` mobile-first layout.

## Implementation

- Replace the loose header and generic metric panel with a compact iOS inset-grouped financial summary that establishes active exposure, required actions, ready-to-pay count, and total history without oversized numbers.
- Use the Dashboard surface contract: translucent white cards, subtle inner highlight, restrained ambient elevation, rounded icon tiles, calm status labels, tabular financial values, and compact capsule actions.
- Render field claims as grouped decision rows inside one section card instead of a tall independent card for every item. Keep receipt, verification, and disbursement actions explicit and safe.
- Replace decorative budget progress bars with a compact factual risk comparison and preserve the exact utilization percentage.
- Render vendor bills and payment plans as grouped payable rows with direct due-date/payment context and compact inline actions.
- Keep the two-level navigation visible and mobile-friendly: Pengeluaran Lapangan/Tagihan Vendor first, then contextual filters or bill/payment state.
- Align pending-approval count with the same resolved actionable approval queue used by Dashboard so stale references cannot create inconsistent counts.
- Implement a route-specific skeleton matching the actual header, main tabs, financial summary, filters, and grouped rows; do not use a centered spinner or generic page loader.

## Verification

- Browser-check both primary tabs and vendor sub-tabs at 320, 390, and 430px for overflow, value wrapping, touch targets, bottom-nav clearance, and focus states.
- Verify receipt opening, filter changes, history expansion, approval navigation, and drawer/sheet entry points without performing money-changing actions.
- Run TypeScript, ESLint, Expenses component/server tests, the full Bun suite, and production build.
