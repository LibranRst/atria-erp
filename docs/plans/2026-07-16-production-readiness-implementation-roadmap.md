# Production Readiness Implementation Roadmap

Status: **implemented dan diverifikasi**

Dicatat: **16 Juli 2026**

Dasar: `docs/guide/workflow_audit_2026-07-16.md`

## Tujuan

Menyelesaikan blocker yang masih terbuka agar Atria ERP dapat dimulai dari database production kosong, menjaga nilai inventory dan project margin secara benar, serta memiliki kontrol internal yang cukup sebelum financial posting production.

Dokumen ini menjadi catatan scope dan acceptance implementation. Seluruh phase telah diimplementasikan pada 16 Juli 2026; detail verifikasi tercatat pada bagian status tracking.

## Urutan wajib

```text
1. Production Foundation
2. Opening Inventory Cutover
3. Material Cost Attribution
4. Atomic Project Creation
5. User & Vendor Administration
6. Maker-Checker Controls
7. Planning Audit Trail
8. Preventive Controls & Recovery UX
9. Full Empty-Database Regression
```

Urutan ini tidak boleh dibalik tanpa keputusan produk baru. Tahap 1 membuka kemampuan setup; tahap 2 dan 3 menentukan kebenaran nilai stok dan margin; tahap setelahnya memperkuat integritas operasional dan kontrol internal.

## Phase 1 — Production Foundation (P0)

### Scope

- Secure first-Owner bootstrap untuk database yang belum memiliki user operasional.
- Invite/create user Finance Admin, Project Manager, dan Purchasing.
- Penetapan role server-side dengan audit log.
- Bootstrap canonical Expense Categories dan Budget Allocation defaults secara idempotent.
- Initial readiness gate yang menunjukkan master/configuration mana yang belum siap.
- Tidak membuat project, transaksi, invoice, expense, atau stok contoh.

### Safety requirements

- Bootstrap hanya tersedia bila belum ada active Owner.
- Credential dan bootstrap secret berasal dari environment, bukan source code.
- Tidak boleh menghapus atau menurunkan role last active Owner.
- Endpoint/action bootstrap harus aman terhadap retry dan concurrent request.
- Setiap perubahan user/role dan initialization settings memiliki audit evidence.

### Definition of done

- Database kosong dapat menghasilkan first Owner tanpa manual SQL.
- Owner dapat menyiapkan role minimum yang diperlukan untuk walkthrough.
- Canonical settings tersedia tanpa demo transaction data.
- Readiness gate membedakan configuration missing dari operational empty state.
- Automated tests mencakup retry, unauthorized access, dan last-Owner protection.

## Phase 2 — Opening Inventory Cutover (P0)

### Scope

- Workflow khusus untuk memasukkan opening quantity dan opening average cost per material-location.
- Input cutover date, audit note, dan optional supporting document/reference.
- Preview nilai inventory sebelum posting.
- Approval Owner/Finance sebelum posting final.
- Stock movement dan audit log khusus opening balance.

### Invariant

- Opening inventory bukan Emergency Adjustment, Goods Receipt, expense, atau vendor payment.
- Posting harus atomic: inventory quantity, average cost, movement, approval state, dan audit tidak boleh terpisah.
- Tidak membuat cash transaction atau project actual.
- Setelah posted, perubahan harus melalui reversal/controlled correction; bukan edit langsung.

### Definition of done

- User dapat memulai inventory production dengan quantity dan cost yang benar tanpa SQL atau seed.
- Total inventory valuation setelah cutover dapat direkonsiliasi dengan dokumen sumber.
- Duplicate submit dan concurrent posting tidak menggandakan stok.
- Walkthrough stock dapat dijalankan sepenuhnya dari UI.

## Phase 3 — Material Cost Attribution (P0/P1)

### Keputusan model yang direkomendasikan

Gunakan model **inventory-funded cost**:

- Pembelian ke gudang menambah inventory value dan liability/cash flow, tetapi belum otomatis menjadi actual Material project.
- Actual Material project diakui saat material digunakan untuk project berdasarkan cost source yang sah.
- Direct purchase khusus project dapat menjadi actual langsung dan tidak boleh dibebankan ulang ketika digunakan.
- Return dan waste harus membalik/menambah actual dengan cost basis yang konsisten.

### Scope teknis

- Definisikan source/funding link atau lot/cost allocation yang mencegah satu cost dibebankan dua kali.
- Tentukan perilaku Goods Receipt, vendor bill, project-linked purchase, warehouse purchase, use, return, waste, dan reversal.
- Pisahkan inventory valuation, accounts payable/cash movement, dan project budget actual.
- Migrasikan read model dashboard/category usage bila sumber actual berubah.

### Definition of done

- Satu rupiah cost material hanya masuk sekali ke actual project.
- Warehouse purchase dan direct project purchase menghasilkan accounting behavior yang berbeda dan eksplisit.
- Moving average/lot reversal tetap dapat direkonsiliasi.
- Test mencakup purchase → receipt → reserve → use → return → waste → reversal dan direct-use path.
- Margin project dan Material category usage tetap benar pada setiap checkpoint.

## Phase 4 — Atomic Project Creation (P1)

### Scope

- Gabungkan pembuatan project, canonical project budget, dan category allocations awal dalam satu transaction/helper internal.
- Hilangkan keadaan project tersimpan tanpa canonical budget.
- Sediakan idempotency/retry behavior yang jelas.

### Definition of done

- Hasil action hanya complete project setup atau rollback penuh.
- Failure injection test membuktikan tidak ada partial project.
- Existing project/RAB workflow dan compatibility tables tetap bekerja.

## Phase 5 — User & Vendor Administration (P1)

### Scope user

- Invite, list, activate/deactivate, dan change role.
- Assign/reassign PM ke project dengan scoping dan audit.
- Proteksi last Owner dan proteksi self-lockout.

### Scope vendor

- Create, edit, archive, dan search vendor.
- Vendor yang sudah direferensikan transaksi tidak boleh hard-delete.
- Archived vendor tidak dapat dipilih untuk transaksi baru tetapi history tetap terbaca.

### Definition of done

- Operasional tidak memerlukan manual database provisioning setelah first Owner.
- Semua role dan vendor untuk project baru dapat dikelola dari UI dengan permission yang tepat.
- Historical transaction references tetap utuh.

## Phase 6 — Maker-Checker Controls (P1)

### Minimum coverage

- Expense high-risk/over-budget.
- Vendor bill dan vendor payment.
- Opening inventory dan stock opname.
- Goods Receipt reversal.
- Change Order.

### Rules

- `createdBy`/`requestedBy` tidak boleh sama dengan approver untuk keputusan yang masuk coverage.
- Owner emergency override harus eksplisit, membutuhkan alasan, dan menghasilkan audit event khusus.
- UI harus menjelaskan mengapa action tidak dapat disetujui oleh user aktif.

### Definition of done

- Backend, bukan hanya UI, menolak self-approval.
- Approval tests mencakup setiap role dan emergency override.
- Existing PM self-verification protection tetap berlaku.

## Phase 7 — Planning Audit Trail (P1)

### Scope

- Audit create/update/delete RAP Material lines.
- Audit Tukang dan Subcon package draft changes.
- Audit RAB draft row, price, visibility, discount, dan source changes.
- Simpan actor, timestamp, entity ID, before/after yang relevan, dan reason bila required.

### Definition of done

- Perubahan cost, quantity, source, dan scope sebelum approval dapat ditelusuri.
- Client-facing output tetap tidak mengekspos internal cost/margin/vendor notes.
- Approved baseline tetap immutable dan revision flow tetap menjadi satu-satunya jalur perubahan.

## Phase 8 — Preventive Controls & Recovery UX (P2)

### Scope

- Project budget reallocation editor dengan batch transaction dan reason.
- Preventive cap total active client invoices terhadap contract value/current Change Order.
- Recovery UI untuk incomplete project setup dan configuration gaps.
- Readiness/reconciliation summary sebelum project closing.
- Pesan error yang menunjuk action pemulihan, bukan hanya menyatakan invalid state.

### Definition of done

- User dapat memperbaiki state yang belum lengkap tanpa SQL/manual patch.
- Invoice over-contract ditolak sebelum closing.
- Reallocation mempertahankan total allocation maksimal 100% dan audit trail.

## Phase 9 — Full Empty-Database Regression

Jalankan `docs/guide/financial_workflow_guide.md` dari database baru tanpa seed transaksi. Hanya environment secret dan bootstrap entrypoint yang boleh diprovision di luar UI.

Acceptance minimum:

- Semua role dapat dibuat dan boundary-nya terbukti.
- Settings, vendor, bank, material, dan opening inventory dibuat dari nol.
- Project → RAP/packages → RAB → budget → expense/bill → stock → client receipt → closing selesai.
- Semua expected value, audit evidence, dan negative test sesuai guide.
- Tidak ada manual SQL, direct database edit, atau demo seed.
- Test, TypeScript, lint, dan production build lulus.

## Go-live gate

Financial posting production tetap **NO-GO** sampai:

1. Phase 1 dan Phase 2 selesai;
2. keputusan Phase 3 diimplementasikan dan divalidasi;
3. full regression Phase 9 lulus tanpa workaround data;
4. blocker P1 yang memengaruhi integritas data ditutup atau diterima melalui keputusan risiko tertulis.

## Status tracking

| Phase                             |     Priority | Status                                                                                            |
| --------------------------------- | -----------: | ------------------------------------------------------------------------------------------------- |
| Production Foundation             |           P0 | Selesai — secure first Owner, canonical bootstrap, temporary-password enforcement, readiness gate |
| Opening Inventory Cutover         |           P0 | Selesai — request, approval, emergency override, posting, reversal, movement, audit               |
| Material Cost Attribution         |        P0/P1 | Selesai — inventory-funded cost; purchase asset, use/return/waste mengubah actual                 |
| Atomic Project Creation           |           P1 | Selesai — project, client opsional, budget, kategori, dan audit dalam satu transaction            |
| User & Vendor Administration      |           P1 | Selesai — create/list/update/activate/archive dengan permission dan last-Owner guard              |
| Maker-Checker Controls            |           P1 | Selesai — expense, vendor payment, opening, stock count, receipt reversal, Change Order           |
| Planning Audit Trail              |           P1 | Selesai — RAP, package, RAB draft, dan generation mutations diaudit                               |
| Preventive Controls & Recovery UX |           P2 | Selesai — budget reallocation, invoice cap, readiness/recovery Settings                           |
| Full Empty-Database Regression    | Release gate | Lulus — 21 migration dari schema kosong, bootstrap tanpa seed transaksi                           |

## Verification evidence — 16 Juli 2026

- Empty Neon branch: 56 public tables setelah migration; sebelum bootstrap 0 user, 0 role, 0 project, dan 0 transaksi.
- Bootstrap: 1 Owner, 4 system roles, 5 canonical categories, 1 active Budget Allocation Setting, dan 1 audit event; tetap 0 project dan 0 cash transaction.
- Migration defects lama diperbaiki: duplicate Settings migration, duplicate schema capture di migration 0020, dan numeric CASE cast migration 0013.
- Branch regression sementara dihapus setelah verifikasi.
- TypeScript strict dan targeted finance integration tests lulus; final full-suite/build evidence dicatat pada handoff implementasi.

## Post-implementation UI polish — 16 Juli 2026

Scope polish setelah workflow blocker selesai:

- samakan setup Owner dan forced temporary-password dengan grouped form primitives, placeholder, helper, focus, dan CTA putih/full-width;
- rework Opening Inventory menjadi form mobile-first dengan `FormSection`, `DatePickerField`, `SheetSelect`, input quantity/cost yang terformat, empty/blocked state, preview nilai, serta riwayat yang dapat dipindai;
- rapikan editor reallocation agar memakai field primitives, validasi total/buffer yang terlihat, alasan perubahan yang kontekstual, dan drawer setinggi konten;
- pertahankan readiness sebagai grouped operational rows; copy harus menunjuk state dan tindakan pemulihan tanpa menambah card baru untuk tiap item;
- verifikasi 320, 360, 390, dan 430 px, keyboard/focus, minimum touch target, console, TypeScript, lint, test terkait, dan build.

Polish ini tidak mengubah rule bisnis, permission, maker-checker, posting inventory, atau perhitungan finance yang sudah diimplementasikan.
