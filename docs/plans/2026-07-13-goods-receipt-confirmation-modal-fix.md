# Goods Receipt Prefill and Centered Confirmation Modals

## Outcome

- Selecting a vendor bill in Penerimaan Barang remains visibly selected and atomically refreshes every bill-derived field.
- Switching vendor bills never leaves stale project, RAP, material, price, or note data behind and never silently overwrites meaningful manual input.
- Confirmation prompts use one accessible centered overlay pattern instead of a bottom drawer, while data-entry and selector sheets remain bottom sheets.

## Goods Receipt audit

- Root cause: the vendor-bill handler sets `vendorBillId`, then calls the generic project-change path whose `applyProject` clears `vendorBillId` again.
- The dashboard contract currently exposes only bill ID, project ID, and number, so the form cannot reliably refresh material/RAP/price/note prefills.
- The same generic project-change path is used for a bill-driven change and a manual project change even though their reset semantics differ.
- A bill switch can replace an existing material row, so meaningful manual rows require an explicit confirmation before applying the new bill context.

## Implementation

1. Extend the read-only material dashboard bill option with vendor, amount, status, notes, material, and RAP linkage already stored on `vendor_bill`.
2. Add a pure typed bill-to-receipt-prefill helper and unit tests.
3. Separate `applyVendorBill` from manual `applyProject`:
   - bill selection persists;
   - project always follows the bill;
   - linked material/RAP, amount, and note refresh together when available;
   - switching a bill with meaningful manual rows requires confirmation;
   - clearing the bill keeps the current manual receipt context.
4. Improve selector copy so the selected bill shows vendor, project, amount, and status at a glance.

## Confirmation audit and migration

- Keep `ConfirmationSheet` as a compatibility export but render it through a new centered `ConfirmationModal`; this migrates all existing call sites without broad behavioral rewrites.
- The modal uses a portal, stacked overlay hierarchy, focus trap/restoration, Escape/backdrop close, body scroll lock, semantic dialog labels, 48px capsule actions, and Atria motion tokens.
- Move Finance and Material unsaved-change prompts to the same centered modal.
- Move RAB revision cancellation with its required reason field to the centered modal.
- Place material reversal/rejection reasons inside the decision confirmation modal instead of a detached bottom overlay.

## Verification gate

- Unit tests cover bill selection and replacement prefill semantics.
- TypeScript strict, ESLint, `git diff --check`, full tests, and production build pass.
- Browser QA at 320 and 390 px verifies visible bill selection, switching and prefill refresh, confirmation overwrite protection, centered overlay layout, focus behavior, and no final stock/finance mutation.

## Implementation record

- Completed on 2026-07-13 before Phase 4.
- Goods Receipt now derives one typed receipt context from the selected Material vendor bill and applies it atomically. Manual receipt context is retained when the optional bill link is cleared.
- Vendor-bill replacement first presents a centered overwrite confirmation; cancel preserves the previous selection and every existing prefill.
- `ConfirmationSheet` remains source-compatible but renders through the shared centered `ConfirmationModal`. Finance/material dirty guards, material decisions, and RAB revision cancellation now use the same modal interaction.
- Verified with 127 passing tests, strict TypeScript, ESLint, whitespace checks, a successful Next.js production build, and browser QA at 320/390 px with zero console errors. Browser QA did not post stock or mutate finance data.
