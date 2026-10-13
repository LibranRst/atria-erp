# RAP material editor: sheet consistency discussion

User invoked Grilling to redesign the second/material section's inputs to match neighboring sheets. Existing approved constraints stay: direct row edits, one expanded mobile row, editable desktop table, explicit Apply before Save, five/ten-row pagination, and stable draft/control DOM across resize.

## Verified facts

- AI RAP already uses the public FormField/Textarea/NumericInput/MoneyInput, but forces inline fields plus review-specific right alignment/64-percent value width.
- RapMaterialFormDrawer, Material Master editor and library cost-component sheet use FormSection with default stacked labels. RAP manual quantity/buffer include unit suffixes; current AI RAP lacks them.
- Shared numeric controls edit raw strings, normalize comma/dot decimals and preserve empty input. RAP schema validates two decimal places. MoneyInput owns the Rp prefix; formatted currency must not be put into draft state.
- Field helpers own accessible description/error associations. AI price-source copy currently sits outside FormField; it can be associated with the price field.
- Edit/Tutup only shows/hides controls; it does not Apply corrections. A collapse cue must not imply the draft has been saved.

## Current frontier

Q1: choose standard grouped form with labels above/left-aligned values, quantities together and explicit units, versus retaining inline left-label/right-value rows.
Q2: show total quantity/subtotal once after open editor, retaining current compact summary only when collapsed, versus retaining the top summary while editing.

Recommendations: standard grouped form with normal lightweight mobile input typography; read-only results below editing controls. Financial budget section, material identities, backend and permission contracts are outside this redesign's scope. Both frontier recommendations were explicitly approved before implementation.

## Approved implementation

Keep one mounted FormField tree with stacked grouped presentation; mobile quantity/buffer share a row with unit suffixes, while compact desktop cells keep unit helpers. Price source becomes associated FormField helper, with price label identifying the unit. Collapse is labeled Ringkas to distinguish it from closing the sheet or applying changes. Mobile expanded rows place read-only total quantity/subtotal after the inputs, retaining the top comparison only in collapsed rows. Input raw strings, mobile16px floor and normal light typography remain. No new primitive or backend/calculation change.

## Verified delivery

Dev @Browser covered320/360/390/430/716/1024/1280/1440px. The focused price field retained value125000 and focus across every width; no document horizontal overflow. Mobile fields stayed16px and aligned left; desktop cells stayed14px with unit helpers. Price-source helper is linked by aria-describedby. Qty3001 recalculated total375.125m and blocked Save before Apply; restored3000 locally without a business save. Expanded mobile results appear once below fields; collapsed mode restores the top summary.

Scoped shared form/typography/table and RAP consent suites13passed; workspace tests1,951passed. Web types/build, workspace lint, shared style generation/check and scoped formatting passed. Existing unrelated Material Master accept-dependency lint warning remains. Fresh Impeccable review: ship, no material fixes. Evidence: output/ai-chat-qa/rap-material-fields/. Documentation and graph updated after verification.
