# Rencana Implementasi: Redesain UI Add Expense (iOS Slide-Up Drawer)

Rencana ini menjelaskan pembaruan antarmuka (UI/UX) untuk form **Add Expense** agar menggunakan desain premium haptic-tactile, dikonversi dari halaman penuh biasa menjadi laci geser ke atas (_slide-up drawer_) mirip aplikasi native iOS, dengan tetap mempertahankan seluruh fitur fungsionalitas pengeluaran multi-item, unggah ImageKit, dan AI OCR yang telah dibuat.

## User Review Required

> [!IMPORTANT]
> Halaman `/expenses/new` akan bertindak sebagai entry point yang merender laci transisi geser ke atas (_slide-up drawer_) di atas backdrop transparan dan latar belakang kabur (_backdrop-blur_).
> Saat tombol tutup ("X") atau area luar laci diklik, aplikasi akan mengarahkan pengguna kembali ke halaman sebelumnya (`router.back()`).

## Proposed Changes

### Komponen: Antarmuka UI (User Interface)

---

#### [MODIFY] [expense-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/expense/expense-form.tsx)

- **iOS Drawer Wrapper**:
  - Bungkus form pengeluaran dengan dua lapisan:
    1.  Backdrop semi-transparan (`fixed inset-0 bg-black/40 backdrop-blur-sm z-90`) dengan efek _fade-in_.
    2.  Laci Kontainer (`fixed inset-x-0 bottom-0 top-0 sm:top-12 sm:max-w-md sm:mx-auto bg-background z-100 flex flex-col rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out border border-outline-variant/30`) dengan efek _slide-up_ (menggunakan state `isOpen` di React dan efek `useEffect` untuk mengubah class `translate-y-full` menjadi `translate-y-0`).
- **Amount Section**:
  - Gunakan gaya teks numeral berukuran besar di bagian atas untuk menampilkan **Total Nominal Nota** (penjumlahan otomatis dari seluruh baris item).
- **Project & Documentation Section**:
  - Terapkan gaya input dan tombol unggah berkas bertipe tactile border sesuai dengan desain HTML yang disukai pengguna.
- **Multi-Item Lines**:
  - Setiap baris item belanja BoQ (Item Anggaran, Nominal, Deskripsi) akan dibungkus ke dalam kartu premium (`premium-card`) dengan styling bersih, border halus, dan tombol hapus berbentuk ikon tempat sampah di sudut kanan atas kartu.
- **Sticky Action Button**:
  - Tombol "Simpan & Ajukan Pengeluaran" diletakkan melayang secara statis di bagian bawah laci dengan gradasi transparan di atas konten formulir.

## Verification Plan

### Automated Tests

- Jalankan test suite untuk memastikan tidak ada kesalahan fungsi Server Action:
  `bun test`
- Verifikasi kebersihan tipe TypeScript dan build produksi:
  `bun run build`

### Manual Verification

1.  Jalankan server pengembangan: `npm run dev`.
2.  Buka menu pengeluaran atau klik tombol Floating Action Button (FAB) "+".
3.  Pastikan form meluncur dari bawah dengan animasi _slide-up_ yang halus mirip aplikasi iOS.
4.  Coba tambah beberapa baris detail item anggaran proyek, verifikasi nominal total terhitung otomatis di bagian atas form.
5.  Klik area luar laci atau tombol silang di pojok kiri atas, pastikan laci menutup dan pengguna kembali ke halaman sebelumnya.
