# Tukang/Subcon Detail Plan + Quotation Integration

## Summary
- Material remains the only category with RAP Material Plan and stock-control behavior.
- Tukang and Subcon now get lightweight internal package planning:
  - Tukang: Work Package Plan
  - Subcon: Vendor/Subcon Package
- Operasional and Lain-lain stay fast category expense inputs with description/subcategory context only.
- Client Estimate / Quotation can be generated from selected RAP material items, selected Tukang/Subcon packages, and manual client-safe lines.

## Implementation Decisions
- Add `project_category_plan_item` for non-material plan detail, restricted by action validation to `TUKANG` and `SUBCON`.
- Link `project_expenses` and `vendor_bill` optionally to `project_category_plan_item`.
- Add `source_type` and `source_project_category_plan_item_id` to `rab_estimate_item`.
- Keep `source_project_rap_item_id` for Material RAP quotation rows.
- Do not expose legacy BoQ/detail budget as the primary daily expense mental model.

## UX Rules
- Project Detail shows category budget cards first, then internal planning detail:
  - RAP Material Plan
  - Tukang Work Packages
  - Subcon Packages
  - Client Estimate / Quotation
- Expense form remains category-first.
- Material category reveals material/RAP/stock fields.
- Tukang category reveals Work Package selector.
- Subcon category reveals Subcon Package selector.
- Operasional and Lain-lain stay simple.

## Verification
- `bunx tsc --noEmit`
- `bun run lint`
- Targeted tests for RAP/RAB validation, material validation, budget helpers, and finance actions.
- `bun run build`
- Local seed verification with new package demo data.
