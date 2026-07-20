# Project List & Detail iOS-Style Redesign

## Summary
Redesign the project list and project detail workspace into a calmer native iOS-style mobile workflow. The primary UI treatment will shift to mostly black and white, with deep teal reserved for rare iconic accents. Project detail will always open on Overview, RAB will become its own top-level tab, and the project setup flow will be RAP-first before RAB generation.

## Key Changes
- Add `project.cover_image_url` and expose it through project create/update actions, validation, list mapping, detail data, and the project drawer.
- Add ImageKit cover upload in the create/edit drawer using the existing signed upload action and `/project-covers` folder.
- Refresh core tokens so `primary` is near-black and missing semantic badge/card tokens are defined.
- Redesign `/projects` with native-style search, horizontal filter pills, cover thumbnails, compact financial summaries, and clear workspace/edit actions.
- Redesign `/projects/[id]` with a cover hero, key finance metadata, horizontal pill tabs, default Overview, and a setup CTA that points to RAP first, then RAB only after RAP exists.
- Split the current RAP/RAB client presentation by adding a render mode to `RapRabManager`: RAB mode renders client quotation only, RAP mode renders internal material/work/subcon planning.
- Guard the RAB tab when no RAP exists, showing a RAP prerequisite state instead of letting users start quotation too early.

## Tab Content Native iOS Redesign Phase
- Redesign Project Detail tab contents with native-feeling grouped sections, compact metric strips, line-item rows, clear black action surfaces, and mobile-first sheet modals.
- Keep Overview focused on budget control first after the setup CTA, with project metadata and recommendations rendered as compact grouped rows.
- Keep RAP-first workflow: RAP Material is the main internal planning surface, Tukang/Subcon stay lightweight package sections, and existing permissions/actions remain unchanged.
- Keep RAB client-safe and generated from RAP/package/manual sources only after RAP exists; do not expose internal cost, margin, stock, vendor, or internal notes.
- Redesign Stock and Profit tabs into activity/finance panels with restrained semantic risk colors.
- Deep-redesign reusable `ExpenseList`, `VendorBillList`, and `ProjectInvoices` so Project Detail and the global Expenses page share the same native app treatment without changing server action contracts.

## Overview Number Readability & RAB Polish Phase
- Improve high-value money readability in Project Detail Overview by using compact amounts for summary metrics and full wrapping amounts inside Budget Category detail rows.
- Replace single-line truncated category finance text with a mobile-safe 2x2 detail grid for Budget, Actual, Pending, and Remaining.
- Polish RAB generation UI with source counts, clearer selectable source rows, improved manual client line form layout, and stronger generate CTA.
- Polish RAB draft/approved item rows so long labels and high prices stay readable while preserving client-safe content and existing server actions.

## RAP Readability & Workflow Polish Phase
- Redesign the RAP tab around a clear workflow: create RAP draft, add material plan, lock baseline, add Tukang/Subcon packages, then proceed to RAB.
- Reduce visual clutter by prioritizing the next action, compact summary numbers, and readable material/package rows instead of dense mini-cards.
- Keep RAP internal-only, with Tukang/Subcon as lightweight planning packages that support category budget workflow rather than replacing it.
- Polish RAP and package sheets with grouped fields, mobile-safe quantity/cost inputs, and clear internal cost summaries while preserving existing actions.

## Expenses Page Clutter Reduction Phase
- Redesign `/expenses` as a clean finance inbox with fewer always-visible details and clearer primary actions.
- Simplify field claim rows to show status, amount, project/category, requester/date, receipt affordance, and the current action only.
- Move budget usage and process stepper out of default rows unless there is a risk/action reason to show them.
- Reduce vendor bill/payment row density while preserving add, schedule, pay, approval, and receipt flows.

## Morphing Floating Plus Action Menu Phase
- Replace the single-purpose bottom FAB with a morphing quick-action menu that opens native-feeling action pills.
- Use global actions outside Project Detail: new field expense, new vendor bill, and new project.
- Use project-scoped actions inside Project Detail: project expense, project vendor bill, and project workspace affordance.
- Add URL query triggers for `new-vendor-bill=true` and `new-project=true` while preserving existing `new-expense=true`.
- Keep modal/drawer ownership inside the existing components that already have the required data.

## Test Plan
- Run `bun run lint`.
- Run `bun run build`.
- Manually verify project list cards with and without covers, cover upload persistence, detail Overview default, RAB top-level tab, locked tab behavior, and mobile text fit.
- Manually verify RAP-first setup, RAB prerequisite state, RAB client-safe content, stock locked state, expense/vendor/invoice modal flows, and `/expenses` after the reusable finance component redesign.
- Manually verify long Overview budget values and RAB line totals on mobile-sized widths.
- Manually verify RAP empty state, material rows, lock baseline action, Tukang/Subcon package rows, and RAP/package forms on mobile widths.
- Manually verify `/expenses` and Project Detail Expenses tab remain readable and all expense/vendor actions still open the correct flows.
- Manually verify FAB action menu opens/closes, uses global/project-scoped actions correctly, and clears query params after closing forms.

## Assumptions
- Cover image is stored directly on `project.cover_image_url`.
- Cover upload is available in the create/edit drawer only.
- Status colors may still use restrained warning/error/success treatments, but selected tabs, primary pills, and main actions use black.
