# Rework Material & Stock dengan Design Language Atria

## Tujuan

Menyelaraskan `/materials` dengan bahasa desain aktif Dashboard, Expenses, Approvals, dan Projects tanpa mengubah data, permission, action, audit log, stock calculation, atau workflow material yang sudah berjalan.

## Temuan Audit

- Data dan operasi sudah lengkap: stock posture, shortage RAP, lokasi, penerimaan, transfer, stock opname, reversal, adjustment, movement, dan detail material.
- Ringkasan masih memakai grid KPI generik dan campuran istilah Inggris sehingga hierarchy posisi stock belum langsung terbaca.
- Inventori menumpuk search dan dua filter row di dalam card sticky besar; setiap material memakai card mandiri dengan progress bar generik.
- Kebutuhan sudah dikelompokkan per project tetapi summary dan rows masih nested-card heavy serta memakai copy campuran.
- Aktivitas memisahkan receipt, movement, transfer, dan count ke banyak pola card; hubungan kronologis dan audit trail belum kuat.
- Loading route masih menggunakan loading generik dan tidak mencerminkan struktur Material & Stock.
- Restricted state pada route berupa card error ad hoc, belum memakai grammar state aplikasi.
- Sheet dan mutation sudah menjaga transaction, permission, audit, validation, recovery, serta confirmation; logic ini harus dipertahankan.

## Struktur Baru

### Shell dan Navigasi

- Pertahankan `PageHeader`, shell `max-w-md`, top bar, bottom navigation, FAB, safe area, dan query `?tab=`.
- Pertahankan urutan `Ringkasan`, `Inventori`, `Kebutuhan`, `Aktivitas`.
- Gunakan `SegmentedTabs` compact dengan badge hanya untuk shortage/low stock yang actionable.
- Jadikan tab surface sticky dengan treatment yang konsisten dengan Projects/Approvals: inline saat awal, soft white floating surface ketika sticky, tanpa animasi konten tab atau vertical scroll jump.
- Gunakan Bahasa Indonesia konsisten pada seluruh main surface.

### Ringkasan

- Buat satu focal stock posture berisi nilai stock, nilai siap dipakai, reserved, dan rasio ketersediaan.
- Letakkan perhatian utama sesudahnya: shortage RAP, stok minimum, dan keputusan tertunda, maksimal tiga row.
- Keputusan stock opname/reversal tetap memakai action dan confirmation yang sudah ada, tetapi ditampilkan sebagai grouped decision queue.
- Aktivitas terbaru menjadi grouped ledger rows dengan divider dan tautan ke tab Aktivitas.
- Empty state menjelaskan kondisi terkendali tanpa card dekoratif.

### Inventori

- Gunakan satu baris mode pencarian/filter yang compact dan sticky di dalam konteks tab, tidak menumpuk tiga container besar.
- Pertahankan filter lokasi dan status serta seluruh derived filtering yang ada.
- Tampilkan material sebagai grouped list surface dengan row interaktif, bukan card besar per item.
- Row menunjukkan nama, kategori/spec utama, tersedia vs reserved/minimum, lokasi, nilai stock, dan status eksplisit.
- Ganti progress bar generik dengan stock availability comparison yang hanya dipakai saat perbandingan tersedia/reserved/minimum bermakna.
- Detail material tetap dibuka lewat sheet existing.

### Kebutuhan

- Tampilkan portfolio shortage summary terlebih dahulu: project terdampak, material kurang, quantity gap, dan estimasi biaya.
- Group per project tetap dipertahankan, dengan project header dan compact shortage rows memakai divider.
- Setiap row memprioritaskan quantity kurang, kebutuhan vs tersedia, estimasi, area, dan unit.
- CTA tetap menuju RAP Project; tidak menambahkan purchasing mutation baru.

### Aktivitas

- Jadikan filter lebih ringkas dan terpisah dari activity content.
- Gabungkan penerimaan, movement, transfer, dan count dalam grammar audit timeline/grouped ledger yang konsisten, tetapi pertahankan aksi detail receipt dan load more.
- Gunakan label Bahasa Indonesia untuk tipe movement dan status.
- Timeline connector hanya dipakai jika benar-benar menunjukkan urutan waktu dan menggantikan divider horizontal.

### State, Loading, dan Sheet

- Ganti `app/materials/loading.tsx` dengan skeleton khusus: header, sticky tabs, stock posture, attention rows, dan activity rows.
- Selaraskan restricted/error/empty/no-result/pending/success state dengan shared application primitives.
- Pertahankan seluruh field, validasi, draft recovery, confirmation, success feedback, keyboard handling, dan server action pada operation sheets.
- Polish presentation sheet/primitives hanya bila diperlukan untuk Bahasa Indonesia, grouped rows, touch target 48 px, radius, dan overflow safety.

## Batasan

- Tidak mengubah schema, DTO publik, query contract, server action, stock calculation, permission, transaction, audit behavior, atau URL operasi.
- Tidak mengubah Material budget menjadi inventory-only workflow.
- Tidak menambahkan dummy data, chart, gradient dekoratif, inline stock mutation, atau fitur purchasing baru.
- Tidak mengubah Settings Material Master sebagai source of truth.

## Pengujian dan Verifikasi

- Tambahkan presentation tests untuk focal summary, attention priority, inventory status/copy, shortage grouping, activity labels, dan Owner/Purchasing/Finance capability visibility.
- Pertahankan unit test stock impact, stock count variance, grouping, dan filters.
- Browser-check Owner pada 320, 360, 390, dan 430 px untuk seluruh tab.
- Pastikan nominal dan quantity tidak wrap/overflow, tab/filter tidak menggeser document secara vertikal, touch target efektif 48 px, focus label benar, reduced motion dipatuhi, serta bottom nav clearance aman.
- Verifikasi detail material, receipt detail, reversal, stock count approval/reject, receive, reserve/use/return/waste, transfer, count, adjustment, load more, dan success/error behavior tetap terhubung.
- Jalankan TypeScript, ESLint, relevant Bun tests, seluruh test suite, production build, dan browser console check.

## Urutan Eksekusi

1. Tambahkan primitives khusus Material untuk focal surface, section header, grouped surface, stock comparison, dan rows.
2. Rework shell/navigation Material.
3. Rework Ringkasan, Inventori, Kebutuhan, dan Aktivitas.
4. Selaraskan loading dan restricted state.
5. Polish sheet-facing shared primitives tanpa mengubah logic.
6. Tambahkan tests dan lakukan browser serta build verification.
