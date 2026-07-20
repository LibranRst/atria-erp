# Onboarding Control Room End-to-End

## Summary

Ubah onboarding menjadi satu workspace setup yang lengkap: create/edit, review, mutasi, detail hasil, verification, approval status, dan navigation dilakukan dalam konteks onboarding tanpa meminta Owner membuka `/materials`, `/approvals`, `/ledger`, atau mengetik URL manual.

Maker-checker tetap berlaku. Owner tidak boleh menyetujui saldo awal buatannya sendiri di production. Finance Admin mendapatkan restricted **Onboarding Review**, sedangkan development dapat memakai simulasi Finance inline tanpa logout atau meninggalkan halaman onboarding.

## Implementation Changes

### 1. State machine dan navigation onboarding

- Ganti rangkaian dua Server Action step saat ini dengan satu action atomic `advanceOwnerOnboardingStep` yang memvalidasi step dan disposition menggunakan Zod, menyimpan reviewed/skipped/current step dalam satu transaksi, menulis satu audit log, dan mengembalikan step tujuan.
- Setelah mutasi berhasil, tampilkan verification snapshot aktual dan CTA tunggal **Lanjut**.
- Step saldo awal selalu dapat menuju Ringkasan. Status `PENDING_APPROVAL` membuka Ringkasan tetapi memblokir completion; `REJECTED` menampilkan alasan dan perbaikan; `SKIPPED` menjadi blocker; `POSTED` atau keputusan eksplisit “Tidak ada stok lama” dinyatakan siap.
- Semua baris Ringkasan membuka kembali step internal. Query `?step=` hanya untuk restore/reload dan bukan instruksi pengguna.

### 2. Hard completion gates

`completeOwnerOnboarding` menghitung ulang readiness server-side dan menolak completion jika fondasi inti belum siap:

- budget allocation aktif dan lima kategori canonical tersedia;
- akun aktif Finance Admin, Project Manager, dan Purchasing tersedia;
- minimal satu rekening aktif;
- minimal satu lokasi dan satu Material Master aktif;
- keputusan saldo awal final berupa minimal satu batch `POSTED` atau keputusan eksplisit “Tidak ada stok lama”;
- tidak ada batch saldo awal `PENDING_APPROVAL`.

Vendor dan Library Item & Harga bersifat opsional. Ringkasan memisahkan blocker dan warning, menonaktifkan CTA completion selama ada blocker, dan setiap blocker membuka step terkait.

### 3. Verification snapshot pada seluruh step

Tambahkan read model discriminated union `OnboardingVerificationSnapshot` yang selalu dibentuk dari data database. Snapshot mencakup default finansial, tim/vendor, rekening dan ledger saldo awal, lokasi/material, library, serta detail lengkap batch saldo awal dan dampaknya. Fakta teknis seperti record ID, movement ID, audit action, dan reference ID hanya muncul saat developer flag aktif.

Gunakan read model dan komponen canonical yang sudah ada; jangan membuat kalkulasi atau jalur mutasi onboarding terpisah.

### 4. Restricted Onboarding Review untuk Finance

- Tambahkan `/onboarding/review` khusus Finance Admin yang memiliki permission approval saldo awal.
- Surface hanya menampilkan setup approval pending, detail quantity/unit cost/subtotal/total/dokumen/pengaju/dampak mutasi, dan alasan keputusan minimal 10 karakter.
- Keputusan menggunakan `decideInventoryOpening` canonical.
- Landing Finance mengarahkan ke review hanya saat onboarding belum selesai dan ada pending setup approval.
- Setelah task habis, tampilkan success state dan CTA **Masuk Dashboard**.

### 5. Developer simulation inline

- Perluas simulation context menjadi `GENERAL` dan `ONBOARDING_SETUP_REVIEW`.
- Context onboarding hanya aktif pada environment developer, dimulai Owner, dan menargetkan Finance Admin aktif; temporary password tidak menjadi blocker.
- Owner dapat memulai simulasi dari batch pending, melakukan keputusan canonical sebagai Finance, lalu session otomatis dikembalikan ke Owner dan snapshot di-refresh.
- Start/stop tetap transactional dan menulis audit beserta context. Reload saat simulation aktif diarahkan ke restricted review dan tetap dapat kembali ke Owner.

### 6. Data persistence dan compatibility

- Tambahkan nullable `decision_reason` pada `inventory_opening_batch` melalui migration additive.
- Approval/rejection baru mengisi `decisionReason`; `rejectedReason` lama dipertahankan dan menjadi fallback untuk historical rejection.
- Historical posted tanpa alasan menampilkan copy compatibility.
- Query rekening onboarding membawa opening-balance cash transaction yang sudah ada, tanpa membuat ledger baru.
- Tidak mengubah tabel budget legacy atau membuat model inventory kedua.

### 7. UI composition dan motion

- Pertahankan satu shell onboarding `max-w-md` dengan progress, step content, verification snapshot, dan footer CTA.
- Gunakan grouped surface ber-divider dan shared BottomSheet untuk detail mutasi.
- Sediakan state pending, rejected, posted, restricted, loading, stale, partial-error, dan success dengan next action yang jelas.
- Motion hanya shared slide/fade, local disclosure, progress update, dan tap feedback; tanpa page transition atau stagger.

## Test Plan

- Unit test readiness/completion gates dan state advancement.
- Integration test atomic advancement, completion rejection, approval/rejection, decision reason, stock movement, audit, dan tidak adanya dampak kas/project cost.
- RBAC dan simulation test termasuk temporary password, restore, failure, reload recovery, dan audit actor.
- Component test verification snapshots, blocker/warning, decision detail, average cost, dan technical disclosure.
- Mobile verification 320, 360, 390, dan 430 px untuk no-stock, production approval, inline simulation, rejection/resubmit, optional skip, blocker, dan completion.
- Guide walkthrough harus selesai tanpa mengetik route manual atau membuka halaman operasional selama sesi Owner onboarding.

## Assumptions

- Onboarding state berlaku pada satu organisasi global.
- Vendor dan Library Item & Harga bukan hard requirement.
- Pending opening inventory memblokir completion.
- Production tetap membutuhkan manusia Finance berbeda; developer simulation hanya alat simulasi.
- Tidak ada email/push notification baru.
- Surface operasional permanen tetap tersedia setelah onboarding.
