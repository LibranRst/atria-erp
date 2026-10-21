# Expo — menu tanpa keyboard dan chrome floating

30 September 2026. Scope: perbaikan keyboard ketika membuka menu, susunan/floating topbar, FAB sejajar bottom bar, dan bottom bar yang tetap expanded saat scroll.

**Acuan dock terbaru:** [dock UIKit native](2026-09-30-expo-uikit-native-dock.md). Bagian ChromeButton/expanded custom bar di bawah merupakan iterasi sebelumnya; final iOS memakai UITabBarController native dan UIButton/UIMenu, sesuai koreksi pengguna. Header floating yang dipilih pengguna tetap dipertahankan.

## Bukti sebelum perubahan

- Simulator iPhone 17 Pro/iOS 26.5 sudah login Owner UAT.
- Sentuhan fisik pada FAB menampilkan context menu dan keyboard (`space`, `Return`, `Next keyboard` ada di accessibility tree).
- `bun apps/mobile/scripts/check-menu-keyboard.ts --udid F23B09C8-A70B-4957-BE7F-D236BD64D15B` sudah dijalankan: **FAIL: membuka menu menampilkan keyboard**.
- Topbar menaruh notifikasi di kiri dan profile di kanan, berbeda dari web: AI di kiri, notifikasi + avatar di kanan. Native Stack memakai canvas opaque dan tidak transparent.
- FAB dimiliki setiap halaman dan diletakkan di atas tab bar; native tabs memakai `minimizeBehavior=onScrollDown`.

## Dugaan yang diuji

1. Interop RNHostView pada label SwiftUI Menu memicu focus/responder keyboard. Prediksi: label SwiftUI murni menghilangkan keyboard, menu tetap native.
2. Fokus login tertinggal setelah navigasi. Prediksi: restart ke sesi tersimpan tetap gagal untuk dugaan 1, tetapi menghilangkan bug untuk dugaan 2.
3. Sentuhan melewati trigger interop dan mengenai view selectable. Prediksi: trigger SwiftUI murni menyerap sentuhan tanpa memilih text di belakang.

Uji satu variabel pada menu lebih dulu. Jangan menjadikan Keyboard.dismiss sebagai satu-satunya perbaikan tanpa menghilangkan sumber focus.

## Implementasi

- Reuse shared ActionMenu, ChromeSurface, role navigation dan action catalog. Tambahkan semantic native trigger props sehingga iOS tidak perlu RNHostView di label Menu.
- Topbar transparent tanpa background penuh; AI di kiri, notifikasi + avatar di kanan. Native Stack tetap mengelola back/history/gesture.
- FAB dan tab bar mempunyai satu owning layout di shell, dengan safe-area dan bar height yang sama. Hapus page-local FAB positioning.
- SDK 57 NativeTabs tidak menyediakan slot sidecar FAB atau pengaturan lebar floating pill. Untuk memenuhi susunan sejajar tanpa overlap, gunakan Expo Router tabs dengan satu shared custom bottom chrome; native SwiftUI buttons/menu serta native GlassView tetap dipakai pada iOS. Android memakai grammar Atria yang sama. Jangan memaksakan FAB sebagai search tab.
- Bottom chrome selalu expanded dan tidak terkait scroll position; sembunyikan ketika keyboard form benar-benar terbuka agar tidak menimpa input.
- Layout nav + FAB dipusatkan seperti web; semua target 48 px, FAB 56 px, foreground active ink/white, tidak ada severity rail atau glow baru.

## Gerbang

1. Loop keyboard berubah merah → hijau untuk menu header dan FAB.
2. Capture screenshot atas + scrolled + menu terbuka; pastikan header tidak membentuk wall, FAB/tab bar sejajar dan bar tidak compact.
3. Cek perpindahan tab, detail/back, peer tab scroll position, dan modal form.
4. Mobile typecheck/lint/tests dan export iOS/Android. Screenshot iOS adalah bukti runtime; export Android bukan bukti appearance Android.

Tidak mengubah finance/material mutations atau desain website.

## Hasil diagnosis dan verifikasi

- Mengganti RNHostView dengan label SwiftUI murni saja **tidak** menutup reproduksi di Expo Go. Dugaan pertama bukan penjelasan tunggal. Fokus input login kini dilepas sebelum transisi autentikasi, label menu sepenuhnya native, dan pemeriksaan akhir memakai client Atria hasil build workspace iOS dengan dependency native tersinkron.
- Gejala Menu/Picker yang memunculkan keyboard setelah TextInput di simulator juga dilaporkan pada [Expo #47343](https://github.com/expo/expo/issues/47343). Bukti di bawah hanya menyatakan hasil client Atria; tidak menyatakan bug Expo Go upstream sudah diperbaiki.
- `ActionMenu` dan `ChromeSurface` diperluas/dipakai bersama. `ChromeButton` ditambahkan sebagai adapter SwiftUI Button untuk kontrol shell, dengan fallback RN pada Android. Header memakai native Stack transparent; AI di kiri, menu judul di tengah, notifikasi dan avatar di kanan. Judul panjang satu baris dengan truncation; accessibility label tetap lengkap.
- `WorkspaceBottomBar` sekarang memiliki seluruh tab pill dan FAB dalam satu row, tanpa ownership/positioning per halaman atau minimization berdasarkan scroll. Native stack back dan tab history dipertahankan.
- iPhone 17 Pro/iOS 26.5, lebar 402 pt: Owner UAT login dengan keyboard sungguhan, Dashboard tampil. Script UI berubah FAIL menjadi PASS untuk header dan FAB. Diulang setelah membuka form biaya, memfokuskan input, dan menutup sheet lewat grabber: **kedua menu tetap PASS tanpa keyboard**. Form tidak diisi/disubmit.
- Scroll Dashboard sampai 43%: topbar tidak mempunyai background penuh; konten terlihat di belakang kontrol. Bounds tab pill dan FAB sama sebelum/sesudah scroll: y=0.897, height=0.064 (normalized). Semua tab tetap terlihat dan ukurannya tidak compact.
- Perpindahan Dashboard → Proyek → detail proyek → native Back → Dashboard berhasil. Judul panjang di detail terpotong satu baris dan tidak menggeser kontrol. Native form dari FAB berhasil dibuka/dismiss tanpa mutation finance/material.
- Mobile typecheck dan lint lolos; suite mobile **10 pass / 0 fail**; export akhir iOS dan Android lolos. Android appearance/gesture, physical iPhone, VoiceOver/TalkBack, Dynamic Type dan seluruh lebar 320–430 belum menjadi bukti runtime tahap ini.

Pemeriksaan UI nyata (menu harus tertutup sebelum setiap run):

```sh
bun apps/mobile/scripts/check-menu-keyboard.ts --udid <simulator-id> --label "Menu halaman Dashboard"
bun apps/mobile/scripts/check-menu-keyboard.ts --udid <simulator-id>
```

Screenshot lokal tersimpan di `.atria-demo/verification/floating-chrome-2026-09-30/`: `dashboard-top.jpg`, `dashboard-scrolled.jpg`, `fab-menu.jpg`, `header-menu-after-form.jpg`, `project-detail.jpg`. Artefak ini gitignored. Export akhir: `/tmp/atria-floating-chrome-final-{ios,android}`; log memakai path yang sama dengan `.log`.

## Dukungan build lokal

Build iOS pada path repo yang mempunyai spasi gagal pada EXConstants: basename dan script-phase invocation belum mengutip path. Patch terbatas `patches/expo-constants@57.0.11.patch` memperbaiki dua lokasi tersebut. `patchedDependencies` dipin ke versi saat ini; tidak ada upgrade SDK/dependency. Hook `preios` menjalankan helper idempotent versi 57.0.11 karena Bun dapat mempertahankan peer-context copy yang lama. `pod update EXConstants --no-repo-update` menyinkronkan script phase; build/run workspace kemudian berhasil. DerivedData pemeriksaan berada di `.atria-demo/native-builds/floating-chrome/` pada SSD.

M0/M1 tetap parsial untuk parity seluruh halaman/platform. Empat masalah chrome yang diminta sudah diperbaiki dan terverifikasi pada client Atria di simulator iOS tersebut.

## Arah final — floating navigation dengan actions native

Pengguna menyukai native buttons AI/notifikasi, tetapi secara eksplisit memilih menu judul floating sebelumnya dan profile entry langsung. Kemiripan fungsi/identitas tetap; platform memiliki material dan geometry action buttons.

- Header tetap transparent, `headerBlurEffect=none`, background transparent, shadow dimatikan. Top scroll-edge effect dimatikan agar tidak muncul band blur penuh saat scroll. Tidak menambahkan background/material pada seluruh bar.
- Navigasi tetap di shared `ActionMenu` pada judul floating, memakai label dan menu SwiftUI. Judul panjang satu baris; tidak memindahkan navigasi ke overflow.
- iOS action buttons AI/notifikasi/profil memakai native bar-button items Expo Router: system Liquid Glass, spacing dan gesture dimiliki UIKit, tanpa SwiftUI Host/custom material per glyph. Tombol `…` diganti profile (`person.crop.circle`), yang membuka route profil melalui destination registry yang sama.
- AI tetap langsung di root; di detail native Back menjadi leading control dan AI tersedia dari menu. Android memakai shared fallback dengan akses yang sama.
- Dock/FAB yang telah diverifikasi tetap sejajar dan expanded. Tidak membuat primitive baru atau mengubah finance/material workflow.
- Verifikasi dibatasi pada atas/scroll/detail/menu, typecheck/lint dan keyboard regression; Android runtime tetap terbuka.

Hasil arah final: pada client Atria/iOS 26.5, menu judul dan FAB kembali PASS tanpa keyboard. Capture atas dan scrolled menunjukkan tanpa wall/background strip penuh, title menu tetap terbaca pada materialnya sendiri, dan profile menggantikan overflow di native right actions. Typecheck/lint dan export final seluruh platform lolos; suite mobile 10 pass. Screenshot: `.atria-demo/verification/floating-chrome-2026-09-30/native-actions-{top,scrolled}.jpg`. Android runtime belum diperiksa.

## Bottom bar expanded — tindak lanjut

Pengguna meminta perbaikan bottom bar sesuai request awal. Bar saat ini tidak mengecil berdasarkan scroll, tetapi selalu berupa strip ikon tanpa label, sehingga tampak sebagai compact mode.

- Perluas shared `ChromeButton` agar tab mempunyai ikon + label permanen; gunakan SwiftUI Button/VStack pada iOS dan shared RN fallback Android. Header controls tetap menggunakan kontrak lama tanpa label.
- Tab bar dan native menu FAB memakai owning row dan tinggi yang sama (64 pt). Lebar tab mengikuti ruang viewport, maksimal tiga tab dari katalog permission; harus muat pada 320–430 pt.
- Bottom bar tidak membaca scroll offset dan tidak mempunyai mode compact. Tidak menggunakan role search untuk menyamarkan FAB sebagai tab.
- Satukan clearance konten pada konstanta tinggi bar supaya bar expanded tidak menutup konten paling bawah. Pertahankan native stack/history dan permission/project-lock action catalog.
- Bukti UI: label tetap terlihat dan bounds bar/FAB sama setelah scroll; tap tab dan menu FAB tetap bekerja tanpa keyboard. Typecheck/lint/tests dan export native; satu inspection + maksimal satu correction/confirmation. Tidak mengubah topbar atau transaksi domain.

Hasil implementasi bottom bar:

- Shared `ChromeButton` diperluas dengan `showLabel`: ikon SF Symbol dan label caption native dalam SwiftUI VStack/Button. Active symbols memakai varian filled; Dashboard memakai grid seperti identitas navigasi web. Android memakai label Bahasa Indonesia dan role tab pada shared RN fallback. Kontrol lain tetap tidak menampilkan label secara default.
- Bar dan FAB sama-sama 64 pt. Tiga tab mengambil lebar berdasarkan viewport dengan batas 48–76 pt; row tetap center dan menjaga margin 20 pt. Perhitungan layout muat pada 320/360/390/430 pt (row 279/312/312/312 pt); ini pemeriksaan geometry, bukan screenshot semua ukuran.
- `TAB_BAR_CLEARANCE=80` dipakai Dashboard, Proyek, detail proyek, Kas & Tagihan dan bridge screens. Clearance mengikuti konstanta tinggi bar dan spacing, menggantikan offset 72 yang terpisah.
- Runtime client Atria, iPhone 17 Pro/iOS 26.5 (402 pt): label Dashboard/Proyek/Biaya terlihat. Sebelum/sesudah scroll, bounds bar tetap `(0.112,0.888,0.587,0.073)`; FAB `(0.729,0.888,0.159,0.073)`. Top dan height keduanya sama. Tidak ada compact state atau ketergantungan scroll.
- Tap Dashboard → Proyek → Biaya berhasil dan active tab berpindah. Menu FAB PASS tanpa keyboard pada Kas & Tagihan. Tidak ada form submit atau mutation domain.
- Typecheck/lint lolos, mobile 10 pass / 0 fail, export iOS dan Android lolos. Android appearance belum menjadi bukti runtime. Screenshot lokal: `.atria-demo/verification/floating-chrome-2026-09-30/expanded-bar-{top,scrolled,projects,menu}.jpg`; export `/tmp/atria-expanded-bar-{ios,android}`.
