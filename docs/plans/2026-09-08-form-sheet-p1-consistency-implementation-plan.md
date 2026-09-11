# Form Sheet P1 Consistency Implementation Plan

Tanggal: 8 September 2026  
Status: selesai diimplementasikan  
Mode: Operate · mobile-first web  
Audit sumber: `.impeccable/critique/2026-09-08T14-34-24Z__apps-web-all-form-input-sheets.md`

## Goal

Menutup seluruh temuan P1 dari audit form-sheet tanpa mengganti visual identity Atria atau
mengubah business logic. Hasil akhirnya harus membuat semua form/input overlay memakai satu
contract untuk:

1. asosiasi label, helper, error, required, dan control;
2. focus, keyboard, reduced motion, touch target, body lock, dan overlay layering;
3. ownership header, scroll plane, dan footer pada onboarding forms;
4. close/discard/preserve behavior pada setiap editable sheet.

Perubahan ini adalah refinement terhadap `The Quiet Command Center`. Radius, palette, grouped
surface grammar, compact typography, dan existing finance/material review flow dipertahankan.

## Job, Audience, dan Outcome

- Owner, Finance/Admin, Purchasing, serta PM harus dapat membuka, mengisi, meninjau, menutup,
  dan melanjutkan form dengan perilaku yang dapat diprediksi pada lebar 320–430 px.
- Pengguna keyboard/screen reader harus menerima nama field, helper/error, status disabled,
  dialog boundary, dan focus restoration yang sama dengan pengguna visual.
- Onboarding harus terasa sebagai guided setup, bukan Settings atau workspace operasional yang
  dimasukkan ke dalam drawer.
- Penutupan form harus eksplisit: perubahan dibuang, dipertahankan, atau dikonfirmasi; tidak ada
  perilaku yang bergantung pada kebiasaan masing-masing feature.

## Confirmed Scope

### P1.1 — Field semantics

- `FormField` menghasilkan association yang aman secara default.
- Shared text, textarea, numeric, money, dan quantity controls mewarisi field ID, helper/error ID,
  invalid state, dan required state tanpa caller wiring berulang.
- Enam non-standard `FormField` children diperbaiki manual dengan semantic yang sesuai.

### P1.2 — Overlay foundation

- `BottomSheet` menghormati `prefers-reduced-motion`.
- `CalendarDialog` kembali memakai shared `DialogFrame` behavior, mempunyai focus trap, dan
  effective touch targets minimal 48×48 px.
- Receipt preview dipindahkan dari local fixed overlay ke shared semantic media dialog.
- Feature code tidak lagi dapat mengimpor raw `DialogFrame` dari public UI barrel.

### P1.3 — Onboarding composition

- Budget defaults onboarding tidak lagi merender seluruh Settings manager di dalam sheet.
- Initial stock onboarding tidak lagi merender seluruh page workspace dengan submit button di
  scroll body.
- Masing-masing outer sheet memiliki satu header, satu scroll plane, dan satu fixed footer owner.
- Existing Server Actions, permission checks, validation, maker-checker, dan audit behavior tetap.

### P1.4 — Dismissal and dirty state

- Semua 56 form-sheet instances mendeklarasikan dismissal policy secara eksplisit.
- Existing three-way draft flows tetap dipertahankan.
- Local-edit forms memakai shared discard confirmation.
- Ephemeral/sensitive forms memakai intentional discard/reset behavior.

## Non-Goals

- Tidak mengubah database schema, Drizzle queries, Server Action payload, RBAC, project scoping,
  ledger, stock movement, approval threshold, atau audit-log behavior.
- Tidak mengerjakan temuan P2 selection grammar pada iterasi ini, kecuali semantic change yang
  wajib agar P1 field association benar.
- Tidak mengubah flow panjang menjadi wizard secara menyeluruh.
- Tidak mengubah Expo client; parity Expo dicatat untuk follow-up migration plan.
- Tidak mengubah status copy, success level, atau localization secara massal di luar P1.
- Tidak menghapus compatibility aliases sebagai pekerjaan sampingan; hanya cegah pemakaian baru.

## Baseline Evidence dan Koreksi Audit

- Ada 180 production `FormField` instances; 135 tidak memberi `htmlFor` secara eksplisit.
- Dari 135 tersebut, 129 membungkus shared controls yang dapat diperbaiki sekaligus melalui field
  context: 49 `TextInput`, 33 `Textarea`, 25 `MoneyInput`, 14 `NumericInput`, dan 8
  `QuantityStepper`.
- Enam sisanya memakai custom/non-control child dan harus diputuskan manual; daftarnya ada di
  Phase 1.
- Ada 56 production form-sheet instances: 7 direct `FormSheet`, 27
  `OperationalFormSheet`, dan 22 `WorkflowFormSheet`.
- Audit awal mengira password state dapat muncul kembali setelah close. Trace ke
  `ProfileActionsProvider` menunjukkan `passwordSession` me-remount `ChangePasswordSheet` setiap
  kali dibuka, sehingga nilai lama tidak muncul lagi. Implementasi tidak boleh membuat fix palsu;
  tambahkan regression test yang mengunci remount/reset behavior ini.
- Worktree saat plan ditulis memiliki banyak perubahan lokal pada shared UI, onboarding,
  administration, profile, dan AI chat. Implementasi harus re-read setiap target sebelum patch dan
  tidak menimpa perubahan yang tidak terkait.

## Architecture Decisions

### 1. Generated field association melalui context

Tambahkan internal `FormFieldAssociationContext`. `FormField` menjadi pemilik generated IDs dan
semantic state; shared controls mengonsumsi context tersebut.

Contract:

- Explicit caller `id`, `htmlFor`, `aria-describedby`, `aria-invalid`, dan `required` selalu menang.
- Bila caller tidak memberi ID, `FormField` membuat hydration-stable ID melalui `React.useId()`.
- Helper/error memakai satu stable message ID. Error mengganti helper secara visual dan semantic.
- Explicit `aria-describedby` digabung dengan generated message ID tanpa duplikasi.
- Error otomatis menghasilkan `aria-invalid="true"` pada control.
- `required` pada `FormField` diteruskan ke control jika caller belum menetapkan nilai sendiri.
- Context bersifat internal; feature code tetap mengimpor hanya dari `@/components/ui`.
- `FormField` yang tidak membungkus form control tidak boleh berpura-pura menjadi `<label>`.
  Gunakan `FactRow`, semantic `fieldset/legend`, atau explicit custom-control association.

### 2. One modal behavior owner

`DialogFrame` tetap menjadi internal owner untuk portal, focus trap/restoration, visual viewport,
Escape, pending dismissal, body lock, overlay stack, dan reduced motion.

- `CalendarDialog` menjadi semantic wrapper di atas `DialogFrame`; ia tidak lagi memiliki salinan
  sendiri dari portal/focus/body-lock logic.
- Tambahkan `MediaPreviewDialog` sebagai public semantic wrapper untuk zoomed receipt/media.
- Tambahkan public semantic morph wrapper untuk notification detail, lalu hapus `DialogFrame` dari
  `components/ui/index.ts`.
- Architecture test secara eksplisit menolak import `DialogFrame` pada `app/**`, `features/**`, dan
  `components/layout/**`.

### 3. One dismissal contract

Ganti informal `onClose` convention pada semantic form sheets dengan discriminated dismissal
contract yang tetap diterjemahkan ke internal `BottomSheet.onClose`:

```ts
type FormSheetDismissal =
  | {
      readonly mode: "discard";
      readonly onClose: () => void;
      readonly onDiscard: () => void;
    }
  | {
      readonly mode: "confirm";
      readonly dirty: boolean;
      readonly onClose: () => void;
      readonly onDiscard: () => void;
      readonly title?: string;
      readonly description?: string;
    }
  | {
      readonly mode: "preserve";
      readonly onClose: () => void;
    }
  | {
      readonly mode: "managed";
      readonly onRequestClose: () => void;
    };
```

Semantics:

- `discard`: reset temporary state lalu close, tanpa prompt; cocok untuk empty/review-only atau
  security-first input yang memang tidak boleh bertahan.
- `confirm`: bila `dirty`, tampilkan shared discard dialog di atas sheet; bila bersih, close langsung.
- `preserve`: close tanpa reset karena state/draft memang akan tersedia saat dibuka kembali.
- `managed`: caller sudah memiliki custom three-way Save Draft / Discard / Continue flow.

`OperationalFormSheet` dan `WorkflowFormSheet` meneruskan union yang sama. `DetailSheet` tetap
memakai ordinary `onClose` karena tidak memiliki editable draft.

## Phase 0 — Safety Baseline dan Contract Tests

### Tasks

1. Re-read semua target yang masih modified/untracked dan catat overlap sebelum patch.
2. Tambahkan failing tests lebih dahulu untuk empat contract P1:
   - generated field association;
   - reduced-motion bottom sheet;
   - calendar focus/touch behavior;
   - required dismissal policy pada semantic form sheets.
3. Capture current browser reference pada 320, 360, 390, dan 430 px untuk:
   - Expense Lapangan;
   - Project Baru;
   - Transfer Rekening + Calendar;
   - Formula Budget;
   - Material Terbuang.
4. Jangan submit finance/material forms dan jangan reset database selama visual baseline.

### Files

- `apps/web/components/ui/form/form-presentation.test.tsx`
- `apps/web/components/ui/form/control-language.test.tsx`
- new `apps/web/components/ui/form/form-field-association.test.tsx`
- `apps/web/components/ui/overlay/bottom-sheet.test.ts`
- `apps/web/components/ui/overlay/dialogs.test.tsx`
- `apps/web/lib/architecture/ui-import-boundaries.test.ts`
- new `apps/web/lib/architecture/form-sheet-dismissal-contract.test.ts`

### Exit criteria

- Tests fail only for the intended missing contracts.
- Existing visual baseline and current local changes are recorded; no product mutation occurs.

## Phase 1 — Accessible Field Association

### Shared implementation

1. Add internal `form-field-association-context.tsx` under `components/ui/form/`.
2. Update `FormField` in `basic-form-controls.tsx` to generate label/control/message IDs and
   provide required/error state.
3. Update these shared controls to merge explicit props with context:
   - `TextInput`;
   - `Textarea`;
   - `NumericInput`;
   - `MoneyInput`;
   - `QuantityStepper`.
4. Give the editable input inside `QuantityStepper` the inherited ID/name/ARIA contract; plus and
   minus buttons keep their own accessible labels.
5. Preserve current grouped/standalone classes exactly. This phase must create no visual diff.
6. Update FormField stories with default, helper, error, explicit-ID, and grouped examples.

### Manual resolution for six custom children

| File                                                                          | Current child              | Required resolution                                                                                                   |
| ----------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `features/settings/components/materials/material-inventory-default-sheet.tsx` | read-only `div`            | Replace fake field label with `FactRow`/read-only value row.                                                          |
| `features/projects/detail/components/rab/rab-source-drawers.tsx`              | choice `div`               | Use `fieldset` + visible `legend`; keep `ChoiceRow` semantics.                                                        |
| `features/projects/list/components/drawers/project-drawer-sections.tsx`       | conditional cover uploader | Give file input a stable ID and associate the visible group/instructions; do not nest interactive labels incorrectly. |
| `features/finance-dashboard/components/bank-accounts/color-editor.tsx`        | nested `label`             | Use one explicit label-control relationship for the color input; avoid label inside label.                            |
| `features/finance-dashboard/components/bank-accounts/account-form-sheet.tsx`  | status `button`            | Use an accessible switch/choice control or explicit button association instead of a fake field label.                 |
| `features/administration/components/roles/role-editor-sheet.tsx`              | read-only `p`              | Replace fake field label with a read-only fact row.                                                                   |

### Tests

- Generated label `for` equals actual control `id`.
- Explicit IDs remain unchanged.
- Helper and error IDs are announced through `aria-describedby`.
- Error sets `aria-invalid`; removing it restores the valid state without changing field ID.
- Required state reaches native inputs.
- Multiple fields rendered together never collide IDs.
- SSR static markup and client hydration retain the same association.
- Quantity stepper input is named, described, keyboard reachable, and its buttons have labels.
- Architecture test reports any non-shared child without explicit semantic ownership.

### Exit criteria

- All 129 shared-control cases gain association without consumer edits.
- The six manual cases no longer render misleading label semantics.
- No change to spacing, height, radius, or field presentation.

## Phase 2 — Overlay Accessibility Foundation

### 2A. BottomSheet reduced motion

Files:

- `apps/web/components/ui/overlay/bottom-sheet.tsx`
- `apps/web/components/ui/overlay/bottom-sheet.test.ts`
- `apps/web/components/ui/overlay/semantic-sheets.stories.tsx`

Tasks:

1. Read `useReducedMotion()` once in `BottomSheet`.
2. Reduced-motion open/close removes automatic Y translation and spring height movement.
3. Backdrop and content use immediate opacity state or the existing reduced-motion convention from
   `DialogFrame`; no custom timing is introduced.
4. User-driven drag remains available, but expand/collapse does not animate when reduced motion is
   active.
5. Preserve measurement, scroll padding, sticky chrome, safe-area footer, focus trap/restoration,
   body lock, and overlay layering.

### 2B. Calendar on shared DialogFrame

Files:

- `apps/web/components/ui/overlay/calendar-dialog.tsx`
- `apps/web/components/ui/overlay/dialog-frame.tsx`
- `apps/web/components/ui/overlay/dialogs.tsx`
- `apps/web/components/ui/overlay/dialogs.test.tsx`
- `apps/web/components/ui/form/date-form-controls.tsx`
- `apps/web/components/ui/form/date-form-controls.stories.tsx`

Tasks:

1. Remove Calendar's duplicate portal, body-lock, overlay-stack, visual-viewport, Escape, and focus
   restoration implementation.
2. Compose calendar through internal `DialogFrame` with a calendar presentation that preserves the
   current compact visual hierarchy.
3. Month navigation, `Hari Ini`, date grid, and `Batal` remain inside one focus trap.
4. Give previous/next month, Today, Cancel, and each enabled date a 48×48 effective target. Visible
   circles may remain smaller through pseudo-element hit areas.
5. Implement roving keyboard date-grid behavior:
   - Arrow keys move by day/week;
   - Home/End move within the week;
   - PageUp/PageDown change month;
   - Enter/Space select;
   - disabled min/max dates are skipped or blocked predictably.
6. Replace inline CSS height transition with Framer Motion and existing motion presets; reduced
   motion makes the change immediate.
7. Return focus to the original `DatePickerField` trigger after select, cancel, backdrop, or Escape.

### 2C. Semantic media preview

Files:

- new `apps/web/components/ui/overlay/media-preview-dialog.tsx`
- `apps/web/components/ui/index.ts`
- `apps/web/components/ui/overlay/dialogs.test.tsx`
- new Storybook story for media preview
- `apps/web/features/expenses/components/sheets/expense-list-dialogs.tsx`

Tasks:

1. Add `MediaPreviewDialog` on top of internal `DialogFrame`/overlay foundation.
2. API owns open, title, image URL, alt text, close, loading failure, and optional caption.
3. Use Indonesian accessible copy and a visible close action; backdrop and Escape may close.
4. Migrate `ReceiptImageLightbox`; remove local `fixed`, `z-100`, click propagation, ad-hoc
   transition, and English `Receipt Zoomed` alt text.
5. Preserve receipt aspect ratio and full-resolution containment without horizontal overflow.

### 2D. Hide raw infrastructure

Files:

- `apps/web/components/ui/overlay/dialogs.tsx`
- `apps/web/components/ui/index.ts`
- `apps/web/features/notifications/components/notification-morph-dialog.tsx`
- `apps/web/lib/architecture/ui-import-boundaries.test.ts`

Tasks:

1. Add a semantic morph-detail wrapper with the minimal public props required by notification.
2. Migrate `NotificationMorphDialog` to that wrapper.
3. Remove the public `DialogFrame` export.
4. Extend architecture tests to reject `DialogFrame` imports and raw overlay infrastructure in
   feature code.

### Exit criteria

- Every sheet/dialog has one behavior owner.
- Reduced-motion users see no automatic sheet slide/scale.
- Calendar is fully operable with keyboard and 48 px effective targets.
- Receipt preview traps/restores focus and participates in the overlay stack.
- No feature imports `DialogFrame` or creates a local modal implementation.

## Phase 3 — Onboarding-Specific Form Compositions

### 3A. Budget defaults

Files:

- `apps/web/features/onboarding/components/panels/financial-defaults-panel.tsx`
- new `apps/web/features/onboarding/components/panels/onboarding-budget-defaults-sheet.tsx`
- `apps/web/features/settings/components/budget/budget-settings-manager.tsx`
- optional extracted pure helpers under `features/settings/components/budget/`
- `apps/web/features/onboarding/utils/onboarding-workspace.test.ts`

Tasks:

1. Stop mounting `BudgetSettingsManager` inside an outer direct `FormSheet`.
2. Create an onboarding-owned `WorkflowFormSheet` with:
   - formula identity and internal budget cap;
   - five canonical category allocations;
   - allocated/buffer summary;
   - a review state explaining that changes affect only new projects;
   - fixed `Ubah` / `Simpan` actions.
3. Reuse `updateBudgetAllocationDefaults`, existing validation, permissions, category IDs, and
   allocation math. Do not duplicate server/business rules.
4. Remove Settings hero, project-value simulation, sticky save bar, and nested category metadata
   editor from onboarding presentation.
5. Category name/description editing remains in the dedicated onboarding Categories tab; the
   budget sheet only edits allocation participation and ratios.
6. Use one shared discard confirmation owned by the sheet dismissal contract.
7. Retain `onMutationComplete` and update the onboarding snapshot after success.

### 3B. Initial stock

Files:

- `apps/web/features/onboarding/components/panels/initial-stock-setup-panel.tsx`
- `apps/web/features/materials/components/workspaces/opening-inventory-workspace.tsx`
- `apps/web/features/materials/components/workspaces/opening-inventory-entry-form.tsx`
- new controller hook/pure sections under `features/materials/components/workspaces/`
- new `apps/web/features/onboarding/components/panels/onboarding-opening-inventory-sheet.tsx`
- `apps/web/features/onboarding/utils/onboarding-workspace.test.ts`
- focused opening-inventory presentation tests

Tasks:

1. Extract opening-inventory state, derivation, CSV preview, and submit orchestration from the page
   wrapper into a reusable feature controller hook.
2. Extract pure metadata/manual/CSV/summary sections that can render in page or sheet context.
3. Keep the permanent `/materials/opening` workspace as a page composition with its existing
   history and eligibility context.
4. Replace onboarding's workspace-in-sheet with an onboarding-owned `OperationalFormSheet`:
   - same manual/CSV mode;
   - same eligible inventory and duplicate prevention;
   - same total and approval consequence;
   - fixed `Ajukan saldo awal` footer with `disabledReason`;
   - explicit discard confirmation when input is dirty.
5. Do not put batch history or read-only ineligible inventory lists inside the composer sheet;
   those remain on the onboarding stage or detail sheet.
6. Preserve maker-checker behavior: submit creates an opening request only; stock and cash do not
   change until approval.

### Exit criteria

- No onboarding `FormSheet` contains a Settings manager or page workspace.
- No sheet contains a second sticky save bar.
- Budget and opening-stock primary actions remain reachable in the footer at 320 px and with the
  software keyboard open.
- The same Server Actions and permission checks are used before and after the refactor.

## Phase 4 — Dismissal Policy Rollout

### Shared implementation

Files:

- `apps/web/components/ui/overlay/semantic-sheets.tsx`
- `apps/web/components/ui/form/guided-form.tsx`
- new `apps/web/components/ui/overlay/form-sheet-dismissal.tsx`
- `apps/web/components/ui/overlay/unsaved-changes-modal.tsx`
- `apps/web/components/ui/index.ts`
- new dismissal behavior tests and architecture test

Tasks:

1. Add the `FormSheetDismissal` discriminated union.
2. Make dismissal required on `FormSheet`, `OperationalFormSheet`, and `WorkflowFormSheet` after
   all consumers compile against it.
3. Implement the shared two-action discard dialog through `ConfirmationDialog` and
   `SheetFooterActions`; do not add a new portal or z-index.
4. Keep `FinanceUnsavedChangesModal` and `MaterialUnsavedChangesModal` for three-way managed draft
   flows, but expose a canonical `UnsavedChangesDialog` name and retain old names only as semantic
   presets.
5. Pending forms cannot be dismissed from close button, Escape, backdrop, or nested dialog.
6. Discard/reset runs before the close callback; visual data remains mounted until exit completes.

### Policy migration groups

#### `managed` — preserve existing custom draft/recovery flows

- Expense form and vendor bill.
- Field disbursement and vendor payment flows.
- Bank account, movement, and transfer forms.
- Goods receipt, emergency adjustment, stock count/transfer, project material operation, and stock
  operation.
- Project creation/recovery and existing client invoice/payment flows.
- Settings editors that already own a dedicated discard confirmation.

The migration only replaces the raw `onClose` handoff with `mode: "managed"`; existing business
copy and draft behavior remain.

#### `confirm` — local edits that currently risk silent loss

- `AdministrationUserEditorSheet`.
- `AdministrationVendorEditorSheet`.
- `VendorCreateSheet` when any field differs from empty state.
- `RoleCreateSheet` and dirty `RoleEditorSheet`.
- AI assistant preferences.
- `EditProfileSheet`, including name/photo state and object-URL cleanup.
- Budget item, inventory-location, library-cost-component, material import/editor, RAP material,
  RAP category plan, RAP revision, RAB bundle/item/source/manual-line editors, and budget
  reallocation where no stronger parent guard exists.

Each consumer computes dirty state against an explicit baseline; do not infer dirty from the
submit button's enabled state.

#### `preserve` — state intentionally retained elsewhere

- Nested item editors whose draft is owned by a parent form and remains available after the child
  closes.
- Server/local draft flows that intentionally resume later but do not need the existing three-way
  modal.

Visible status copy must say when state is preserved; otherwise use `managed` or `confirm`.

#### `discard` — intentionally ephemeral or read/review-only

- `ChangePasswordSheet`: preserve session-key remount; closing intentionally abandons values.
- Project activation/review sheets and other input-free review surfaces.
- Opening-inventory batch detail when reversal input is absent.
- Any create sheet still empty and any edit sheet identical to baseline.

### Regression correction for profile sheets

- Expand `profile-sheets.test.ts` to assert both `editSession` and `passwordSession` keys.
- Verify close → reopen remounts password form with empty values.
- `EditProfileSheet` still receives discard confirmation because image upload/name edits are not
  security-sensitive ephemeral input.

### Exit criteria

- Architecture test accounts for all 56 form-sheet instances and reports any sheet with no policy.
- Backdrop, Escape, pull-close, header close, and programmatic close take the same policy path.
- Dirty forms cannot silently lose meaningful edits.
- Preserve/managed flows do not show duplicate confirmation dialogs.
- Password values never survive reopen.

## Phase 5 — Documentation and Compatibility Cleanup

1. Update `DESIGN.md` Forms & Sheets with the four dismissal modes and the generated field
   association guarantee.
2. Update `.impeccable/design.json` through the repository's canonical design-document workflow;
   do not hand-author divergent tokens.
3. Update shared stories for:
   - field helper/error association;
   - dirty and clean close;
   - preserved draft;
   - reduced motion;
   - Calendar keyboard states;
   - media preview loading/error.
4. Mark compatibility aliases with a removal follow-up, but do not delete them in this P1 pass.
5. Document the corrected password-remount finding in the persisted audit or an implementation
   record so later work does not reintroduce a redundant reset flow.

## Verification Matrix

### Automated tests

Run focused tests from `apps/web` so `bunfig.toml` and the `server-only` preload are active:

```bash
cd apps/web && bun test components/ui/form/form-field-association.test.tsx
cd apps/web && bun test components/ui/form/form-presentation.test.tsx
cd apps/web && bun test components/ui/overlay/bottom-sheet.test.ts
cd apps/web && bun test components/ui/overlay/dialogs.test.tsx
cd apps/web && bun test lib/architecture/ui-import-boundaries.test.ts
cd apps/web && bun test lib/architecture/form-sheet-dismissal-contract.test.ts
cd apps/web && bun test features/onboarding/utils/onboarding-workspace.test.ts
cd apps/web && bun test features/profile/components/views/profile-sheets.test.ts
```

Then from repository root:

```bash
bun run test
bun run lint
bun run format:check
bun run build
```

Do not run bare `bun test` from the repository root.

### Browser verification

Use authenticated demo data without submitting mutations. Test 320, 360, 390, and 430 px:

1. Expense Lapangan: open/close, nested item, managed draft confirmation, keyboard footer.
2. Project Baru: generated field labels, optional disclosure, close confirmation, review.
3. Transfer Rekening: select, money field, Calendar keyboard loop, return focus.
4. Material Terbuang: grouped field association, disabled reasons, keyboard-safe footer.
5. Formula Budget onboarding: edit → review → continue editing; no nested sticky action.
6. Opening stock onboarding: manual and CSV state, fixed footer, keyboard, dirty close.
7. Administration user/vendor and AI preferences: clean close vs dirty confirmation.
8. Edit profile and change password: discard policy difference and password remount.
9. Receipt image: focus entry, Tab loop, Escape/backdrop close, focus restoration.

Repeat representative checks with `prefers-reduced-motion: reduce`:

- sheets do not automatically slide;
- dialogs do not scale;
- calendar month changes immediately;
- focus and dismissal behavior stay identical.

### Mechanical design detector

After all UI edits are complete, run the Impeccable detector once against changed source targets,
excluding generated `storybook-static/**`. Do not rerun it repeatedly during implementation.

## Risk Controls

- The field-context migration touches a high number of consumers indirectly. Keep explicit props
  authoritative and add collision/hydration tests before consumer cleanup.
- Calendar refactor must not change ISO date parsing, min/max rules, selected date, or Indonesian
  date formatting.
- Onboarding extraction must reuse existing actions and calculations; no duplicated budget or
  stock mutation code.
- Dismissal dialogs must be above their parent sheet through the existing overlay stack; never
  add local z-index values.
- Avoid one massive mechanical rewrite in a dirty worktree. Commit/verify by phase and stop if a
  target has conflicting uncommitted edits that cannot be preserved.

## Definition of Done

- All four P1 findings are closed with tests and browser evidence.
- 180 `FormField` instances have valid semantics; the 135 previously unwired cases are covered by
  shared context or explicit manual semantics.
- All 56 form sheets declare dismissal intent.
- No feature-level portal, raw modal semantics, local body lock, or public `DialogFrame` consumer
  remains.
- Onboarding budget and initial-stock composers each have one fixed action owner.
- 320–430 px, keyboard-only, screen-reader semantics, safe-area, software keyboard, and reduced
  motion acceptance pass.
- Full test, lint, format, and build gates pass or any unrelated pre-existing failure is reported
  with evidence.
- No finance/material/server mutation behavior changes and no database reset occurs.

## Implementation Record — 9 September 2026

- `FormField` sekarang menghasilkan dan meneruskan label/control/message association ke
  `TextInput`, `Textarea`, `NumericInput`, `MoneyInput`, dan `QuantityStepper`. Composite
  `AdaptiveSelect`, `ComboboxField`, dan `DatePickerField` juga menghasilkan stable trigger ID,
  helper/error description, dan accessible name yang membawa label plus nilai saat ini.
- Enam non-standard field children dipindahkan ke semantic row, group, atau explicit control
  association. Setelah penyesuaian UI paralel pemilik repo, visual dan interaction grammar input
  terbaru diperlakukan sebagai source of truth; pass akhir tidak mengubah styling input.
- `BottomSheet` mempunyai reduced-motion path. `CalendarDialog` memakai `DialogFrame`, roving
  date-grid keyboard navigation, dan explicit return-focus ref. `MediaPreviewDialog` menggantikan
  local receipt lightbox. Notification memakai semantic `MorphDetailDialog`; raw `DialogFrame`
  tidak lagi diekspor ke feature code.
- Budget defaults onboarding memakai `OnboardingBudgetDefaultsSheet`; initial stock onboarding
  memakai `OpeningInventoryEntryForm` sheet presentation. Tidak ada lagi Settings manager atau
  page workspace dengan submit button di scroll body di dalam kedua sheet tersebut.
- Seluruh 56 production form-sheet instances mendeklarasikan dismissal policy: 24 `confirm`, 27
  `managed`, 4 `discard`, dan 1 `preserve`; architecture test menolak consumer tanpa policy.
- `WorkflowFormSheet.actionLayout` yang sebelumnya diterima tetapi diabaikan telah dihapus bersama
  empat call site palsunya.
- Dokumentasi `DESIGN.md` dan `.impeccable/design.json` diperbarui dengan field-association,
  declared-dismissal, dan one-overlay-owner rules.

Verification:

- `bun run test`: lulus; 866 web tests pass, 144 integration tests skipped oleh existing gate.
- `cd apps/web && bun x tsc --noEmit`: lulus.
- `bun run lint`: lulus untuk seluruh workspace.
- `bun run build`: lulus; hanya warning Turbopack existing mengenai broad NFT trace dari
  `next.config.ts` melalui AI provider.
- Focused P1 suite: 67 tests lulus sebelum final composite-control additions; final full suite
  mencakup additions tersebut dan tetap hijau.
- Impeccable detector final pada shared UI dan seluruh feature target terkait: 0 findings.
- Browser QA: 320, 360, 390, dan 430 px; Transfer, Calendar, Project Baru, dan administration
  dirty-close. Arrow navigation, Escape return focus, accessible names, fixed footer, no overflow,
  dan console 0 warning/error terverifikasi. Tidak ada mutation form yang disubmit.
- `bun run format:check`: baseline repository masih gagal pada 105 file existing. Task-owned core
  files yang dibuat/diubah signifikan sudah diformat; file UI yang sedang dikerjakan pemilik repo
  tidak di-auto-format agar perubahan aktif tidak tertimpa.
- Database tidak di-reset dan finance/material Server Actions tidak diubah.
