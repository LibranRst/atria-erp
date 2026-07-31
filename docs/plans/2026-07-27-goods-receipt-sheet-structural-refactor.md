# Goods Receipt Sheet Structural Refactor

## Goal

Separate receipt item editing and shared receipt types from the sheet workflow while preserving vendor-bill prefill, RAP linking, stock impact review, and posting behavior.

## Structure

- Keep `goods-receipt-sheet.tsx` responsible for sheet lifecycle, source/document state, prefill changes, validation, submission, and confirmations.
- Move expandable material rows and item collection actions into `goods-receipt-items-section.tsx`.
- Move receipt option/draft types, money formatting, and new-item creation into `goods-receipt-types.ts`.
- Replace local Lucide controls with the typed shared `AppIcon` mapping.

## UI Contract

- Preserve source/location, document, material item, review, stock impact, confirmation, and success hierarchy.
- Preserve validation, pending, dirty-close, project/vendor change, and failure behavior.
- Motion: retain existing sheet and tap feedback; no page, list, or section entrance animation.

## Validation

- Prettier and ESLint for affected receipt modules.
- Strict TypeScript compilation.
- Material form and stock tests.
- `git diff --check`.
