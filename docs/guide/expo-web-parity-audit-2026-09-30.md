# Audit Expo terhadap website — 30 September 2026

## Kesimpulan

Expo belum siap menerima status UAT operasional yang sama dengan website. Penyebab utamanya adalah porting workflow dan hierarki halaman yang belum lengkap. NativeWind sudah aktif; mengganti styling library tidak menyelesaikan gap tersebut.

Empat tujuan navigasi global sudah mengikuti website. Native stack, form-sheet routes, autentikasi, query server, token desain, form biaya/draft/OCR, pembayaran biaya disetujui, dan create/edit identitas Proyek adalah fondasi yang perlu dipertahankan.

Audit ini membaca kode dan menjalankan pemeriksaan build. **Tidak ada penilaian visual, gesture, keyboard, VoiceOver/TalkBack, atau performance di device pada audit ini.** Bukti simulator di handoff Agustus bersifat historis, bukan verifikasi ulang September.

## Baseline dan bukti

- Referensi: website di working tree saat audit, termasuk perubahan UI yang belum di-commit. HEAD: `1b0adb177d26e21c5bb4baf465bcfaa7d767e1e0`. HEAD saja tidak merepresentasikan seluruh referensi UI tersebut; setiap unit port harus mencatat referensi terbaru yang dibandingkan.
- Expo SDK `~57.0.13`, React Native `0.86.2`, NativeWind `4.2.6`, `@expo/ui ~57.0.11`, `expo-glass-effect ~57.0.1`: `apps/mobile/package.json`.
- NativeWind memakai `withNativeWind`, Babel preset, CSS entry, dan konfigurasi Tailwind yang dihasilkan dari token web: `apps/mobile/metro.config.js:37`, `apps/mobile/babel.config.js:1`, `apps/mobile/tailwind.config.js:1`, `apps/mobile/src/app/_layout.tsx:1`.
- `bun run --filter @atria/mobile typecheck`: lolos, termasuk pretypecheck tipe API web.
- `bun run --filter @atria/mobile lint`: lolos.
- `bun run --filter @atria/mobile test`: **5 pass, 0 fail**, semuanya di `src/lib/notification-route.test.ts`. Tes ini belum menguji form, approval, shell, atau parity halaman.
- Export Metro iOS dan Android: lolos; masing-masing menghasilkan satu bundle Hermes sekitar 12 MB. Ukuran ini dicatat sebagai baseline, bukan bukti runtime lambat/cepat.
- Export: `/tmp/atria-expo-audit-2026-09-30-ios` dan `/tmp/atria-expo-audit-2026-09-30-android`.
- `xcrun simctl list devices booted`: tidak ada device booted. `argent` dan `agent-browser` tidak ditemukan melalui `command -v`; audit ini tidak memasang tooling atau mengklaim verifikasi simulator.

## Keputusan produk yang disepakati

Pengguna menerima seluruh rekomendasi Q1–Q8 dalam wawancara Grilling:

1. Struktur, urutan section, informasi, nama/urutan tab, serta konteks aksi mengikuti website. Native boleh mengganti mekanisme kontrol dan transisinya; perubahan besar perlu alasan konkret.
2. Liquid Glass ditujukan untuk navigation/control layer. Saldo, budget, margin, dan daftar operasional tetap memakai surface solid Atria.
3. Target akhir adalah seluruh workflow website; pengerjaan bertahap: shell/Dashboard → Proyek → Biaya/Persetujuan → Material → halaman pendukung.
4. Review pertama fokus Owner; status siap operasional memerlukan pemeriksaan seluruh role terkait.
5. Android memprioritaskan kemiripan visual iOS, dengan keyboard, back, accessibility, dan perilaku sistem Android tetap berfungsi.
6. Menu native yang dibuka dari FAB boleh memiliki transisi berbeda dari morph web. Posisi pemicu, isi aksi, dan konteks tetap dipertahankan.
7. Segmented control native untuk pilihan pendek yang muat; strip tab panjang/badge boleh memakai shared React Native control.
8. Workflow yang belum native dapat memakai aksi eksplisit **Buka di web** sebagai jembatan sementara. Bridge tidak dihitung sebagai workflow native selesai.

## Matriks route/workflow

Status adalah hasil inspeksi implementasi, bukan kelulusan UAT. Tidak ada persentase parity karena jumlah kontrol dan route bukan denominator yang adil.

| Website                                                                                | Expo saat ini                                           | Status parity                                   | Target                                                                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/`                                                                                    | Bootstrap home dari server + redirect                   | Fondasi ada                                     | Pertahankan routing permission/onboarding                                                                |
| `/login`                                                                               | Form login + session gate                               | Implementasi ada, runtime belum diperiksa ulang | Native keyboard/autofill/error sesuai alur web                                                           |
| `/profile/password`                                                                    | Ganti password sementara native                         | Implementasi ada                                | Pertahankan gate dan pencabutan sesi                                                                     |
| `/ledger`, seluruh tab                                                                 | Enam tab, data finance bersama, sebagian ringkasan/list | Parsial                                         | Semua section, detail, aksi, states, dan navigasi kontekstual                                            |
| `/projects`                                                                            | List/filter, masuk detail, create/edit identitas        | Parsial                                         | Hierarki dan kontrol setara web                                                                          |
| `/projects/[id]`                                                                       | Ringkasan proyek saja                                   | Parsial besar                                   | Ringkasan, Perencanaan RAP/RAB, Operasional Stok/Pengeluaran, Keuangan Pembayaran/Margin                 |
| `/expenses`                                                                            | Biaya lapangan + draft lokal                            | Parsial                                         | Workspace Kas & Tagihan beserta tab, detail, vendor bills, dan pembayaran                                |
| `/expenses/new`                                                                        | Draft, submit, OCR, kategori dan stock links            | Implementasi ada                                | Pertahankan bisnis; audit ulang kontrol, dismissal, recovery, keyboard                                   |
| Form vendor bill/invoice                                                               | `modal/vendor-bill`, `modal/invoice`                    | Placeholder                                     | Form dan mutation nyata, approval/payment states sesuai web                                              |
| `/approvals`                                                                           | Queue read-only + pembayaran biaya disetujui            | Parsial                                         | Detail dan keputusan approval sesuai permission/state                                                    |
| `/materials`                                                                           | `ProductPlaceholderScreen`                              | Placeholder                                     | Ringkasan, kebutuhan, inventori, aktivitas dan operasi stok                                              |
| `/materials/opening`                                                                   | Tidak ada layar native khusus                           | Belum port                                      | Setup stok awal, review, riwayat/batch sesuai web                                                        |
| `/onboarding`, `/onboarding/review`                                                    | Browser bridge eksplisit                                | Bridge                                          | Native penuh sebelum milestone setup dinyatakan selesai                                                  |
| `/reconciliation`                                                                      | Tidak ada layar native; notifikasi jatuh ke ledger      | Belum port                                      | Import/read, matching, exceptions, riwayat dan closing                                                   |
| `/settings`                                                                            | Tidak ada layar native                                  | Belum port                                      | Hub/default/readiness/administrasi sesuai website saat unit dikerjakan                                   |
| `/settings/budget`, `/settings/categories`, `/settings/library`, `/settings/materials` | Tidak ada layar native                                  | Belum port                                      | Pertahankan route/redirect/context web; jangan menghidupkan ulang tab legacy                             |
| `/profile`                                                                             | Hanya route password wajib tersedia                     | Belum port                                      | Profil, password pribadi, sign-out, fitur developer hanya sesuai izin                                    |
| `/notifications`                                                                       | Push registration dan routing, tanpa inbox native       | Parsial                                         | Inbox/detail, read-state, tujuan tab/detail yang tepat                                                   |
| `/ai`                                                                                  | Tidak ada layar percakapan native                       | Belum port                                      | Port Asisten AI yang sudah ada beserta permission/streaming; bukan menghidupkan kembali AI CFO Dashboard |
| `/setup`                                                                               | Tidak ada first-owner setup native                      | Belum port                                      | Explicit web bridge lalu native bootstrap sesuai alur web                                                |
| `/offline`, API/media/export endpoints                                                 | Bukan halaman ERP native mandiri                        | Beda peran platform                             | Connectivity states native; endpoint backend tetap server-side                                           |

## Temuan menurut prioritas

**13 temuan: 9 P1, 4 P2; tidak ada P0 runtime yang dapat dibuktikan tanpa menjalankan aplikasi.** P1 perlu ditutup untuk workflow terkait sebelum disebut siap UAT. P2 perlu masuk acceptance unit yang relevan.

### A1 — P1: detail Proyek kehilangan domain utama

- Bukti: `apps/mobile/src/app/(tabs)/projects/[projectId]/index.tsx:49`; web `apps/web/features/projects/detail/components/navigation/project-detail-navigation.tsx:13`.
- Dampak: Owner tidak bisa mengikuti perencanaan → eksekusi → pembayaran/margin di aplikasi, walaupun Ringkasan sudah menampilkan readiness.
- Perbaikan: ikuti domain Ringkasan/Perencanaan/Operasional/Keuangan dan child tabs web, termasuk lock budget. Reuse loader/use-case server dengan query domain yang cukup ringan. Command desain: `impeccable adapt`.

### A2 — P1: Material menampilkan kesiapan fiktif

- Bukti: `apps/mobile/src/app/(tabs)/materials/index.tsx:3`; `apps/mobile/src/components/shell/product-placeholder-screen.tsx:60` memakai nilai statis `Siap`.
- Dampak: layar yang tampak operasional tidak membawa data kebutuhan, stock, reservation, atau movement nyata.
- Perbaikan: bridge berlabel jelas selama belum diport; kemudian workspace Material sesuai web dengan kategori budget tetap menjadi konteks. Command: `impeccable clarify`, lalu `adapt`.

### A3 — P1: form vendor bill/invoice hanya route shell

- Bukti: `apps/mobile/src/app/modal/vendor-bill.tsx:7`, `apps/mobile/src/app/modal/invoice.tsx:7`, `apps/mobile/src/components/shell/planned-form-sheet.tsx:17`.
- Dampak: menu/route menjanjikan pencatatan, tetapi hanya memberi keterangan teknis `Route siap` dan tombol tutup.
- Perbaikan: explicit bridge sementara; native form + validation + transaksi server yang sama sebelum status selesai. Command: `impeccable adapt`.

### A4 — P1: Owner belum bisa memutuskan approval

- Bukti: `apps/mobile/src/app/approvals/index.tsx:170` mengarahkan keputusan ke web; pembayaran biaya disetujui sudah memakai mutation pada baris 91.
- Dampak: salah satu tugas inti Owner terputus. Queue dan pembayaran bukan pengganti approve/reject/revise.
- Perbaikan: port detail dan decision actions sesuai tipe approval, permission, state, dan alasan wajib. Pertahankan pembayaran yang sudah ada. Command: `impeccable adapt`.

### A5 — P1: Dashboard memiliki tab yang sama, isi dan aksi berbeda

- Bukti: `apps/mobile/src/app/(tabs)/ledger/index.tsx:101`; web `apps/web/features/finance-dashboard/components/workspaces/finance-dashboard.tsx:266` dan `components/tabs/tab-overview.tsx:51`.
- Dampak: Ringkasan native belum membawa preview proyek berisiko, jatuh tempo terdekat, perhatian material, perubahan kas, dan setup card yang muncul di web. Tab Budget hanya kategori; tab Rekening hanya list saldo, belum control/detail yang ada di web.
- Perbaikan: checklist section dan aksi per tab, bukan hanya judul. Sesuaikan greeting/date/role, permissions, badge visibility, data-quality/refresh feedback dan tujuan item. Command: `impeccable layout` + `adapt`.

### A6 — P1: permission shell bersumber dari seed role

- Bukti: `apps/mobile/src/providers/auth-provider.tsx:60`; `apps/mobile/src/app/(tabs)/_layout.tsx:14`; static matrix juga dipakai form/modal Biaya dan invoice. Web memakai permission efektif di `apps/web/components/layout/bottom-nav.tsx:67`.
- Dampak: custom role dapat kehilangan tab/aksi yang sebenarnya diizinkan server. Perubahan permission role bawaan juga bisa menghasilkan affordance yang salah. Ini temuan UI permission drift, bukan bukti bypass otorisasi server.
- Perbaikan: bootstrap capabilities/permission efektif dari actor server; gunakan untuk seluruh shell/action gating. Server tetap memvalidasi setiap read/mutation. Command: `impeccable harden`.

### A7 — P1: shell kehilangan menu header dan FAB kontekstual

- Bukti: mobile tabs layout mengembalikan NativeTabs saja (`apps/mobile/src/app/(tabs)/_layout.tsx:21`); web `apps/web/components/layout/header-menu-config.ts:10`, `bottom-nav.tsx:180`.
- Dampak: akses cepat ke fitur pendukung dan aksi sesuai halaman/proyek tidak mengikuti kebiasaan website.
- Perbaikan: shared native action-menu adapter, permission/context mapping, FAB dan top-bar controls; pertahankan back gesture, posisi pemicu, serta project locks. Empat destination global sendiri bukan masalah. Command: `impeccable adapt`.

### A8 — P1: halaman pendukung belum punya port native

- Bukti: inventory `apps/mobile/src/app` dibandingkan `apps/web/app` (lihat matriks). Onboarding sudah mempunyai bridge nyata, bukan form native.
- Dampak: setup, Settings, profil, rekonsiliasi, notifikasi dan Asisten AI belum dapat memenuhi seluruh workflow website di app.
- Perbaikan: daftar bridge terpusat sementara; port per domain dengan permission yang sama. Sebagian mutation profil sudah ada di `apps/web/server/trpc/routers/profile.ts:19`, sehingga jangan menganggap seluruh backend harus dibuat ulang. Command: `impeccable adapt`.

### A9 — P2: tujuan notifikasi membuang konteks

- Bukti: `apps/mobile/src/lib/notification-route.ts:9`, `:43`; tes saat ini justru mengunci pembuangan tab dan fallback rekonsiliasi.
- Dampak: pengguna tidak tiba di keputusan/tab/detail yang dimaksud payload server.
- Perbaikan: pertahankan params yang tervalidasi ketika layar tersedia; bridge eksplisit untuk tujuan yang belum native. Update test berdasarkan capabilities nyata, bukan mempertahankan fallback lama selamanya. Command: `impeccable harden`.

### A10 — P1: native-control adoption belum memenuhi brief

- Bukti: shared Button dan SegmentedTabs masih RN/Reanimated (`button.tsx:56`, `segmented-tabs.tsx:119`); `SelectionSheet` adalah RN Modal + custom rows (`finance-form-controls.tsx:84`). Pencarian import aplikasi belum menemukan penggunaan `@expo/ui`/`expo-glass-effect`.
- Dampak: instalasi paket tidak sama dengan mendapatkan menu/control/material iOS yang diharapkan pengguna.
- Perbaikan: pilih native wrapper per interaction contract. **RN TextInput sudah memakai input native**, dan Stack formSheet sudah native; jangan mengganti keduanya tanpa manfaat. Strip tab panjang tetap pengecualian yang disetujui. Appearance Liquid Glass NativeTabs belum diuji; konfigurasi background bukan bukti bahwa efek pasti gagal. Command: `impeccable adapt`.

### A11 — P2: sebagian touch target di bawah kontrak 48 px

- Bukti: tab `minHeight: 40` dengan `hitSlop: 2` (`segmented-tabs.tsx:219`) memberi tinggi efektif 44, bukan 48; quantity buttons `minHeight: 40` tanpa hit slop (`finance-form-controls.tsx:146`).
- Dampak: kontrol yang sering dipakai lebih sulit ditekan satu tangan.
- Perbaikan: ukur dan penuhi hit region 48×48 tanpa overlap antartarget; verifikasi ukuran teks besar. Command: `impeccable harden`.

### A12 — P2: loading state belum dimiliki tiap hierarki route

- Bukti: satu `ScreenSkeleton` generik berisi title/summary/group rows (`apps/mobile/src/components/ui/screen-state.tsx:6`), dipakai di beberapa route dengan struktur berbeda.
- Dampak: perpindahan dari loading ke data dapat mengubah struktur baca; tab dan header penting tidak direpresentasikan.
- Perbaikan: compose skeleton route dari shared primitives agar cocok dengan hierarchy final. Command: `impeccable layout`.

### A13 — P2: handoff lama tidak sesuai implementasi sekarang

- Bukti: handoff Agustus menyatakan tidak ada NativeWind, meskipun package/config/CSS sudah aktif. Tanda selesai di sana merupakan bukti unit historis, bukan full parity seluruh app.
- Dampak: penerus bisa mengganti fondasi yang sudah benar atau mengira app sudah lolos kriteria baru.
- Perbaikan: arah aktif dan status faktual ditulis di handoff; pertahankan catatan historis. Rencana baru menjadi acuan visual/control/urutan pengerjaan.

## Lima dimensi kualitas

| Dimensi              | Kesimpulan berbasis kode                                                                 | Yang belum dapat dinilai                                                      |
| -------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Accessibility        | Shared labels, role/state, tabular money dan reduced-motion sudah ada; A11 perlu ditutup | VoiceOver/TalkBack, fokus lintas sheet, besar teks, hit regions di device     |
| Performance          | Project list memakai FlatList; bundle baseline tercatat                                  | Startup, frame rate, gesture jank, memory; tidak diberi skor tanpa pengukuran |
| Appearance/theming   | Shared token generator + NativeWind merupakan fondasi kuat                               | Glass, density, money fit, transparency accessibility di layar nyata          |
| Platform conformance | NativeTabs/Stack/formSheet sudah ada; adoption kontrol/menu belum lengkap                | Sheet detents, keyboard, back gesture, native menus dan Android fallback      |
| Adaptivity           | Safe-area helpers ada; shared skeleton dan target size perlu diperbaiki                  | 320/360/390/430 px, text scaling, keyboard/IME dan window resize              |

Tidak ada total skor numerik: menjumlahkan performance/appearance yang belum diukur akan memberi keyakinan palsu. Light-only dan bahasa desain iOS di Android adalah keputusan produk, sehingga bukan temuan bug.

## Pekerjaan yang perlu dipertahankan

- `MoneyValue`, `GroupedSurface`, `FormSection`, `FormField`, `SummarySurface`, status labels dan token/motion bersama.
- Native navigation stack dan root ScrollView contract formSheet; jangan menambah wrapper yang menghidupkan ulang bug detent historis.
- Expense draft recovery, submit/OCR, project identity create/edit, pembayaran biaya disetujui, session gates, media signing dan push registration.
- Backend Next.js, server actor/scoping, ledger/audit, serta shared `@atria/core`; native bukan tempat DB atau formula finance tandingan.

## Tindak lanjut

Rencana aktif: [Porting Expo sesuai website dan kontrol native](../plans/2026-09-30-expo-web-parity-native-controls.md). Prioritas pertama adalah capabilities/shell dan Dashboard; setelah unit fungsional selesai, lakukan satu inspeksi visual gabungan, satu batch perbaikan, lalu konfirmasi terbatasi. `impeccable polish` adalah tahap akhir setelah parity dan interaction acceptance, bukan pengganti workflow yang belum ada.
