# Umpan balik kontrol yang dinonaktifkan

Tanggal: 2026-08-19
Status: dalam pengerjaan

## Masalah

Dari 91 komponen `features/**` yang merender tombol `disabled`, hanya 39 yang
memberi tahu alasannya. Sisanya menampilkan tombol mati tanpa penjelasan: PM di
lapangan menekan, tidak terjadi apa-apa, dan tidak ada yang menyebutkan apa yang
kurang.

Ini bukan tebakan soal prioritas. Dari sembilan belas cacat yang ditemukan
selama verifikasi dua runbook, porsi terbesar bukan salah hitung — melainkan
penjagaan yang menolak tanpa memberi tahu alasannya. Aritmetika buku besarnya
tidak pernah sekali pun keliru.

## Temuan yang lebih dalam

Pola `disabledReason` sudah ada dan dipakai 39 tempat, tetapi **primitif
bersamanya sendiri belum dapat diakses**. Di
`components/ui/overlay/sheet-footer-actions.tsx`, alasannya dirender sebagai
`<p>` biasa tanpa kaitan apa pun ke tombolnya, sementara tombolnya memakai
atribut `disabled` bawaan HTML. Akibatnya, bagi pengguna keyboard dan pembaca
layar:

1. tombolnya keluar dari urutan fokus — mereka menyusuri sheet, sampai di ujung,
   dan tombol kirimnya sekadar tidak ada;
2. alasannya tidak tertaut lewat `aria-describedby`, jadi tidak pernah
   dibacakan bersama tombolnya;
3. ketika alasannya **berubah** — misalnya dari "Isi nominal" menjadi "Audit note
   minimal 10 karakter" setelah satu field diisi — tidak ada yang mengumumkan
   perubahan itu.

`PRODUCT.md` mengikat produk ini pada label pembaca layar dan fokus keyboard yang
terlihat; `DESIGN.md` melarang meninggalkan kontrol tanpa nama yang dapat
diakses. Jadi memperbaiki primitifnya lebih bernilai daripada menyebar prop ke
47 tempat, dan sekaligus membuat 39 pemakai yang sudah ada ikut benar.

## Rencana

### Tahap 1 — perbaiki primitifnya

Ketika sebuah alasan diberikan, tombolnya menjadi **dinonaktifkan secara lunak**:

- `aria-disabled="true"` menggantikan atribut `disabled`, sehingga tombolnya
  tetap dapat difokus dan tetap diumumkan;
- aktivasinya dijaga di primitif — klik tidak melakukan apa pun, dan `type`
  tidak boleh `submit` selagi terblokir, supaya form tidak ikut terkirim;
- alasannya mendapat `id` dan tertaut lewat `aria-describedby`;
- alasannya hidup di dalam live region sopan, sehingga perubahannya diumumkan;
- tampilannya tidak berubah sama sekali — kelas peredupan yang sama berlaku
  lewat varian `aria-disabled:`.

`Button` hanya perlu satu perubahan: mengenali `aria-disabled` sebagai pemicu
gaya nonaktif, selain atribut `disabled`. Sisanya mengalir lewat props yang
sudah tersebar.

### Tahap 2 — sebarkan alasannya

Menambahkan `disabledReason` pada komponen yang belum punya, didahulukan yang
dilewati kedua runbook. Copy-nya mengikuti `clarify`: menyebut apa yang kurang
dan apa langkah berikutnya, bukan menyalahkan; bahasa Indonesia, sesuai
sekitarnya.

## Di luar cakupan

Lima berkas yang sedang diubah pemilik repo dan belum di-commit tidak disentuh:
`approval-list.tsx`, `approval-list-presentation.tsx`, `field-claim-rows.tsx`,
`approval-rows.tsx`, dan `dashboard-approvals-tab.tsx`. Menyentuhnya akan
menimpa pekerjaan yang sedang berjalan.

## Bukti

- Jumlah cakupan: 91 komponen dengan tombol `disabled`, 39 memberi alasan.
- Primitif bersama: `components/ui/overlay/sheet-footer-actions.tsx`,
  `components/ui/form/guided-form.tsx`.
