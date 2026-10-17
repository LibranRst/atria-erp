---
version: 1
slug: "ponents-proposal-cards-rap-draft-proposal-card-tsx"
primary_target: "features/ai-chat/components/proposal-cards/rap-draft-proposal-card.tsx"
# prettier-ignore
related_targets: []
---

# AI RAP review

Scope: the RAP proposal review inside AI chat. Mode: Operate.

Finance, Purchasing and project-scoped users inspect proposed material quantities and cost against the project's Material allocation, correct the draft, apply corrections, then explicitly save RAP. The review preserves real budget/stock context and existing permission/ownership rules.

Composition: identify the project once; give budget a compact verdict and comparison; make Material rows the working surface. Mobile keeps material identity, stock context and Edit above a compact quantity/subtotal comparison only while collapsed. Expanded rows use one white stacked grouped form: wrapping Area, adjacent Kebutuhan and Buffer with explicit unit suffixes, then a price field labeled with its unit and associated price-source helper. Sentence-case labels sit above start-aligned regular-weight Manrope values at the 16px mobile editable-text floor. One read-only total quantity/subtotal row follows the fields; “Ringkas” collapses without applying corrections. Desktop gives Area its own wrapping editable column beside quantity, buffer, unit estimate and read-only subtotal, using associated unit helpers; summary/actions stay in the aside. The same public `FormField`, `Textarea`, `NumericInput` and `MoneyInput` tree stays mounted across resize. Lead the budget group with a status icon, verdict and any over-allocation amount, then show total RAP after the proposal and Material allocation as divided white fact rows in the same stacked reading order on mobile and in the narrow desktop aside, without a nested metric panel. Existing RAP, proposal addition, actual spend, pending review and financial remaining budget use a plain secondary disclosure; proposal edits change the planned total and verdict while those financial facts remain unchanged. Notes stay secondary.

Keep fullDynamic money reads, five/ten-row pagination, natural content-fit sheets, caret navigation inside inputs, and stable draft/focus state across resize. Apply and Save stay separate, with unapplied changes blocking Save and dirty dismissal protecting corrections. Saving a RAP plan does not reserve stock or move cash.

No unresolved scope decisions. The dev evidence uses explicitly synthetic QA material/project proposals; never turn those fixture values into product defaults.
