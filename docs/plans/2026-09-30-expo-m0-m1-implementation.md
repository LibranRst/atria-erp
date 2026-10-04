# Implementasi awal Expo — capabilities, shell dan Dashboard

Tanggal: 30 September 2026. Acuan: [rencana parity/native controls](2026-09-30-expo-web-parity-native-controls.md).

## Status

**Implementasi dan pemeriksaan teknis tersedia. M0/M1 belum dinyatakan selesai atau siap UAT.** Dashboard Owner terautentikasi serta perbaikan menu/header/dock telah diverifikasi pada client Atria di iPhone 17 Pro/iOS 26.5 (402 pt). Parity seluruh tabs/states, rentang lebar mobile, screen readers dan Android appearance masih memerlukan verifikasi device.

Pembaruan akses: login Owner UAT dengan email yang terdokumentasi di financial_workflow_guide.md berhasil diverifikasi lewat @Browser dan client native Atria pada 30 September 2026. Akun demo lama ronald@dekoria.com ditolak karena environment aktif memakai kredensial UAT. Tidak dilakukan reset akun, seed/reset database, perubahan saldo/stok, atau bypass autentikasi. Bukti chrome dan keyboard terbaru ada pada [perbaikan floating chrome](2026-09-30-expo-floating-chrome-fix.md).

## Perubahan yang tersedia

### Permission efektif

- `screen.capabilities` memakai `activeProcedure` dan actor server. DTO hanya berisi user/role identity, permission keys dan data scope; token/session/email tidak dibawa ke UI.
- AuthProvider memakai permission dari query tersebut, dengan key per user/role/session. Tidak ada penggunaan `ROLE_PERMISSIONS` atau `actorHasPermission` seed tersisa di source mobile yang terindeks.
- Tab, biaya, project editing, approval queue, invoice/vendor modal dan notification fallback memakai permission yang sama. No-grant state memiliki recovery/sign-out; bootstrap gagal/offline memiliki recovery; server authorization failure mencabut affordance cached.
- Sign-out membuang query cache agar data akun lama tidak dibawa ke akun berikutnya. Server tetap memvalidasi setiap read dan mutation.

### Kontrak dan navigasi bersama

- Header-menu catalog dan FAB action catalog dipindahkan ke `@atria/core/navigation`, dengan re-export dari module web lama. Web tetap memakai API dan perilaku yang sama.
- Kontrak wire Dashboard dipindahkan ke `@atria/core/finance/dashboard-contracts`, dengan type re-export kompatibel dari module web. Ini menutup tipe API yang sebelumnya melewati alias `@/` web dan menjadi tidak terurai di client mobile.
- Registry destination membedakan native dan bridge web, menjaga tab/filter/project context, serta membatasi route/origin dan credential di URL. Workflow dengan konteks yang belum native tidak dialihkan diam-diam ke halaman induk.
- Notifikasi memakai registry tersebut. Tujuan RAP/Stok/filter Biaya/Rekonsiliasi sekarang mempertahankan konteks melalui bridge, sedangkan tab Dashboard dipertahankan secara native.
- Kembali dari browser memicu invalidasi query aktif. Hook navigation stabil lintas route agar provider push tidak mendaftarkan ulang device hanya karena pathname berubah.

### Native chrome dan shared UI

- `WorkspaceStack` membawa header menu, notifikasi dan profile entry. `WorkspaceFab` memakai action catalog web, permission efektif dan project locks.
- `ActionMenu.ios.tsx` menggunakan SwiftUI Menu/Button, dengan anchoring/focus/dismissal dimiliki sistem. Android/web memakai satu fallback bersama yang mempertahankan visual Atria dan native Modal back/dismissal.
- `ChromeSurface` memakai GlassView pada iOS yang mendukungnya, dengan solid fallback dan Reduce Transparency. Konten keuangan tetap solid.
- `SegmentedTabs.ios.tsx` menggunakan native segmented Picker untuk pilihan pendek tanpa badge. Strip panjang/counts tetap memakai shared RN implementation dan centering yang sudah ada. Hit region tab ditingkatkan ke 48 px; quantity controls kini setinggi 48 px.
- Reuse: `MoneyValue`, `GroupedSurface`, `FactRow`, `SummaryFact`, `MetricPill`, `BudgetSplitIndicator`, `Button`, dan native Stack/formSheet. `SummarySurface` diperluas agar summary perbandingan bisa memakai metric grid tanpa mengulang nominal focal.
- Adapter ActionMenu dan ChromeSurface baru diperlukan karena inventory mobile belum mempunyai native anchored-action-menu/material contract; konsumennya header menu dan FAB.
- Update chrome: native Stack transparent tanpa background/blur band penuh; shared judul menu floating dan judul panjang satu baris. AI kiri serta notifikasi/profil kanan kini memakai native UIKit bar-button items di iOS, dengan shared fallback Android. Tombol overflow `…` tidak dipakai; akses navigasi tetap pada menu judul, sesuai pilihan pengguna. Shared `WorkspaceBottomBar` memiliki tab pill + FAB sejajar, tetap expanded saat scroll, memakai SwiftUI `ChromeButton` di iOS. NativeTabs diganti Router Tabs agar layout mempunyai slot FAB tanpa overlap; native Stack/history tetap dipakai. Lihat rencana perbaikan untuk rationale dan bukti UI.
- Dock iOS final memakai local Expo adapter untuk **UITabBarController/UITabBarItem + UIButton/UIMenu**, bukan ChromeButton/active pill custom. Native hold/drag Dashboard → Biaya dan bar yang tidak compact saat scroll terverifikasi pada 402 pt. Regression visual menangkap glyph yang salah/tidak terbaca selama dismiss, lalu native glass button final lolos 5 loop. Lihat [handoff dock native](2026-09-30-expo-uikit-native-dock.md). Build/client native diperlukan; Android/web masih shared fallback dan belum diterima sebagai kontrol native platform.

### Dashboard dan placeholder

- Route Dashboard menjadi tipis; komposisi dipindahkan ke `features/dashboard`.
- Ringkasan sekarang memuat focal finance, setup/readiness, prioritas, proyek berisiko, jatuh tempo terdekat, perhatian material dan kas terbaru.
- Tab Budget memuat budget/aktual/sisa/margin, proyek berisiko dan kategori. Jatuh Tempo memakai due groups. Material memuat stock position, budget Material, shortages/reviews/waste/adjustments. Rekening memuat cash summary/list dan bridge tindakan. Persetujuan memuat queue/summary dan bridge keputusan.
- Header greeting/date/role, izin tab approval, visibility badge, query tab, offline/cached-refresh/partial-data feedback dan structural Dashboard skeleton telah diimplementasikan.
- Keputusan approval dan kontrol rekening **tetap bridge**, bukan mutation native baru. Material main route dan vendor/invoice shell sekarang memakai aksi nyata **Buka di web**; tidak menampilkan `Route siap` atau kesiapan statis sebagai status produk.

## Bukti pemeriksaan

| Pemeriksaan                                | Hasil                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Actual `screen.capabilities` caller tests  | 5 pass: custom role, revoke-all role bawaan, grant berubah, sesi/nonaktif, password sementara                                    |
| Compatibility/wiring tests + core purity   | Lolos dalam suite workspace                                                                                                      |
| `bun run test`                             | Core 296 pass, mobile 10 pass, web 1.040 pass / 151 skip / 0 fail; token checks lolos                                            |
| `bun run lint`                             | Seluruh workspace lolos, 0 error                                                                                                 |
| Mobile typecheck                           | Lolos, termasuk regenerasi declaration API                                                                                       |
| `bun run build`                            | Web production build lolos                                                                                                       |
| Expo export iOS dan Android                | Keduanya lolos; masing-masing satu bundle Hermes sekitar 12 MB                                                                   |
| iOS client Atria, iPhone 17 Pro/iOS 26.5    | Build/run native lolos; Owner login, Dashboard, header/FAB tanpa keyboard, scroll dock tetap expanded, detail/back dan form dismissal terverifikasi |
| Browser website                            | Login Owner UAT berhasil lewat @Browser; halaman /ledger dan seluruh section Ringkasan teramati. Full-state comparison masih terbuka |
| Android runtime                            | Belum dijalankan; export bukan verifikasi appearance/gesture                                                                     |

Tool `agent-browser`, Chrome for Testing dan `@swmansion/argent` dipasang setelah pengguna mengizinkan. Argent dapat membaca accessibility tree simulator. Instalasi Xcode di host menyediakan runtime/CLI, tetapi tidak menyediakan aplikasi Simulator GUI biasa di `Developer/Applications`; jangan mengasumsikan pengguna dapat mengetik di Simulator.app.

Log pemeriksaan berada di `/tmp/atria-expo-parity-{test,lint,build,export-ios,export-android,graft}.log`; export berada di `/tmp/atria-expo-parity-m1-{ios,android}`. Artefak `/tmp` bersifat lokal/sementara.

## Acceptance yang masih terbuka

1. Akun Owner UAT sudah diverifikasi di browser dan native; gunakan kredensial pada financial_workflow_guide.md untuk pemeriksaan berikutnya. Jangan memasukkan token ke chat atau URL, dan jangan mereset database untuk memperbaiki login.
2. Bandingkan website dan Expo menggunakan user/dataset yang sama pada Ringkasan dan seluruh peer tabs, termasuk empty/partial/error/refresh states.
3. Header/FAB menu, transparent chrome, dock, back dan form dismissal telah diperiksa pada iOS 402 pt. Lanjutkan segmented Picker, Reduce Transparency, seluruh sheet detents, permission changes/sign-out, serta tujuan bridge.
4. Periksa 320/360/390/430 px, Dynamic Type, VoiceOver/TalkBack dan Android. Lakukan satu batched inspection, satu batch perbaikan, maksimal satu confirmation round.
5. M1 tetap parsial sampai evidence tersebut tersedia. Setelah itu lanjutkan domain Proyek dari rencana aktif, dengan approval/finance/material mutations tetap reuse server use-case.

Tidak ada publish, deployment, commit, atau PR pada tahap ini. Perubahan website pada tahap ini hanya extraction/re-export kontrak bersama dan endpoint bootstrap; pekerjaan visual website yang sudah ada dipertahankan.
