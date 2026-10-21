# Native chrome — title, shadow, FAB spacing dan subtitle

Scope dari pengguna: title pill tanpa chevron; shadow tidak sempat terpotong kotak setelah menu topbar dismiss; FAB dekat dengan tab pill dalam row yang sama; description menu FAB muncul bersama title saat opening.

- Reuse ActionMenu dan native UIKit dock. Pertahankan native tab controller, hold/drag, minimize=never, actor permission/action catalog, header transparent dan native AI/notifikasi/profil.
- Header: pure text; pindahkan glass dari custom label ke native button style, beri overflow/shadow ruang tanpa menambah background bar.
- Dock: row compact/centered dan gap berdasarkan pill visual UIKit, bukan hanya frame controller yang mempunyai inset internal.
- Menu data: title/subtitle harus disiapkan sebelum presentation, description masuk identity cache, row size mengakomodasi keduanya. Uji opening dan dismissal lewat recording frame, bukan screenshot resting saja.
- Jika subtitle system tetap muncul terlambat, gunakan satu native multiline label untuk title+description agar lifecycle render/animation-nya sama; tidak memakai KVC/private UIKit/custom gesture.
- Satu batch implementasi, satu inspection transisi/gesture/layout, dan maksimal satu correction/confirmation. Typecheck/lint, native build/run, export. Tidak mengubah finance/material workflows.

## Hasil

- Chevron dihilangkan dari native trigger dan fallback header. Text mendapat lebar penuh yang sebelumnya ditempati chevron.
- `ActionMenu.ios` sekarang memakai `buttonStyle(glass)` milik menu, dengan overflow visible. Custom glass/shadow pada label HStack dihapus. Frame return-menu yang direkam pada 2.15/2.65 detik tidak memperlihatkan potongan shadow berbentuk kotak; material/transisi tetap native.
- Dock dipusatkan dengan maksimum lebar 312 pt. FAB tetap 64 pt dan baseline native tetap sama; gutter visual ditargetkan 8 pt dengan memperhitungkan external inset platter iOS 26. Tidak menjadikan FAB search tab atau mengubah native scrubbing/active state.
- UIKit subtitle memang muncul setelah title pada frame awal, bahkan ketika dipasok lewat initializer. Final memakai satu `UIAction.title` multiline berisi label + description; keduanya masuk satu lifecycle layout/opacity native. Native font pada kedua baris mengikuti renderer menu. Frame opening 0.75 detik memperlihatkan semua description bersama title, dibanding subtitle terpisah yang masih hilang pada 0.9 detik. Description juga masuk signature cache menu.
- Native build/run sukses; typecheck/lint, 10 mobile tests dan export iOS/Android lolos. Final dismissal regression PASS dengan glyph contrast 199.0; tidak membuka keyboard/form/route baru. Acceptance visual dilakukan pada client Atria/iOS 26.5, 402 pt; Android/physical iPhone belum diverifikasi.
- Rekaman pemeriksaan akhir dan screenshot berada di `.atria-demo/verification/2026-10-01-native-chrome/`; folder lokal/gitignored. Reuse/extend shared ActionMenu dan native dock, tanpa primitive overlay baru atau perubahan transaksi/domain.

## Center gabungan pill dan FAB

Koreksi pengguna berikutnya: jarak sudah dekat, tetapi gabungan visual belum tepat center. Controller menyisakan leading inset 20 pt di dalam frame, sedangkan sisi luar FAB tepat pada ujung frame. Akibatnya union yang terlihat bergeser 10 pt ke kanan. Pada iOS dock dengan FAB, kedua kontrol digeser setengah inset ke kiri; lebar, vertical baseline dan gap 8 pt tetap. Tanpa FAB, native bar tetap center seperti sebelumnya. Perubahan hanya geometry native; satu build dan satu screenshot confirmation.

Native build/run sukses (26 detik). Pindah ke tab Proyek sukses; screenshot simulator menunjukkan gabungan pill dan FAB berada di tengah dengan gutter tetap dekat. Bukti: `.atria-demo/verification/2026-10-01-native-chrome/centered-dock.jpg`. `git diff --check` bersih.
