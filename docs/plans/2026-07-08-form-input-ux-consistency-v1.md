# Form Input UX Consistency V1

## Intent

- Keep Atria forms calm, mobile-first, and operational while making shared input behavior more consistent.
- Use smart defaults, concise helper copy, previews, and risk-aware guidance as operational nudges, not generic onboarding or sales patterns.
- Preserve existing Server Action contracts, finance/material mutations, and source-of-truth validation.

## Implementation Defaults

- Text inputs, selects, comboboxes, date pickers, and search inputs stay `rounded-full`, `min-h-12`, and horizontally padded.
- Textareas stay `rounded-2xl` for stable multiline layout.
- Avoid visual completion meters in operational forms; rely on defaults, disabled states, and concise helper copy instead.
- Form save buttons should be disabled when obvious required client-side fields are missing, with nearby helper/error copy.
- Amount previews stay close to their related larger totals so users can compare costs without extra mental math.

## V1 Scope

- Reusable controls in `components/ui`.
- Settings forms for Budget Allocation, Expense Categories, Item & Price Library, and Material Master.
- High-risk project, expense, material, and finance bottom-sheet fields where shared controls can be adopted without changing business logic.
