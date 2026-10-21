---
target: semua form/input sheet, drawer, dialog, dan modal di apps/web
total_score: 25
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 4
timestamp: 2026-09-08T14-34-24Z
slug: apps-web-all-form-input-sheets
---

# Audit Konsistensi Seluruh Form Sheet Paduna Build

Target: seluruh form/input sheet, drawer, dialog, modal, selection/search overlay, dan compatibility alias di `apps/web`.

## Design Health Score

|         # | Heuristic                       |     Score | Isu utama                                                                                                                 |
| --------: | ------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------- |
|         1 | Visibility of System Status     |         3 | Pending, disabled reason, review, dan success kuat; beberapa direct sheet masih bergantung pada toast.                    |
|         2 | Match System / Real World       |         3 | Bahasa finance/material sangat kuat; `Import/Impor`, `Project/proyek`, dan fallback role belum seragam.                   |
|         3 | User Control and Freedom        |         2 | Flagship finance/material punya unsaved guard; admin, profile, dan preferences belum konsisten.                           |
|         4 | Consistency and Standards       |         2 | Taxonomy shared UI matang, tetapi direct `FormSheet`, raw `DialogFrame`, lightbox lokal, dan option-card lama menyimpang. |
|         5 | Error Prevention                |         3 | Review-before-commit, impact preview, confirmations, dan disabled reason tersebar luas.                                   |
|         6 | Recognition Rather Than Recall  |         3 | Helper, default, preview, dan review mengurangi beban ingatan; daftar besar yang tidak searchable masih ada.              |
|         7 | Flexibility and Efficiency      |         2 | Draft, OCR, template, dan search membantu; form batch/panjang masih satu jalur tanpa navigasi cepat.                      |
|         8 | Aesthetic and Minimalist Design |         3 | Chrome dan grouped form tenang; workspace-di-dalam-sheet dan selected-card menambah noise.                                |
|         9 | Error Recovery                  |         2 | Beberapa workflow menyimpan draft/retry; lainnya membuang work atau hanya menampilkan toast.                              |
|        10 | Help and Documentation          |         2 | Helper kontekstual banyak, tetapi pola bantuan dan penempatan aturan kritis belum seragam.                                |
| **Total** |                                 | **25/40** | **Acceptable — fondasi kuat, tetapi consistency dan accessibility membutuhkan pass sistemik.**                            |

## Coverage dan Accounting

Audit source menginventarisasi 155 instance consumer shared-overlay di 85 file produksi:

| Keluarga surface              | Instance produksi |
| ----------------------------- | ----------------: |
| Direct `FormSheet`            |                 7 |
| `OperationalFormSheet`        |                27 |
| `WorkflowFormSheet`           |                22 |
| `CompactFormDialog`           |                 5 |
| `SelectionDialog`             |                 1 |
| `SearchDialog`                |                 1 |
| `ConfirmationDialog`          |                50 |
| `FinanceUnsavedChangesModal`  |                10 |
| `MaterialUnsavedChangesModal` |                 1 |
| `SuccessDialog`               |                 1 |
| `OperationSuccessDialog`      |                10 |
| `DetailSheet`                 |                19 |
| Raw `DialogFrame`             |                 1 |
| **Total**                     |           **155** |

Tambahan di luar shared-overlay:

- 1 modal lokal aktif: `ReceiptImageLightbox`.
- 1 fixed input overlay lokal yang tampaknya dead/unreferenced: `DecisionReasonOverlay`.
- 13 consumer `DatePickerField` yang membuka `CalendarDialog` saat runtime.
- 64 consumer `AdaptiveSelect` dan 14 consumer `ComboboxField` yang dapat membuka anchored listbox, `SelectionDialog`, atau `SearchDialog`.
- Compatibility alias yang masih diekspor tetapi tidak dipakai di produksi: `ConfirmationModal`, `ConfirmationSheet`, `OperationSuccessSheet`, `SheetSelect`, `GuidedFormSheet`, dan `GuidedFormSection`.
- `NotificationCenterDrawer` dan `DecisionReasonOverlay` diekspor namun tidak memiliki importer produksi.

Boundary: page-embedded forms tidak dihitung sebagai form sheet, kecuali ketika form page tersebut benar-benar dipasang di dalam sheet (contohnya opening-inventory onboarding). Shared definitions, stories, dan tests diaudit sebagai contract tetapi tidak dihitung sebagai consumer produksi.

## Inventaris Semua Form/Input Overlay Aktif

### Administration dan access

| Consumer                          | Surface                | Ringkasan konsistensi                                                                                     |
| --------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `AdministrationUserEditorSheet`   | direct `FormSheet`     | Grouped dengan baik; server error/dirty close belum kuat; fallback role bisa bocor sebagai nama internal. |
| `AdministrationVendorEditorSheet` | direct `FormSheet`     | Dua grouped section; dismiss langsung membuang edit tanpa guard.                                          |
| `VendorCreateSheet`               | direct `FormSheet`     | Validasi lokal dan pending ada; error/success toast-only, tanpa dirty guard.                              |
| `RoleCreateSheet`                 | `OperationalFormSheet` | Disabled reason dan smart default baik; belum punya dirty guard.                                          |
| `RoleEditorSheet`                 | `OperationalFormSheet` | Read-only/edit state dan progressive disclosure baik; permission toggle bisa sangat padat.                |
| `RoleAccessManager`               | `ConfirmationDialog`   | Konfirmasi destructive standar dan konsisten.                                                             |

### AI, approval, dan notification

| Consumer                      | Surface                                    | Ringkasan konsistensi                                                                    |
| ----------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Conversation rename           | `CompactFormDialog`                        | Tepat untuk satu field; pending/disabled jelas.                                          |
| Conversation preferences      | direct `FormSheet`                         | Lima pilihan serentak dan selected full-row fill menyimpang dari grammar choice.         |
| `MorphedInputComposer`        | `SearchDialog`                             | Search continuity dan keyboard handoff kuat.                                             |
| `ApprovalList` approve/reject | `ConfirmationDialog` + `CompactFormDialog` | Review-first kuat; textarea/error association belum programmatik.                        |
| Dashboard approval            | `ConfirmationDialog` + compact reject      | Sama dengan approval list; bagus secara domain, gap a11y sama.                           |
| `NotificationMorphDialog`     | raw `DialogFrame`                          | Accessible karena mewarisi frame, tetapi melanggar ownership boundary feature/shared UI. |

### Expenses dan vendor bills

| Consumer                                | Surface                          | Ringkasan konsistensi                                                                        |
| --------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `ExpenseForm`                           | `WorkflowFormSheet`              | Salah satu implementasi terbaik: draft/offline/conflict, OCR, review, unsaved, success.      |
| `ExpenseLineEditor`                     | `WorkflowFormSheet`              | Field grouping dan budget risk bagus; `OptionChoiceGroup` menyimpang secara visual/semantik. |
| `VendorBillForm`                        | `WorkflowFormSheet`              | Draft/review/unsaved/success kuat; server error belum selalu dekat field.                    |
| `FieldDisbursementSheet`                | `WorkflowFormSheet`              | Dampak finansial dan finality sangat jelas.                                                  |
| `VendorSchedulePaymentSheet`            | `WorkflowFormSheet`              | Penjadwalan dibedakan jelas dari mutasi kas.                                                 |
| `VendorDisbursePaymentSheet`            | `WorkflowFormSheet`              | Review balance dan warning final kuat.                                                       |
| Expense approval/draft/receipt overlays | confirmation/success/local modal | Confirmation/success konsisten; receipt lightbox melompati contract modal bersama.           |

### Finance dan reconciliation

| Consumer                               | Surface                   | Ringkasan konsistensi                                                                     |
| -------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `AccountFormSheet`                     | `WorkflowFormSheet`       | Review opening balance dan identity exception product-specific.                           |
| `MovementSheet`                        | `WorkflowFormSheet`       | Projected balance, review, dan unsaved guard kuat.                                        |
| `TransferSheet`                        | `WorkflowFormSheet`       | Paired-ledger explanation dan wrong-account prevention kuat.                              |
| Reconciliation exception/import/manual | 3× `OperationalFormSheet` | Pemisahan bukti bank vs catatan Paduna Build sangat jelas; file/server errors cenderung generic. |
| Reconciliation matching                | `WorkflowFormSheet`       | Review dan non-balance-changing copy sangat kuat.                                         |
| `ApprovalControlManager`               | `OperationalFormSheet`    | Dampak threshold dan no-change guard jelas.                                               |

### Materials dan inventory

| Consumer                                     | Surface                                   | Ringkasan konsistensi                                                          |
| -------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| `EmergencyAdjustSheet`                       | `WorkflowFormSheet`                       | Audit warning dan review tepat; option group memakai pola card/tint lama.      |
| `GoodsReceiptSheet`                          | `WorkflowFormSheet`                       | Strong review/stock warning/confirmations; item list dapat tumbuh tanpa batas. |
| `InventoryLocationSheet`                     | `WorkflowFormSheet`                       | Satu field tetapi impact-nya membenarkan promotion ke workflow.                |
| `ProjectMaterialOperationSheet`              | `WorkflowFormSheet`                       | Helper berubah sesuai operasi; stock availability dan discard jelas.           |
| `StockCountSheet`                            | `WorkflowFormSheet`                       | Review/draft/approval baik; batch quantity berpotensi sangat padat.            |
| Material `TransferSheet`                     | `WorkflowFormSheet`                       | Availability preview dan discard baik; item list berpotensi panjang.           |
| `MaterialsControlCenter` decision            | `ConfirmationDialog` dengan reason/toggle | Tepat untuk irreversible decision; minimum reason jelas.                       |
| `OpeningInventoryBatchDetailSheet`           | `OperationalFormSheet` impact-promoted    | Read-heavy dan reversal-only; danger context kuat.                             |
| Operational material/detail/success surfaces | `DetailSheet`/success                     | Konsisten dan mempertahankan data selama exit.                                 |

### Onboarding

| Consumer                  | Surface                     | Ringkasan konsistensi                                                                                             |
| ------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `FinancialDefaultsPanel`  | direct expanded `FormSheet` | Menanam seluruh settings manager, sticky page save bar, nested editor sheet, lalu dialog; ownership action kabur. |
| `InitialStockSetupPanel`  | direct expanded `FormSheet` | Menanam workspace/page form; submit berada di scroll body, bukan fixed footer.                                    |
| Quick-start pause actions | `ConfirmationDialog`        | Dua implementasi/copy terpisah untuk peran yang sama.                                                             |

### Profile

| Consumer                            | Surface                | Ringkasan konsistensi                                                                       |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| `ChangePasswordSheet`               | `OperationalFormSheet` | Validasi baik; dismiss tidak reset state sehingga nilai password muncul lagi ketika dibuka. |
| `EditProfileSheet`                  | `OperationalFormSheet` | Upload progress/retry baik; belum ada dirty guard.                                          |
| Logout dan developer account switch | `ConfirmationDialog`   | Konsekuensi cukup jelas; developer-only tetap user-facing dalam simulation mode.            |

### Project budget, invoice, RAP, dan RAB

| Consumer                     | Surface                              | Ringkasan konsistensi                                                                        |
| ---------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Budget approval/reject flows | `ConfirmationDialog`/compact input   | Copy keputusan kuat; field/error association belum konsisten.                                |
| `BudgetItemForm`             | `OperationalFormSheet`               | Subtotal dan disabled reason baik; representative missing label-control association.         |
| `ClientInvoiceForm`          | `WorkflowFormSheet`                  | Review, no-cash-change reassurance, unsaved, success kuat.                                   |
| `ClientPaymentSheet`         | `WorkflowFormSheet`                  | Account/amount/date/impact review kuat.                                                      |
| Budget reallocation          | direct `FormSheet`                   | Lima kategori sekaligus dan custom footer; melewati `SheetFooterActions`.                    |
| `RabBundleDrawer`            | detail/`OperationalFormSheet`        | Totals dan delete confirmation baik; membership dapat unbounded.                             |
| `ChangeOrderDrawer`          | `OperationalFormSheet`               | Hierarki sequential dan contractual consequence sangat product-specific.                     |
| `VoidRevisionDrawer`         | `ConfirmationDialog` dengan textarea | Tepat untuk audit reason singkat dan irreversible choice.                                    |
| `RabItemEditDrawer`          | detail/`OperationalFormSheet`        | RAP/RAB separation jelas; choice cukup banyak tetapi terkelompok.                            |
| `RabSourcePickerDrawer`      | `OperationalFormSheet`               | Dua daftar source tak terbatas dalam satu keputusan; overload terbesar.                      |
| `ManualRabLineDrawer`        | `OperationalFormSheet`               | Client-safe helper dan live total baik.                                                      |
| `CategoryPlanFormDrawer`     | `OperationalFormSheet`               | 8 keputusan dibagi 3 section, tetapi belum ada step/resume.                                  |
| `RapMaterialFormDrawer`      | `OperationalFormSheet`               | 9+ field; shortage/total context bagus tetapi padat.                                         |
| `InternalRevisionDrawer`     | `OperationalFormSheet`               | Locked-baseline warning baik; checklist bisa unbounded.                                      |
| PM assignment                | `SelectionDialog`                    | List tidak searchable dan tidak punya threshold >6.                                          |
| `ProjectActivationSheet`     | `WorkflowFormSheet` review-only      | Fokus dan primary/secondary sangat jelas.                                                    |
| `StockOperationSheet`        | `WorkflowFormSheet`                  | Stock/audit warning dan success kuat.                                                        |
| `ProjectDrawer`              | `OperationalFormSheet` → review      | Salah satu long-form terbaik: recovery, progressive details, blocker count, review, success. |
| `ProjectReviewSheet`         | `WorkflowFormSheet` review           | Entry/review/commit separation tepat.                                                        |

### Settings dan master data

| Consumer                         | Surface                | Ringkasan konsistensi                                                                |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| Formula/category editors         | `OperationalFormSheet` | Grouped styling, inline errors, dan future-project consequence kuat.                 |
| `CategorySettingsManager`        | `OperationalFormSheet` | Dirty/read-only dan discard baik.                                                    |
| `LibraryCostComponentSheet`      | `OperationalFormSheet` | Inline validation dan subtotal baik.                                                 |
| `LibraryTemplateEditorSheet`     | `OperationalFormSheet` | Margin/internal-vs-client context kuat; form settings terpadat.                      |
| `MaterialCategoryComposerDialog` | `CompactFormDialog`    | Surface benar; input hanya punya placeholder/ARIA label tanpa visible label.         |
| `MaterialEditorSheet`            | `OperationalFormSheet` | Progressive disclosure dan dirty parent baik; nested creators menambah depth.        |
| `MaterialImportSheet`            | `WorkflowFormSheet`    | Preview/transaction warning kuat; copy `Import` tidak seragam dan page reload kasar. |
| `MaterialInventoryDefaultSheet`  | `OperationalFormSheet` | No-current-stock-change explanation sangat jelas.                                    |

## Design Specificity Verdict

**Authored at the workflow level; inconsistent at the interaction edge.**

Form finance/material inti tidak terasa seperti generic admin form. Balance impact, stock mutation, category budget, audit reason, dan RAP-vs-RAB boundaries muncul di titik keputusan yang tepat. Kelemahannya adalah edge-system drift: onboarding menanam page manager ke sheet, pilihan memakai beberapa grammar visual, feature dapat mengimpor raw overlay frame, field association opsional, dan unsaved behavior tergantung tim/fitur.

Specificity: **3/4**.

## Deterministic Scan dan Browser Evidence

Detector dijalankan sekali terhadap 467 file markup di `apps/web` dan keluar dengan 34 warning:

- 32 warning berasal dari generated `storybook-static/**`; ini false positive untuk source form sheet dan seharusnya dikecualikan dari target detector berikutnya.
- 2 warning berasal dari `features/ai-chat/components/chat-markdown.tsx` (`border-l-4` dan `border-l-2`); keduanya source produksi tetapi tidak terkait form/input overlay.
- Detector tidak menemukan issue langsung pada form-sheet target. Artinya detector tidak membantah audit manual; rule-set mekanisnya memang tidak mendeteksi label association, dirty-close, focus trap, touch target, atau taxonomy ownership yang menjadi isu utama.

Browser inspection dilakukan di fresh in-app tab pada viewport 390×844 terhadap enam representative surfaces:

1. Expense entry sheet.
2. Material Terbuang sheet.
3. Formula Budget settings sheet.
4. Project Baru sheet.
5. Transfer Rekening sheet.
6. Calendar dialog dari tanggal transfer.

Hasil visual: shared bottom-sheet chrome, 28px top radius, pull indicator, grouped white surfaces, field labels, and fixed action footer konsisten pada flagship flows. Perbedaan yang terasa adalah density/context depth dan beberapa mixed standalone/grouped sections, bukan palette atau radius. Calendar terkonfirmasi sangat compact dan target tanggal/navigasi terasa kecil untuk field use. Mutable script injection tidak tersedia pada browser surface ini, sehingga tidak ada reliable user-visible detector overlay.

## Yang Sudah Bekerja

- High-stakes finance/material forms menunjukkan consequence sebelum commit. Ini adalah kekuatan terbesar dan paling khas Paduna Build.
- `OperationalFormSheet` dan `WorkflowFormSheet` sudah membentuk grammar yang jelas: input → status/review → fixed commit footer.
- Project creation dan Expense adalah benchmark internal terbaik untuk long-form: progressive disclosure, draft recovery, blocker summary, review, dan explicit success state.

## Priority Issues

### [P1] Label, helper, dan error belum terhubung ke control secara struktural

`FormField` membolehkan `htmlFor` dan `helperId` kosong. Banyak caller tidak memberi ID dan `aria-describedby`, jadi label terlihat benar tetapi belum tentu diumumkan benar oleh screen reader.

Fix:

- Jadikan ID label/control/message generated dan wajib melalui shared context.
- Hubungkan helper/error/disabled reason dengan `aria-describedby`.
- Tambah tests untuk label, required, error, helper, dan disabled reason announcements.
- Larang caller merender `FormField` yang tidak dapat mengasosiasikan child control.

Suggested command: `$impeccable audit`.

### [P1] Shared overlay belum memenuhi contract reduced-motion, focus, dan touch target

- Semua bottom sheet tetap slide karena `BottomSheet` tidak memakai `useReducedMotion`.
- `CalendarDialog` hanya menangani Escape; tidak memiliki Tab trap bersama `DialogFrame`.
- Month navigation berukuran 36×36 dan date cells lebih kecil dari effective 48×48 target.
- `ReceiptImageLightbox` tidak punya modal role, focus entry/trap/restore, Escape, body lock, atau overlay stack.

Fix:

- Pindahkan calendar dan media viewer ke shared focus/viewport/stack foundation.
- Tambahkan reduced-motion path ke `BottomSheet`.
- Pertahankan visual compact calendar tetapi perluas invisible hit area ke 48×48.
- Hapus local z-index/modal implementation.

Suggested command: `$impeccable adapt`.

### [P1] Onboarding menanam seluruh workspace ke dalam sheet

Budget defaults memasukkan settings manager dengan sticky save bar dan nested editor sheet. Initial stock memasukkan page workspace dan submit button berada di scroll body. Layer yang memiliki Save menjadi ambigu dan action dapat keluar dari thumb zone.

Fix:

- Buat composition onboarding khusus yang reuse field groups, bukan workspace utuh.
- Outer sheet harus memiliki satu fixed `SheetFooterActions` owner.
- Advanced category/material editing menjadi follow-up surface yang eksplisit.
- Gunakan step/progress hanya untuk keputusan yang benar-benar sequential.

Suggested command: `$impeccable distill`.

### [P1] Dirty-close dan retained state tidak konsisten

Finance/material flagship flows punya unsaved protection, sedangkan admin, vendor, role, AI preferences, dan profile sering dismiss tanpa warning. `ChangePasswordSheet` hanya reset setelah success; close biasa mempertahankan tiga password di mounted state.

Fix:

- Tetapkan shared dirty-close policy: discard silently, confirm discard, atau preserve draft harus explicit prop/preset.
- Clear password state pada close/exit, bukan hanya success.
- Gunakan generic `UnsavedChangesModal` preset lintas domain.
- Standardisasi apakah successful mutation memakai success dialog atau toast berdasarkan impact level.

Suggested command: `$impeccable harden`.

### [P2] Selection grammar dan density bercabang

`OptionChoiceGroup` memakai nested rounded cards, full-row tint, dan fieldset tanpa semantic legend. AI preferences mengulang selected fill. PM assignment memakai unsearchable `SelectionDialog` untuk list unbounded. RAP/RAB source dan batch stock memuat choice list panjang tanpa shortlist.

Fix:

- Satu option group = satu white divided surface; selected state = terracotta label + check, bukan filled card.
- Gunakan proper radio/checkbox semantics dan `legend`.
- Enforce `AdaptiveSelect`: ≤6 anchored, >6 searchable dialog.
- Ubah unbounded multi-select menjadi filter → shortlist → confirm.

Suggested command: `$impeccable polish`.

## Cross-Cutting Contract Bugs

- `WorkflowFormSheet` mendeklarasikan `actionLayout` tetapi tidak membacanya. Empat consumer (`AccountFormSheet`, reconciliation match, `InventoryLocationSheet`, `MaterialImportSheet`) mengirim prop yang tidak melakukan apa pun.
- `DialogFrame` diekspor dari public `@/components/ui`, padahal repo rule menyebut raw frame internal-only. `NotificationMorphDialog` mengimpornya langsung dan lolos architecture test.
- Beberapa confirmation custom-action blocks membuat ulang footer button layout di luar `SheetFooterActions`.
- `CalendarDialog` memakai inline CSS height transition, bukan Framer Motion token yang diwajibkan.
- `MaterialImportSheet` memakai `shadow-control` untuk owning/static section dan memakai copy `Import` saat reconciliation memakai `Impor`.
- Administration/profile/settings masih sering berakhir toast + close, sedangkan operation-heavy flow memakai explicit success dialog.

## Cognitive Load

Overall: **3 dari 8 checklist gagal — moderate**, dengan onboarding, RAP/RAB source selection, permission editor, dan batch stock mencapai high-load territory.

| Check                  | Status                | Bukti                                                                                                           |
| ---------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Single focus           | Pass overall          | Sebagian besar sheet satu title dan satu commit; onboarding manager-in-sheet menjadi exception.                 |
| Chunking ≤4            | **Fail**              | RAP material, category plan, library template, stock count, dan vendor sections melebihi empat keputusan/group. |
| Grouping               | Pass                  | `FormSection` tersebar luas.                                                                                    |
| Visual hierarchy       | Pass overall          | Entry/review/footer sangat jelas.                                                                               |
| One thing at a time    | Pass overall          | Nested item editor dan review stage membantu.                                                                   |
| Minimal choices ≤4     | **Fail**              | AI preferences 5, budget allocation 5, PM list, permission toggles, source lists.                               |
| Working memory         | Pass                  | Review menyatakan kembali account/project/amount/date/impact.                                                   |
| Progressive disclosure | **Fail pada outlier** | Project/material editor bagus; onboarding dan unbounded source list buruk.                                      |

Decision point >4:

- AI preference “Fokus utama”: 5 pilihan.
- Project budget reallocation: 5 category percentages.
- PM assignment: unbounded tanpa search.
- RAB source picker: unbounded materials + packages sekaligus.
- Role permission groups: banyak toggle per disclosure.
- Goods receipt, stock count, transfer, dan opening inventory: unbounded editable items.
- Bundle membership dan revision package selection: unbounded checklist.

## Emotional Journey

Entry state umumnya tenang dan meyakinkan. Peak terbaik berada pada review screen: transfer, pembayaran vendor, stock operation, dan Change Order menjelaskan consequence sebelum commit. Valley terjadi ketika whole workspace dimasukkan ke onboarding sheet atau list panjang dipaksa menjadi satu keputusan. Ending sangat baik pada `SuccessDialog`/`OperationSuccessDialog`, tetapi tidak konsisten pada admin/profile/settings yang sering hanya toast lalu hilang.

## Persona Red Flags

### Jordan — first-timer

- Tidak jelas Save mana yang menguasai nested onboarding budget flow.
- `Import/Impor`, `Project/proyek`, `inventory/inventori`, dan role labels belum seragam.
- PM assignment dapat berubah menjadi list panjang tanpa search.
- Material category composer tidak memiliki visible field label.

### Sam — accessibility-dependent

- Banyak label/helper/error tidak terasosiasi programmatik.
- Calendar tidak trap Tab dan target-nya terlalu kecil.
- Bottom sheet tidak menghormati reduced motion.
- Receipt lightbox tidak memiliki modal semantics/focus management.
- Option group belum memakai coherent fieldset/radio semantics.

### Casey — distracted mobile user

- Onboarding stock submit dapat scroll keluar dari thumb zone.
- RAP, library template, stock count, dan goods receipt membutuhkan perhatian panjang tanpa resumable progress.
- Beberapa form membuang edit tanpa warning; password sheet justru mempertahankan secret state.
- Nested quick-create bekerja secara teknis tetapi context depth sulit dipulihkan setelah interruption.

## Minor Observations

- Receipt image alt text masih `Receipt Zoomed`.
- `NotificationCenterDrawer` dan `DecisionReasonOverlay` tampak dead tetapi masih diekspor.
- Direct `FormSheet` adalah sumber drift terbesar karena caller harus merakit footer/status/dirty behavior sendiri.
- Formula settings, Project Baru, Expense, Material Terbuang, dan Transfer Rekening menunjukkan bahwa grouped-vs-standalone styling sudah dapat konsisten ketika primitive dipakai sesuai contract.
- Tidak ada alasan visual untuk mengganti palette, radius, atau keseluruhan sheet chrome. Perbaikannya harus contract-first.

## Pertanyaan untuk Arah Implementasi

1. Apakah pass pertama harus memperbaiki shared contract/a11y, onboarding composition, atau seluruh dirty-state consistency?
2. Apakah rollout diinginkan sekaligus lintas 85 file, atau dua fase: shared primitives dahulu lalu consumer migration?
3. Untuk long batch forms, apakah ingin mempertahankan satu scrolling sheet dengan sticky progress, atau memecah hanya flow yang benar-benar sequential menjadi steps?
