# Full Operational Form Redesign V3

## Intent
- Redesign operational forms around decision flow: decide first, fill relevant details second, review impact last.
- Preserve Server Actions, schemas, permissions, finance/material mutation behavior, and existing mobile bottom-sheet foundation.
- Apply UX principles as operational nudges only: smart defaults, editable previews, clear blockers, calm risk framing, and relative cost/balance context.

## Form Rules
- No visual progress meters, progress percentages, completion headers, signup-wall language, or upgrade-sales framing in operational forms.
- Long forms use visible labels, short section titles, safe defaults, and nearby disabled-state reasons instead of checklist UI.
- Previews must reduce uncertainty before submit. They show identity, stock, budget, or balance impact without mutating data.
- Smart defaults are allowed only when derived from current local data, such as one available PM, one inventory location, one RAP material option, route project context, or existing edit values.
- Money amounts are never guessed. OCR may prefill scanned values, but user edits remain authoritative.
- Loss-aversion copy stays calm and practical: prevent wrong project, wrong stock location, budget overrun, or wrong balance movement.

## Shared UI Defaults
- Keep inputs/selects rounded-full with `min-h-12`; keep textareas rounded-2xl.
- Use `GuidedFormSheet` for high-risk bottom-sheet forms and `GuidedFormSection` for plain one-column grouping.
- Use `SmartDefaultHint` only beside fields that were safely prefilled.
- Use `InlineReviewStrip` near the decision it explains or in the sheet review slot; avoid bulky preview blocks at the top of every form.
