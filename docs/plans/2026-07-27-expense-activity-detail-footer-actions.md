# Expense Activity Detail Footer Actions

## Goal

Keep Expense activity details actionable when their originating row has a permitted business action,
while representing passive workflow states as centered footer copy instead of disabled buttons.

## Behavior

- Reuse the exact callbacks and permission decisions already owned by Expense rows.
- Vendor bills expose `Jadwalkan Bayar` or `Jadwalkan Sisa` when the row exposes that action.
- Vendor payments expose `Cairkan` when the row exposes that action.
- Field claims expose `Verifikasi` or `Cairkan` when the row exposes that action.
- A fully scheduled vendor bill with a pending payment shows centered `Menunggu pencairan` copy in
  the sheet footer.
- Other passive row states may use the same footer-status contract without becoming fake disabled
  buttons.

## Safety

- Do not add a new mutation or infer authorization from activity-detail data.
- Pass only client callbacks that the source row already made available.
- Close the activity sheet before opening the source action sheet so two modal surfaces do not
  compete.
- Keep source navigation as the fallback when neither an action nor a passive footer status exists.

## Verification

- Add presentation contract coverage for action and passive-status footers.
- Run affected activity-detail and Expense tests, ESLint, TypeScript, and production build.
