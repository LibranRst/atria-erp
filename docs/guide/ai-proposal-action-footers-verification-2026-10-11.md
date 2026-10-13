# AI proposal action footer verification

The seven families now compose shared `SheetFooterActions`: project/budget management, catalog settings, finance inputs, procurement/warehouse, project stock, saved RAB workflow and vendor payment. Expense decisions keep the same shared contract; expense draft Submit/Correction now shares it while metadata Apply remains separate.

Inline cards use adaptive intrinsic label widths, with quiet correction before primary/critical commit. Both controls share one size and expand into the available space. Narrow cards wrap into full-width rows instead of clipping. Retained review sheets keep primary-first ordering and stacked desktop aside actions; mobile uses the same adaptive pair. Saved navigation/status, correction prompts, current permissions, server readiness, stale/expired/pending guards and confirmation policy remain in each owning workflow.

Standard AI proposal confirmations opt into an optional `ConfirmationDialog.actionLayout="adaptive"`, forwarded to shared footer actions. Batal uses quiet supporting tone. This also covers matching Material Master and RAP/RAB confirmations. Manual dialog defaults and custom action contracts remain unchanged. No new overlay, button or motion primitive was introduced.

## Verification in the visible dev app

Used @Browser on `http://localhost:3003/ai`. The owned conversation **QA footer · Card dan review · hanya preview** contains 14 examples covering all seven families. Synthetic examples use invalid sources or zeroed snapshots so business saves are blocked; reused finance/vendor proposals have zeroed snapshots as well. Creation updated only AI conversation/message metadata.

- All 14 cards checked at 320/360/390/430/785/1024/1280/1440px: no page overflow or clipped action labels. Nine two-action cards share a row at desktop widths; narrower layouts wrap according to the actual labels.
- Review sheets for project, catalog template, project stock, warehouse transfer and saved RAB were opened and resized at 320/360/390/430/1024/1280/1440px. Footers retain their order, desktop asides stack, and correction labels remain intact.
- The existing six-termin finance preview was opened and resized through the same widths. Fresh mobile opening confirmed both action controls are 48px. Resize retains the active owner and native/desktop control presentation while focused or in an open overlay.
- A current vendor payment preview opened its protected confirmation. Long payment labels remained intact at all seven standard widths. Fresh mobile opening also confirmed settled 48px controls at 320px. The dialog was cancelled; no approval, invoice, vendor payment, stock or cash write was committed.
- Visual inspection caught contextual desktop secondary buttons inheriting the primary ink tone. Matching corrections now use the existing quiet variant, confirmed as cool `surface-container-low` with `on-surface` text. No global button color rule changed.

Evidence: `output/ai-chat-qa/proposal-action-footers/`, including card/sheet/confirmation geometry JSON and mobile/desktop screenshots. Some early resize screenshots include a stale capture edge; final screenshots were captured after a separate browser state round trip.

## Automated checks

Five existing workflow DOM fixtures now stub the shared footer through one typed test-only adapter. These tests retain their meaningful confirmation, permission, stale-data, pagination, source-identity and recovery assertions; shared button/disabled semantics remain covered by their own tests.

The targeted workflow/footer/adaptive-policy run passed 20 tests. The final web suite passed 985 tests with zero failures when run separately from build/lint. One parallel run timed out in the unchanged desktop popover fixture; its isolated rerun passed in 7.3s, then the full serial suite passed in 28s. Web build (including TypeScript), workspace lint and HeroUI style verification passed. Lint retains the existing Material Master missing-accept-dependency warning; there are no lint errors. Formatting and whitespace checks passed for the changed files. The graph was refreshed.
