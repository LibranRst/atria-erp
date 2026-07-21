# Audit Workflow ERP — 16 Juli 2026

## Kesimpulan

Core workflow Atria sudah konsisten dengan arah PRD: Project Budget tetap menjadi kontrol utama, RAP/RAB menjadi baseline internal dan proposal client, expense masuk ke kategori canonical, vendor/client payment memengaruhi kas secara eksplisit, dan material control tetap menjadi drill-down kategori Material.

Follow-up implementation pada 16 Juli 2026 telah menutup blocker onboarding database kosong, opening inventory, material cost attribution, atomic project setup, administration, maker-checker, planning audit, serta preventive/recovery controls. Audit ini dipertahankan sebagai baseline temuan; status resolusinya diringkas di bawah.

## Yang diaudit

- schema dan relasi canonical/legacy;
- Better Auth, permission matrix, dan project scoping;
- project creation, Project Budget, RAP, RAB, revision, Change Order, dan closing;
- expense request, verification, approval, payment, vendor bill, dan client invoice;
- rekening, ledger, client receipt, vendor disbursement, dan audit log;
- Material Master, inventory, reserve, use, return, waste, transfer, stock count, Goods Receipt, dan reversal;
- Dashboard, Expenses, Project Detail, Materials, Settings, dan role-specific payload;
- 212 automated tests, TypeScript, dan lint sebagai baseline sebelum perubahan.

## Perbaikan yang sudah diterapkan

### 1. Reservasi material kembali dapat digunakan

Sebelumnya action `reserveMaterialForProject` salah menjalankan validasi milik return. Reservasi pertama selalu dapat ditolak karena quantity reservasi dianggap melebihi usage project. Validasi tersebut dipindahkan ke action return yang benar.

### 2. Reservasi antar-project tidak saling terpakai

Use dan waste sebelumnya mengurangi `reservedStock` global tanpa memastikan reservasi itu milik project/RAP yang sedang memakai barang. Sekarang outstanding reservation dihitung per material, lokasi, dan RAP source. Pemakaian project A tidak boleh melepas reservasi project B.

### 3. Adjustment dan receipt reversal melindungi reserved stock

Stock decrease dan Goods Receipt reversal sekarang ditolak bila hasilnya membuat `currentStock < reservedStock`.

### 4. Direct-use expense tidak melepas reservasi lama

Flow pembelian `DIRECT_USE` membuat stock-in lalu langsung use. Sebelumnya flow ini dapat mengurangi reservasi yang sudah ada. Sekarang reserved stock tidak berubah.

### 5. Client payment tidak dapat overpay

Invoice dikunci di dalam transaction, pembayaran existing dihitung, dan nominal baru ditolak bila melebihi outstanding. Tanggal ledger mengikuti tanggal pembayaran yang dimasukkan user. Rekening archived tidak dapat menerima mutasi.

### 6. Vendor payment tidak dapat dijadwalkan melebihi tagihan

Total payment `PENDING + COMPLETED` sekarang diperhitungkan saat membuat jadwal. Bill dikunci agar dua request bersamaan tidak melampaui outstanding. Schedule juga menulis audit log.

### 7. Status vendor bill tidak lagi menghitung pembayaran dua kali

Sebelumnya payment aktif diubah menjadi `COMPLETED`, ikut terambil dalam query completed, lalu nominalnya ditambahkan sekali lagi. Partial payment dapat membuat bill terlihat lunas terlalu cepat. Kalkulasi sekarang menggunakan `paidBefore + currentPayment` tepat satu kali.

### 8. Payment rejected tidak dapat dicairkan

Disbursement sekarang hanya menerima vendor payment berstatus `PENDING`. Record `FAILED` atau `COMPLETED` ditolak.

### 9. Pemisahan tugas expense diperketat

PM sebelumnya memiliki `update:cost` dan secara backend dapat memverifikasi pengajuannya sendiri. Expense kecil kemudian langsung menjadi `APPROVED`. Verifikasi sekarang hanya untuk Owner atau Finance Admin; approval high-risk tetap milik Owner.

### 10. Balance rekening tidak dikirim ke role non-finance

Expenses dan Project Detail tidak lagi mengirim daftar saldo rekening ke PM/Purchasing. Nested payment hanya membawa nama rekening yang diperlukan untuk konteks, bukan balance lengkap.

### 11. Secret production wajib eksplisit

Production sekarang gagal start bila `BETTER_AUTH_SECRET` tidak dikonfigurasi. Fallback hanya tersedia untuk local development.

## Invariant yang sekarang harus selalu benar

| Domain         | Invariant                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Kas            | Saldo hanya berubah melalui explicit action di dalam transaction dan menghasilkan ledger serta audit log. |
| Client invoice | Total client payment tidak boleh melebihi nominal invoice.                                                |
| Vendor bill    | Total payment pending/completed tidak boleh melebihi nominal bill.                                        |
| Approval       | PM tidak dapat memverifikasi expense sendiri; Owner memutus approval high-risk.                           |
| Inventory      | `currentStock >= reservedStock >= 0`.                                                                     |
| Reservation    | Use/waste hanya melepas reservasi milik project/RAP terkait.                                              |
| RAB            | Approved RAB immutable; perubahan berikutnya harus lewat revision dan Change Order.                       |
| Closing        | Project tidak dapat `COMPLETED` lewat edit biasa dan harus melewati checklist.                            |

## Status gap production setelah remediation

### P0 — Empty-database onboarding — RESOLVED

Database kosong sekarang dapat dioperasikan melalui secure bootstrap dan UI administration untuk:

- first Owner, canonical roles/categories/default budget;
- user Finance, PM, Purchasing dengan temporary password;
- vendor master;
- opening inventory quantity + average cost dengan approval, movement, audit, dan reversal.

Walkthrough sekarang dimulai dari database migrated tanpa seed transaksi. Satu-satunya provisioning eksternal adalah environment secret untuk bootstrap pertama.

### P1 — Atomic project dan canonical budget — RESOLVED

Project, client opsional, canonical budget, category allocation, dan audit sekarang dibuat dalam satu transaction.

### P1 — Cost attribution stock — RESOLVED dengan inventory-funded cost

Material vendor bill untuk pembelian inventory dicatat sebagai `INVENTORY_ASSET`: payable/paid tetap terlacak tetapi actual project belum naik. Actual Material diakui oleh USE/WASTE dan dibalik oleh RETURN memakai average cost. Direct-use expense tetap menjadi actual langsung dan tidak dibebankan ulang oleh movement yang sudah terkait expense.

### P1 — Master vendor dan user management — RESOLVED

Settings Administration menyediakan create/update/activate user serta create/edit/archive vendor. Last active Owner tidak dapat dinonaktifkan. Material opening tersedia sebagai workflow terpisah dari adjustment/receipt.

### P1 — Draft planning audit — RESOLVED

Create/update/delete RAP item, category package, RAB draft row, dan generation source sekarang menulis before/after audit evidence. Approved baseline tetap immutable.

### P2 — Reallocation budget project — RESOLVED

Project Overview sekarang menyediakan editor batch transactional, total maksimal 100%, serta reason wajib untuk budget approved.

### P2 — Preventive invoice cap — RESOLVED

Create manual invoice mengunci project dan menolak total active invoice di atas current contract. Pesan recovery mengarahkan user ke Change Order.

### P2 — Maker-checker — RESOLVED

Backend menolak self-approval pada high-risk expense/vendor payment, opening inventory, stock count, Goods Receipt reversal, dan Change Order. Emergency self-approval hanya Owner, membutuhkan reason, dan menghasilkan audit action khusus.

## Penilaian go-live

- Core project/RAP/RAB, finance, inventory, dan empty-database onboarding: layak untuk full controlled UAT.
- Production financial posting tetap membutuhkan sign-off hasil walkthrough, secret/environment production, backup/monitoring, dan tidak adanya failure pada release gate.

Gunakan `financial_workflow_guide.md` sebagai acceptance runbook. Setiap checkpoint harus dicatat dengan screenshot, ID dokumen, nilai sebelum/sesudah, role aktif, dan hasil expected/actual.

Riwayat scope dan verification terdapat di `docs/plans/2026-07-16-production-readiness-implementation-roadmap.md`.
