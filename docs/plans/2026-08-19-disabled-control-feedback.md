# Umpan balik kontrol yang dinonaktifkan

Tanggal: 2026-08-19
Status: selesai

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

## Hasil

Tahap 1 selesai: `SheetFooterActions` menonaktifkan secara lunak, alasannya
tertaut dan diumumkan, aktivasinya dijaga di primitif. Dipaku enam test dan
sudah dibuktikan menggigit — primitif versi lama menggagalkan empat di
antaranya. Ketiga puluh sembilan pemakai yang sudah ada ikut terangkat tanpa
perubahan tampilan apa pun.

Tahap 2 selesai untuk sepuluh kendali yang benar-benar membuntukan:

- rekening bank — menambah rekening hanya milik Owner, jadi tombolnya tidak
  lagi dirender mati untuk peran lain dan empty state yang menjelaskan;
- rekening terarsip — sebabnya disebut sekali per grup, menunjuk kendali
  pengaktifan yang ada di sheet yang sama;
- tujuan transfer — ternyata bukan soal izin melainkan tidak adanya rekening
  aktif lain, dan sekarang itulah yang tertulis;
- ambang alasan pada review onboarding dan penolakan budget — dulu hanya hidup
  di placeholder yang hilang begitu diketik;
- prasyarat proyek pada item expense, nilai kontrak pada termin, material pada
  stok awal, dan pengaturan alokasi yang hilang.

Dua sengaja tidak disentuh: baris inventori material bukan tombol mati
melainkan turun menjadi read-only dengan chevron ikut hilang, dan tombol kirim
chat yang redup saat kotak pesan kosong tidak perlu kalimat.

Koreksi atas angka pembuka: dari 52 komponen tanpa alasan, sebagian besar
adalah keadaan `pending` yang sudah menampilkan spinner berikut labelnya, atau
kendali batas baris yang jelas dari posisinya. Yang benar-benar membuntukan
berjumlah sekitar dua belas.

## Di luar cakupan

Lima berkas yang sedang diubah pemilik repo dan belum di-commit tidak disentuh:
`approval-list.tsx`, `approval-list-presentation.tsx`, `field-claim-rows.tsx`,
`approval-rows.tsx`, dan `dashboard-approvals-tab.tsx`. Menyentuhnya akan
menimpa pekerjaan yang sedang berjalan.

## Bukti

- Jumlah cakupan: 91 komponen dengan tombol `disabled`, 39 memberi alasan.
- Primitif bersama: `components/ui/overlay/sheet-footer-actions.tsx`,
  `components/ui/form/guided-form.tsx`.
