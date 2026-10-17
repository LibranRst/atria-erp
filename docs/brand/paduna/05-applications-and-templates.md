# Aplikasi brand dan template

## Isi paket

- `parent/`: logo, simbol, avatar, favicon/PWA, dan share image brand induk.
- `build/` dan `office/`: lockup primary/ink/white/compact, PNG transparan, ikon web/mobile, Android layers, iOS foreground, splash, dan share image.
- `templates/`: cover proposal A4, header surat A4, cover presentasi 16:9, dan social announcement 1080 persegi, dalam SVG yang bisa diedit.
- `fonts/`: Manrope 500/700 dan lisensinya.
- `guide/`: brand book dan quick reference PDF.
- `documents/`: panduan Markdown, metadata, naming map, rollout inventory, dan sumber referensi.
- `source/`: pembangkit vektor, raster, PDF, dan pemeriksaan paket.

## Digital

**Website/share image:** gunakan logo dan descriptor sesuai produk. Share image parent menjelaskan kategori Paduna; Build menyebut biaya/material proyek; Office secara eksplisit menunjukkan status direncanakan. Jangan memakai screenshot demo sebagai bukti pelanggan.

**Aplikasi:** pada header kecil gunakan lockup compact atau Temu bersama nama produk. Ikon yang sama bisa tetap dikenal dalam mode satu warna, sehingga label Build/Office tidak boleh hanya bergantung pada warna.

**Sosial:** avatar memakai simbol, bio menjelaskan produk, dan materi announcement menyebut konteks perubahan nama setelah rollout dijalankan. Template announcement disertakan sebagai draft materi penerapan, belum berarti sudah dipublikasikan.

## Dokumen dan presentasi

Template proposal menempatkan nama produk, judul dokumen, penerima, tanggal, serta kontak sebagai teks yang dapat diedit. Placeholder memakai `{{...}}` dan harus diganti sebelum dibagikan. Logo selalu berupa vektor dan tidak diketik ulang.

Cover presentasi memakai satu logo, satu judul, dan satu penjelas pendek. Slide isi melanjutkan whitespace, divider, dan ink sebagai warna teks; terracotta dipakai secukupnya untuk fokus.

Header surat disiapkan tanpa badan hukum, alamat, NPWP, email, atau domain rekaan. Isi field tersebut hanya dari identitas organisasi yang telah ditetapkan. Paduna adalah brand; dokumen ini tidak membuat nama perusahaan legal.

RAB/proposal yang dibuat pengguna untuk klien menampilkan identitas perusahaan pengguna (misalnya Dekoria). Template pemasaran Paduna tidak menggantikan logo tenant atau membuka biaya, margin, RAP, markup, dan catatan vendor internal.

## Nama dan aksesibilitas

Alt text logo parent: “Paduna”. Untuk logo produk: “Paduna Build” atau “Paduna Office”. Jika nama lengkap sudah menjadi teks di sebelah ikon dekoratif, ikon tidak perlu diumumkan ulang oleh screen reader. Pemilihan detail ARIA mengikuti komponen yang sebenarnya saat implementasi.

Teks pada template sebaiknya tetap menjadi teks hidup untuk penyuntingan dan aksesibilitas. SVG master logo memakai outline untuk menjaga bentuk. Ekspor PDF final setelah placeholder diganti dan layout diperiksa.

## Checklist sebelum membagikan

1. Nama produk dan status fitur sesuai kenyataan.
2. Logo berasal dari master dan tidak berubah proporsi.
3. Placeholder, tanggal, kontak, dan identitas legal sudah benar.
4. Tagline kandidat tidak muncul sebagai tagline resmi.
5. Tidak ada angka/testimoni/domain rekaan atau informasi internal pelanggan.
6. Hasil ekspor diperiksa pada ukuran tujuan dan memiliki nama file yang jelas.
