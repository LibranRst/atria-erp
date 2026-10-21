# Product: Paduna Build

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Owner** — needs project value, budget, consumed/remaining budget, category usage, material shortage, leftover stock, due bills, and margin risk readable within 30 seconds, often from the field on a phone.
- **Finance/Admin** — creates project budgets, records expenses, tracks paid/unpaid vendor bills, uploads proofs, reconciles cash against bank statements, and links costs to material/RAP when relevant.
- **Purchasing/Material Team** — checks material needs, reserves stock, records stock in/out/use/return/waste, tracks shortages.
- **Project Team (PM/Designer)** — project-scoped; checks material readiness and inputs field expenses without chasing information through chat.

## Product Purpose

Paduna Build is Paduna's Project Finance & Material Control product, developed from Dekoria's interior design/build workflows. Paduna is the selected brand name, replacing Atria for current brand work. It upgrades Dekoria's existing workbook-informed Project Budget workflow into a structured system covering project budget control, category expense tracking, remaining budget, gross/margin visibility, RAP material planning, inventory visibility, vendor bills, stock movement, project profitability, and (deferred) owner-readable AI summaries. Success means the Owner can read financial and material position in under 30 seconds, and Finance/Purchasing/PM roles can do their category-scoped jobs without manual chat follow-up or spreadsheet reconciliation.

## Positioning

**Project Budget Control upgraded into a real ERP with material stock visibility.** Dekoria can already track project value, budget, category spend, and remaining budget in a finance-spreadsheet pattern — that familiar flow is preserved, not replaced. What a generic ERP, accounting tool, or spreadsheet cannot truthfully claim: category expense tracking (especially Material) is structurally connected to RAP material planning, stock levels, reservation/use, leftover, purchase need, and margin risk — inside the same mobile-first flow field staff already use, with an immutable cash-ledger/audit trail (Option A ledger model) underneath every balance-changing action.

## Operating Context

Brand and product family (selected as the main brand on 17 October 2026): **Paduna** is the umbrella brand for business operations software. **Paduna Build** names the current product in this repository and retains its existing project budget, expense, material, inventory and margin scope. **Paduna Office** is a separate planned product for broader company operations, initially informed by a prospective cable-business customer; its module scope is still to be validated. The products develop and release independently for now. Future integration is a direction, not an implemented shared platform or a commitment to one codebase/database. HR, payroll and full manufacturing/production planning are not added to Build by this branding decision. Existing Atria technical names, package names, identifiers and runtime metadata remain compatibility or rollout concerns; do not rename them automatically. Canonical brand decisions and SVGs live under `docs/brand/paduna/`; the Atria guides are historical references. The approved Temu symbol, Manrope and ink/terracotta palette carry forward. The brand name is selected; domain and trademark availability are not established by this decision.

- Used by field PMs and Owners on mobile phones at project sites, and by Finance/Purchasing at desks; mobile-first is a hard requirement, desktop is supported for heavier administration only.
- Preserves an existing lineage: `Project Budget Setup -> Expense Tracker by Category -> Budget Dashboard -> Category Usage -> Remaining Budget -> Margin Visibility`, extended with `Material category -> RAP/Material Plan -> Inventory Check -> Purchase Need -> Stock Movement -> Material Budget and Margin Risk`.
- Expense categories are fixed and code-locked: `MATERIAL`, `TUKANG`, `OPERASIONAL`, `LAIN_LAIN`, `SUBCON`.
- RAP (internal execution/material cost plan) and RAB (client-facing estimate) are distinct artifacts; RAP data must never leak into RAB.
- Cash ledger, bank-statement import (CSV), reconciliation (Mutasi Bank / Catatan Paduna Build / Riwayat), and project-closing reconciliation are active finance-control workflows.
- Role-based access is project-scoped for PM/Designer; Owner and Finance Admin have global financial access. Owner approval is required for field/vendor payments ≥ Rp 5,000,000 and any over-budget override.
- User-facing copy is predominantly Bahasa Indonesia.
- The legacy Excel workbook is source material for category logic and familiar workflow only — it must never appear as a visible screen label, section title, navigation item, badge, or empty-state copy.

## Capabilities and Constraints

In scope (MVP): Project Budget with category allocation, Expense Tracker by category, Budget Dashboard, RAP/Material Plan per project, Material Master, Stock Inventory, Stock Movement, Vendor Bills/Purchase Tracking, Owner Finance & Material Dashboard, client-facing RAB Estimate generated from RAP, cash ledger/bank reconciliation with documented exceptions and closing control.

Out of scope (MVP): full accounting/tax/journal-entry UI, payroll, HR, complex financial closing; barcode-heavy warehousing, FIFO/LIFO valuation, manufacturing/production planning; external vendor/client portal login; automatic fund disbursement or AI-triggered material mutation; direct host-to-host bank feeds, automatic bank login, or auto-approved reconciliation matches.

Deferred: AI CFO / financial briefing is explicitly deferred from the Dashboard; no active AI briefing entry point or pipeline exists today, and it must not be reintroduced without an explicit product-scope change.

Hard constraints:

- Every balance-changing operation runs inside a database transaction and writes both a cash-ledger entry and an audit-log entry (Option A ledger model: lock account row, verify funds, update balance, write immutable ledger/audit records).
- Reconciled cash-transaction rows are immutable; corrections are compensating reversal/journal entries with audit notes.
- Stock-changing actions run in a transaction and write stock-movement + audit-log entries; reservation/use alone do not create cash transactions.
- AI may analyze, summarize, and prefill, but must never mutate finance/material records without explicit human approval, must never generate/execute SQL, and must never leak internal RAP cost/margin/vendor notes into client-facing RAB output.
- Settings is the source of truth for budget allocation defaults, expense categories, item/price library, and material master; code constants are seed/fallback only. Changes to Settings defaults apply only to new project budgets, not existing ones.

Terminology: RAP (internal execution/material plan, cost baseline once locked), RAB (client-facing estimate/proposal, immutable once approved except via a formal Change Order), Tukang Work Package (lightweight labor/scope plan, no stock behavior), Subcon Package (lightweight vendor/subcon scope plan), Goods Receipt (physical stock-in event, separate from vendor payment), Rekonsiliasi (matching one Paduna Build cash record to one bank mutation).

## Evidence on Hand

- Product/domain specs under `docs/` (PRD, MVP blueprint, flows, data schema/status enums, technical architecture) plus `DESIGN.md` at the repo root (visual design system) are treated as authoritative alongside executable code.
- A connected demo dataset and CSV fixtures exist under `.atria-demo/` for manual verification (`bun run db:demo:reset`, `docs/guide/seeded_demo_walkthrough.md`).
- An empty-DB UAT walkthrough exists at `docs/guide/financial_workflow_guide.md`.
- Prior page/workflow audits exist under `docs/guide/*_audit_*.md` — treat as historical findings, not current state, unless corroborated by current code.
- No production customer data, testimonials, or external case studies exist — this is a pre-launch internal tool; do not fabricate any.
- Paduna's provisional product-family naming, approved Temu identity and source SVGs are recorded under `docs/brand/paduna/`. Dekoria's company identity remains separate, including its own logo on client-facing documents.

## Product Principles

1. Preserve the familiar finance-spreadsheet workflow Dekoria already trusts; extend it, don't replace it.
2. Material/RAP/stock control exists to answer margin-risk questions the current spreadsheet cannot — every material feature should trace back to a shortage, leftover, purchase-need, or margin question.
3. RAP (internal truth) and RAB (client-facing) must stay structurally separate; no internal cost/margin/vendor-note ever reaches client output.
4. Every balance- or stock-changing action is auditable and reversible only through compensating entries, never silent edits.
5. Owner/Finance/Purchasing/PM each get a role-scoped, mobile-first view sized to a field job, not a shared generic admin screen.

## Accessibility & Inclusion

Field PMs and Owners use this primarily one-handed, outdoors, on phones — established product requirements (see `DESIGN.md` and `AGENTS.md`'s UI/UX Rules) already bind future UI work: minimum 48×48px effective touch targets, visible keyboard focus, screen-reader labels, safe-area clearance, `prefers-reduced-motion` support, and status communicated via copy + icon/shape (never color alone).

## Brand Commitments

Paduna is the umbrella brand; Paduna Build is this product. The approved Temu symbol, Manrope wordmark and ink/terracotta palette carry across the product family. Product labels distinguish Build from the separately planned Paduna Office. The candidate tagline "Proyek terkendali. Kerja lebih tenang." belongs to Build and remains unconfirmed; no umbrella or Office tagline is selected. Paduna identity never replaces the user's company identity on client-facing RAB/proposal documents. The interface should feel like a premium **native iOS-style** experience (see `DESIGN.md`) — borrowing iOS visual/interaction conventions (materials, motion, control language) as the app's identity — without a distinct, diverging Android design language. The Next.js web product uses one session and canonical routes for mobile and compact desktop presentation. At >=1024px all authenticated roles receive desktop layout within their domain permissions/project scope; native fallback can retain mobile presentation. Both inherit Paduna identity and business rules. The Expo client remains a separate native presentation of those rules.

## Desktop administration

The current direction is one responsive `apps/web` application, one existing web session and canonical URLs. Every authenticated role receives desktop presentation at >=1024px, with its own domain permissions and project scope unchanged. Desktop inherits Paduna's Manrope, ink/terracotta and semantic surfaces while HeroUI supplies compact controls/tables through shared UI. Resize updates layout without navigating or losing drafts, selection or active dialog ownership; native browser fallback remains mobile through `surface=mobile`.

The first combined shell + Dashboard/Proyek/Budget slice is reviewed before remaining desktop module acceptance. The previously built standalone app is transitional and will be removed after the accepted merge; its separate cookies/default theme do not replace web's session/design. Historical desktop grants and migration records are retained without being a presentation gate. No new bulk payments/approvals, finance/material calculations or AI CFO are introduced. See `docs/plans/2026-10-06-unified-responsive-web.md`.
