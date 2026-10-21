# Desktop modal spacing and control audit

## Scope

Audit all production modal/sheet families through shared owners and feature consumers: forms and reviews, compact forms, confirmations/recovery/results, detail/search/calendar/media, and nested selectors or secondary editors. Preserve the incumbent Atria desktop identity, the latest equal-column footer fix, mobile/native composition, domain permissions, mutation contracts and a single focus/dismissal/scroll owner.

Inspect header/body/footer/aside padding and gaps, natural versus capped height, viewport clearance, section/field grouping, compact control geometry, long labels, disabled/pending states and nested-layer clipping. Prioritize concrete reproducible defects; do not blanket-shrink all controls, remove meaningful context or replace the visual world.

## Execution and preservation

1. Read Graft, PRODUCT/DESIGN/sidecar, shared UI inventory and current modal stories/tests. Run parallel read-only audits of shared owners and feature families; root owns the live browser and coordinates one fix batch.
2. Inventory production modal contracts and their explicit overrides, distinguishing shared defects from intentional compact/read-only/adaptive exceptions.
3. Keep the user's existing Stock Opname draft/confirmation separate from audit interactions. Capture current visible draft values locally before any source write; never save/discard the user's form or mutate development data. Use a temporary dev-app audit tab for read-only dialogs and local QA drafts. Source hot reload may require restoring the original draft; confirm exact values/location and original overlay/viewport at handoff.
4. Fix verified issues via existing shared UI props/tokens/presets. Preserve draft DOM/focus across resize, explicit review/confirmation steps, pending guards, native keyboard interaction and existing nested portal ownership. New behavior warrants focused real-owner tests; low-impact style/prop fixes use existing regressions and live geometric evidence.
5. One bounded final visual/geometry pass at desktop 1024/1280/1440 and mobile 320/360/390/430 over representative modal families, including nested sheets/selectors and short/long content. Confirm corrected cases once; no open-ended polishing.
6. Run appropriate web tests, TypeScript, lint, formatting, tokens/scoped styles and any justified build, keeping heavy checks separate from timed DOM fixtures. Avoid rebuilding/reloading the user's restored unsaved form. Align design/surface guidance where contracts change, refresh Graft, and record evidence and limits here.

## Completed changes

- Shared `DatePickerField` and `QuantityStepper` now follow fine-pointer desktop density: 40px standalone, 32px grouped, with matching quantity side controls. Coarse-pointer geometry remains 48px; mobile/native date and quantity defaults remain unchanged. The same controls, values, associations and overlay owners survive resize.
- Invoice presets, reconciliation replacement-file actions, receipt upload, Material Master CSV and opening-inventory CSV pickers reuse public `Button`. Filename content is bounded without losing the complete accessible name. Pending, validation, native input identity, parser and retry behavior stay with their existing owners.
- The project-category detail sheet action fills its available footer width. Existing equal-column confirmation and protected aside/footer contracts remain authoritative.
- No new primitive, domain calculation, mutation, finance/material writer, permission or database change was needed. Existing shared sheets/dialogs remain the only focus, dismissal and scroll owners.

## Coverage and evidence

The AST inventory covers **215 production modal usages across 120 files and 16 public families**. This is source coverage, not 215 independently executed live workflows. The inventory and local QA evidence are under `/tmp/atria-desktop-modal-audit-2026-10-16/`.

Live dev-app checks used a separate temporary authenticated tab, without business saves or uploaded files:

- Invoice form → nested calendar: Enter, keyboard date navigation, Escape and exact trigger-focus restoration.
- Library template → component editor → selector: three overlay layers, keyboard opening, Escape and parent retention.
- Both nested paths were checked at desktop 1024/1280/1440px, short 1024×600px and mobile 320/360/390/430px. Dialogs/popups stayed inside the viewport with no horizontal overflow.
- Generated production CSS fixtures verified standalone/grouped date and quantity sizes for desktop, mobile/native presentation and forced coarse-rule activation. The latter checks CSS cascade specificity and order; it is not hardware pointer emulation. A new browser-test fixture was added, but its isolated browser runner was not rerun after the fix; the equivalent compiled-CSS cases were verified through the supported browser tool.
- Real-owner DOM fixtures exercised preset cents/stage/note, upload validation and same-file retry, pending guards, replacement-file state, long filenames, fractional quantity limits, nested focus and resize continuity. API writers were mocked or never invoked.

The user's original Stock Opname form and unsaved-changes confirmation stayed open. All 10 visible field values, location, two overlay layers and original 1499×954 viewport matched the captured state after hot reload; no restoration, save or discard was needed.

## Verified non-findings

Shared modal clearance, capped body/aside scroll, compact confirmations and the Library editor grid were already bounded in the live checks. Existing primary/review footer geometry, RAB adaptive export layout and protected review stages were retained. No blanket utility removal or modal resizing was justified.

## Validation

- Focused web suite: **30 passed, 0 failed, 128 assertions across 9 files**; affected real-owner fixture wrappers passed again after TypeScript-only fixture repairs.
- Web `tsc --noEmit`, workspace lint, token checks, generated scoped HeroUI style check and Graft rebuild passed.
- Impeccable detector on the changed date/quantity/picker/preset controls: no findings.
- Global `bun run format:check` passed with all matched files clean.
- No Next production build was run while the user's unsaved form was open, to avoid rewriting Next-generated references and triggering a reload. TypeScript, scoped styles and the live development compilation cover this presentation-only change.

Read-only final review found no blockers. The temporary audit tab was closed; the original draft tab remains open with unchanged values and overlay state. Final screenshot: `/tmp/atria-desktop-modal-audit-2026-10-16/stock-opname-final.png`.

Status: complete.
