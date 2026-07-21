# Rencana Implementasi: Redesain Alur Pengeluaran Lapangan (Expenses List & Disbursement)

Rencana ini menjelaskan solusi untuk menyederhanakan alur pengeluaran lapangan di Atria ERP. Kami akan mengganti redundansi tab "Expenses" (yang sebelumnya sama-sama membuka formulir pengisian baru) menjadi halaman Daftar Pengajuan Biaya Lapangan yang informatif. Di halaman ini, Project Manager dapat melacak status pengajuan mereka, sementara Owner/Finance Admin dapat mencairkan dana (disburse) untuk pengajuan yang telah berstatus `APPROVED`.

---

## User Review Required

> [!IMPORTANT]
> **Pemisahan Perilaku Tab Navigasi vs FAB:**
>
> - Tab **Expenses** pada navigasi bawah akan diubah tujuannya ke `/expenses` yang memuat list pengajuan biaya.
> - Tombol melayang **FAB (+)** tetap berfungsi sebagai jalan pintas cepat untuk mencatat pengeluaran baru (`/expenses/new`).
>
> **Alur Pencairan Dana (Disbursement Flow):**
> Ketika pengajuan biaya lapangan (Field Claim) disetujui (`APPROVED`) oleh Owner, dana tidak langsung terpotong secara otomatis dari kas bank. Status pengajuan berubah menjadi `APPROVED`. Untuk melakukan pemotongan kas bank dan pencatatan ledger riil, Owner atau Finance Admin harus menekan tombol **Cairkan** pada halaman `/expenses` dan memasukkan bank pengirim serta nomor referensi transfer. Aksi ini memanggil Server Action `payFieldRequest` di dalam transaksi database yang aman.

---

## Proposed Changes

### Komponen: Kerangka Navigasi (Shell)

#### [MODIFY] [bottom-nav.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/layout/bottom-nav.tsx)

- Mengubah rute tab **Expenses** dari `/expenses/new` ke `/expenses`.
- Memastikan tab bar tetap menyorot tab aktif ketika berada di sub-halaman pengeluaran (baik `/expenses` maupun `/expenses/new`).

---

### Komponen: Formulir Input Pengeluaran

#### [MODIFY] [expense-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/expense/expense-form.tsx)

- Menambahkan pengalihan halaman (`router.push("/expenses")`) menggunakan Next.js `useRouter` setelah peng PM berhasil mengajukan biaya lapangan, menggantikan status reset form statis saat ini.

---

### Komponen: Tampilan List & Riwayat Pengeluaran (Fitur Baru)

#### [NEW] [page.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/expenses/page.tsx)

- Server Component pada rute `/expenses`:
  - Mengambil sesi pengguna aktif.
  - Membatasi kueri data:
    - Jika peran adalah `PROJECT_MANAGER`, kueri data pengajuan (`projectCost`) difilter agar hanya menampilkan miliknya sendiri (`requestedById == session.user.id`).
    - Jika peran adalah `OWNER` atau `FINANCE_ADMIN`, menampilkan seluruh data pengajuan biaya lapangan secara keseluruhan.
  - Mengambil seluruh daftar rekening bank (`bankAccount`) yang tersedia untuk keperluan opsi pencairan dana oleh Owner/Finance.
  - Merender component `<ExpenseList initialCosts={...} bankAccounts={...} userRole={...} />`.

#### [NEW] [expense-list.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/expense/expense-list.tsx)

- Client Component untuk merender daftar pengajuan pengeluaran:
  - Antarmuka didesain mengikuti kaidah **iOS 26 Solid** ( off-white background `#fcf9f8`, premium cards, JetBrains Mono font untuk angka Rupiah tabular, min-height touch targets 44px).
  - Filter status pengajuan: "Semua", "Menunggu" (`SUBMITTED`, `VERIFIED`, `PENDING`), "Disetujui" (`APPROVED`), "Lunas" (`PAID`), "Ditolak" (`REJECTED`).
  - Tampilkan metadata lengkap: Nama Proyek, Item Anggaran RAB, Deskripsi Belanja, Jumlah Nominal, Tanggal, dan PM Pengaju.
  - Thumbnail bukti nota belanja yang dapat diklik untuk memperbesar gambar (_Modal Zoom_).
  - **Opsi Aksi Interaktif:**
    - Tombol **Cairkan (Disburse)** hanya muncul jika pengajuan berstatus `APPROVED` dan peran pengguna aktif adalah `OWNER` atau `FINANCE_ADMIN`.
    - Mengklik tombol tersebut akan menampilkan dialog pop-up/bottom sheet yang bersih:
      - Menampilkan rincian pengajuan yang akan dibayar.
      - Menyediakan dropdown untuk memilih rekening bank asal (BCA Operational, Mandiri, dll.).
      - Menyediakan field input teks untuk nomor referensi bukti transfer.
      - Tombol konfirmasi pencairan yang memanggil Server Action `payFieldRequest`.
      - Tampilkan indikator loading dan penanganan pesan kesalahan/sukses secara transparan.

---

## Verification Plan

### Automated Tests

- Memastikan semua unit test saat ini tetap lulus (33/33 pass):
  `bun test`
- Memastikan tidak ada kesalahan kompilasi tipe atau build Next.js:
  `bunx tsc --noEmit && bun run build`

### Manual Verification

1. Masuk sebagai PM (`budi@dekoria.com`), buka menu **Expenses** (seharusnya kosong jika belum ada transaksi, atau menampilkan transaksi Budi). Ketuk tombol **(+)** untuk membuat pengajuan baru. Setelah disubmit, pastikan aplikasi secara otomatis mengalihkan ke daftar pengajuan `/expenses` dengan item berstatus `SUBMITTED`.
2. Masuk sebagai Owner (`ronald@dekoria.com`), buka menu **Payments**. Setujui pengajuan tersebut. Pastikan status pengajuan tersebut berubah menjadi `APPROVED`.
3. Buka menu **Expenses** sebagai Owner. Cari pengajuan yang berstatus `APPROVED`. Ketuk tombol **Cairkan**, pilih rekening bank **BCA Operational**, masukkan nomor referensi (misal: `TRF-10294`), dan tekan konfirmasi.
4. Pastikan status berubah menjadi **Lunas (PAID)**, kas pada BCA Operational terpotong secara real-time, dan ledger mencatat mutasi `CREDIT` lunas secara otomatis.
