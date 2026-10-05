# Porting Expo sesuai website dan kontrol native

Tanggal: 30 September 2026 (Asia/Jakarta).

Status: **arah Q1–Q8 disepakati pengguna; implementasi awal M0/M1 tersedia dan gerbang teknis lolos; verifikasi device terautentikasi masih terbuka**. Bukti dan batas: [handoff implementasi M0/M1](2026-09-30-expo-m0-m1-implementation.md). M0/M1 belum dinyatakan selesai atau siap UAT.

Audit sumber: [Expo web parity](../guide/expo-web-parity-audit-2026-09-30.md).

## Hasil yang dituju

Pengguna yang sudah mengenal website Atria menemukan informasi, tab, urutan section, dan aksi yang sama di aplikasi. iOS memakai navigation/controls native yang meningkatkan interaksi dan mendukung Liquid Glass. Android mempertahankan komposisi iOS/Atria sedekat mungkin sambil menghormati back, keyboard/IME, accessibility dan perilaku sistemnya.

Website working tree adalah incumbent visual truth. `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` dan shared web UI tetap sumber grammar konten. Keputusan pengguna pada audit ini memberi pengecualian khusus **chrome/control native** untuk Liquid Glass dan system typography/control styling; tidak mengubah desain website atau menambah glass pada kartu finance.

Rencana ini memperbarui prioritas visual/control dan urutan kerja handoff Agustus. Unit server dari [Wave 2–3](2026-08-15-expo-native-phase-2-3-screens.md) tetap berguna sebagai worklist domain; tanda selesai historis tidak menggantikan acceptance baru. Tidak ada rewrite menyeluruh, SDK upgrade, migrasi NativeWind v5, atau perpindahan backend dalam scope ini.

## Kontrak parity

- Pertahankan nama, urutan, badge semantics, permission, project locks, content grouping, focal value, category context dan tujuan aksi website.
- Native boleh mengganti mekanisme picker/menu/sheet/transisi. Default large title atau penempatan action berbeda tidak otomatis dibenarkan hanya karena native.
- Empat tab global mengikuti role-navigation bersama. Perbedaan tab detail Proyek harus ditutup, bukan diselesaikan dengan menambah top-level tabs.
- Glass terbatas pada chrome/controls yang mendukungnya. Saldo/budget/margin/list tetap solid, tabular, dan mudah dibaca.
- Bridge berlabel **Buka di web** diizinkan selama migrasi, tetapi tidak memenuhi status native workflow selesai.
- Review Owner per unit adalah review perkembangan. Kandidat UAT Owner harus memiliki workflow yang diklaim selesai beserta bukti perangkat. Siap operasional mensyaratkan role terkait dan scope server.

## Pemilihan kontrol dan ownership

Semua platform adapter berada di `apps/mobile/src/components/ui` atau shared shell, bukan di feature/route. Inspeksi inventory web dan mobile sebelum penambahan; pertahankan public API yang sudah dipakai bila memungkinkan. File `.ios.tsx`/`.android.tsx` ditempatkan di luar `src/app` dengan fallback yang valid.

| Interaksi                             | iOS                                                                                                      | Android                                                                                        | Reuse/extend                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Navigation hierarchy/back             | Expo Router native Stack                                                                                 | Native Stack/back behavior Android                                                             | Pertahankan root dan tab stacks                                                                      |
| Bottom bar                            | NativeTabs + sistem Liquid Glass jika tersedia                                                           | Evaluasi styled native bar; shared iOS-like bar hanya jika native styling tidak memenuhi brief | Pertahankan destination/config role bersama, jangan duplikasi routing                                |
| Top bar/header actions                | Native header/toolbar controls; adapter untuk judul/menu khas Atria bila diperlukan                      | Atria capsule/header adapter dengan native navigation/back tetap dimiliki Stack                | Shared shell baru hanya untuk contract header yang belum ada                                         |
| Header action menu/FAB                | Menu native yang anchored ke pemicu; SF Symbols/glass sesuai dukungan API                                | Shared Atria action menu yang mempertahankan posisi dan informasi                              | Shared ActionMenu adapter, dipakai header dan FAB; tidak ada feature-local modal/menu infrastructure |
| Form multi-field/detail               | Native Stack formSheet; `@expo/ui` sheet untuk konteks non-route jika cocok                              | Native screen/sheet behavior dengan isi Atria                                                  | Extend `BottomSheet`/`WorkflowFormSheet`, pertahankan detent/ScrollView contract                     |
| Local segmented 2–3 pilihan yang muat | Native Picker segmented jika sesuai label/state                                                          | Shared capsule control gaya Atria                                                              | Extend `SegmentedTabs` dengan adapter yang menjaga onChange/value semantics                          |
| Strip tab panjang/counts              | Shared RN scrollable strip                                                                               | Shared RN scrollable strip                                                                     | Reuse `SegmentedTabs`; perbaiki target 48px; horizontal centering tidak mengubah scroll vertikal     |
| Simple choice/menu                    | Native Picker/Menu                                                                                       | Native interaction yang dapat ditheme Atria, atau shared iOS-style selection                   | Extend `SheetSelect`/selection facade; jangan otomatis gunakan modal besar                           |
| Searchable/create selection           | Sheet/dialog berisi search dan list yang tepat                                                           | Komposisi Atria dengan input native                                                            | Reuse selection contracts; virtualisasi dataset besar                                                |
| Text input/money                      | RN TextInput tetap valid native UIKit; SwiftUI jika memberikan manfaat tanpa mengganggu controlled input | RN TextInput native + styling Atria                                                            | Reuse `TextInput`, `MoneyInput`, FormSection; pertahankan cursor/mask/autofill/error                 |
| Date/time                             | Native date/time picker melalui API kompatibel SDK                                                       | Native date/keyboard semantics; Atria trigger                                                  | Reuse wrapper date field, audit picker installed sebelum mengganti package                           |
| Button                                | SwiftUI/system button untuk chrome dan action yang cocok; ink-primary commit tetap punya hierarchy Atria | Shared capsule button Atria                                                                    | Extend `Button` melalui adapter, preserve loading/disabled/a11y                                      |
| Switch/slider/stepper                 | `@expo/ui` native bila contract tersedia                                                                 | Native yang dapat ditheme atau shared equivalent sesuai prioritas iOS visual                   | Shared controls, preserve explicit user action                                                       |
| Confirm/destructive/success           | Native confirmation/alert bila memuat alasan/impact yang diperlukan                                      | Native decision semantics + Atria composition                                                  | Reuse semantic action/confirmation ownership, bukan generic sheet untuk semua hal                    |
| Money/grouped content                 | Shared RN layout dan token Atria                                                                         | Sama                                                                                           | Reuse `MoneyValue`, GroupedSurface, FactRow, SummarySurface, FormSection                             |

Capability check pada paket **terpasang** `@expo/ui 57.0.11`: universal components mencakup Button, BottomSheet, Picker, TextInput, Switch dan Slider; **tidak mencantumkan Menu**. Menu/Popover/Stepper/GlassEffectContainer tersedia pada SwiftUI layer. Jangan mengambil contoh skill versi lain yang mengimpor universal Menu tanpa memeriksa typings. `Stack.Toolbar` iOS tidak boleh diperlakukan sebagai Android implementation.

NativeWind 4.2.6 tetap dipakai untuk komposisi RN dan token web yang bisa dibagi. Native SwiftUI nodes ditheme melalui props/modifiers, bukan dipaksa menerima `className`. Reanimated untuk custom RN interaction dengan preset `@atria/tokens/motion`; native navigation/sheet transitions dimiliki sistem. Framer Motion web tidak dipindahkan ke React Native.

Liquid Glass memakai API native pada OS yang mendukungnya, bukan simulasi CSS. `expo-glass-effect` mendukung iOS 26+ dan fallback View pada platform lain; availability/reduced-transparency/reduced-motion harus dihormati. Istilah iOS 26/27 adalah arah desain pengguna, bukan klaim seluruh API iOS 27 sudah tersedia atau terverifikasi.

## Backend dan akses

- Mobile memanggil backend yang sama melalui tRPC/HTTP. DB, Drizzle, audit dan money/stock rules tetap server-side.
- Tambahkan bootstrap capabilities dari actor: effective permission keys, role display, navigation eligibility dan onboarding requirements yang diperlukan UI. Seed role name bukan authority untuk tab/action gating.
- Jangan menyamakan data scope dengan role name. Query proyek dan mutation tetap membaca actor/session server serta assigned-project scope.
- Reuse loader/use-case existing; bila hanya Server Action tersedia, extract use-case per operasi secara additive. Tetap gunakan Zod dan transaksi/audit yang sama; jangan membuat formula atau ledger path native tandingan.
- Screen query baru dimiliki domain yang terlihat; hindari mengirim seluruh project detail untuk satu tab. Wire contracts milik core/server, bukan komponen web.
- Profile mutation tRPC sudah ada; inventory endpoint sebelum membuat transport baru. Finance tRPC saat audit baru mencakup save/submit draft dan pembayaran biaya; project mencakup bootstrap/create/update identitas.
- Cache invalidation harus memperbarui unit yang berubah, project/dashboard terkait, dan permissions bila role berubah. Refresh setelah kembali dari bridge; state keberhasilan hanya dari server response.

## Bridge selama migrasi

Satu registry memetakan destination web yang tervalidasi ke native availability, label, permission dan fallback. Reuse `expo-web-browser` dan runtime base URL seperti bridge onboarding existing.

Pertahankan project ID dan query/tab yang relevan. Batasi tujuan ke origin Atria yang dikonfigurasi dan route allowlist; jangan memasukkan bearer token ke URL atau mengasumsikan sesi browser sudah login. Login di browser jika diperlukan merupakan bagian acceptance bridge. Callback/refresh tidak boleh menyatakan mutation sukses tanpa hasil server.

Hapus copy `Route siap`/nilai `Siap` statis dari produk; gantikan dengan status migrasi yang jujur dan aksi nyata. Jangan memasukkan FAB action untuk operasi yang belum punya native screen atau bridge yang berfungsi. Saat port selesai, ganti entry registry dan hapus bridge khusus operasi itu.

## Worklist dan acceptance per unit

Checkbox yang dicentang menandai implementasi/pemeriksaan spesifik, bukan kelulusan milestone. Build hijau bukan tanda seluruh unit selesai. Setiap unit mencatat referensi web, server contract, reused primitive, status native/bridge, dan bukti QA.

### M0 — Capabilities dan daftar parity

- [ ] Snapshot/reference halaman website untuk route/unit yang akan dibandingkan, termasuk perubahan working tree; jangan overwrite pekerjaan web.
- [x] Registry route/action availability dan bridge eksplisit.
- [x] Server capabilities bootstrap + mobile effective permissions, termasuk custom role.
- [x] Correct permission gates untuk tabs, project create/edit, biaya, invoice/vendor modal, dan approval.
- [ ] Test permission kosong, custom role dengan grant, role bawaan dengan grant berubah, temporary-password gate, revoked/session-expired dan scoped project.

Selesai jika shell dan feature gates mengikuti actor server tanpa mengandalkan ROLE_PERMISSIONS seed. API authorization tetap diuji terpisah.

### M1 — Shell dan Dashboard; review tampilan Owner pertama

- [ ] Shared native-control adapter sesuai tabel; capability test iOS/Android sebelum migrasi banyak call sites.
- [ ] Bottom bar, top bar, header menu, notification/profile entry dan FAB contextual mengikuti informasi/posisi web.
- [x] Dashboard Ringkasan: greeting/date/role, focal finance, setup state, prioritas, project berisiko, jatuh tempo, material attention, kas terbaru (implementasi; fidelity di device belum diverifikasi).
- [ ] Persetujuan, Budget, Jatuh Tempo, Rekening, Material: hierarchy, counts, row detail, grouping, empty/error/partial/offline/refetch states sesuai web.
- [x] Aksi terkait yang belum native memakai bridge eksplisit; tidak disamakan dengan action native selesai.
- [ ] Tab param/deep links dan scroll reading position benar; structural skeleton dimiliki route.
- [ ] Review Owner pada 320/360/390/430 px, actual iOS glass, Android visual fallback, large text dan keyboard bila relevan.

Selesai jika pengguna membaca posisi finance/material dalam 30 detik dan bisa mengikuti semua entry action yang ditampilkan. Ini milestone surface review, bukan kelulusan seluruh workflow Owner.

### M2 — Proyek dari setup ke eksekusi/keuangan

- [ ] List/search/filter/create/edit identitas mengikuti web; preserve code existing.
- [ ] Ringkasan/Perencanaan/Operasional/Keuangan + RAP/RAB/Stok/Pengeluaran/Pembayaran/Margin mengikuti tab web dan lock states.
- [ ] Setup budget, category allocations, review approve/reject, alasan reallocation, activation.
- [ ] RAP Material + Tukang/Subcon packages, baseline/change control; stock link hanya Material.
- [ ] RAB client-safe, revisions/Change Order/export/share; cost/margin/markup/vendor/internal notes tidak bocor.
- [ ] Operasional proyek, client invoice/payment, vendor bill/payment, margin/closing sesuai workflow web.
- [ ] Native unit domain tidak dianggap selesai ketika hanya rangkuman read-only atau bridge tersedia.

Reuse unit P2.5–P2.7 dan P2.11–P2.12 dari worklist lama, serta pertahankan identitas/overview yang sudah ada. Selesai per subunit setelah round trip server + permission/scope + device flow terbukti.

### M3 — Kas & Tagihan dan Persetujuan

- [ ] Workspace dan peer tabs/filter/detail sesuai web; expense draft/OCR/recovery tetap bekerja.
- [ ] Form vendor bill dan invoice nyata menggantikan PlannedFormSheet.
- [ ] Approval detail/approve/reject/revise dan state transitions untuk seluruh tipe yang ditampilkan pada web.
- [ ] Pembayaran biaya/vendor/client dengan explicit action, permission, confirmation impact, bukti dan audit existing.
- [ ] Rekening control/detail/transfer/movement yang muncul pada Dashboard memakai use-case yang sama; reconciled cash tetap immutable.
- [ ] Double-submit, insufficient balance, over-budget, revoked permission, stale approval dan server-error memiliki hasil UI yang benar.

Selesai jika user dapat menyelesaikan tugas dari entry sampai konfirmasi hasil dan dashboard refresh tanpa status semu. Finance transaction tests wajib ketika extraction/action berubah.

### M4 — Material dan stock-control

- [ ] Workspace Ringkasan/Kebutuhan/Inventori/Aktivitas mengikuti web dan real data.
- [ ] Goods receipt, reserve/use/return/transfer/adjustment/waste dan kontrol gudang/exception sesuai operasi yang tersedia web.
- [ ] Project/category/material links tetap scoped; stock movement/audit/transaksi tetap server-side.
- [ ] Adjustment/waste memerlukan note; reservation/use sendiri tidak membuat cash transaction.
- [ ] Shortage/leftover/reusable stock dan Material-budget impact tetap memberi konteks terhadap margin.

Reuse P2.8–P2.10. Setelah M1–M4 beserta Owner path yang relevan terbukti, assemble kandidat review workflow Owner; dokumentasikan bridge yang masih ada dan jangan mengklaim seluruh aplikasi operasional.

### M5 — Halaman pendukung dan setup

- [ ] Onboarding Owner, saldo/stok awal, review Finance, history/batch, first-owner setup.
- [ ] Rekonsiliasi import/read/matching/exceptions/riwayat dan closing dengan immutable ledger rules.
- [ ] Settings hub/default/readiness, budget/categories, library/material settings, tim/vendor administration mengikuti IA website terbaru.
- [ ] Profile/password/sign-out/developer simulation sesuai izin; inbox/detail notifikasi dan deep links lengkap.
- [ ] Asisten AI existing + streaming native dengan permission; AI hanya suggest/prefill dan tidak otomatis mutate finance/material.
- [ ] Setiap bridge dikurangi setelah unit native mendapat evidence; final registry tidak memiliki fallback untuk workflow yang diklaim native selesai.

Reuse P3.1–P3.10 tanpa mengunci IA UI Agustus yang sudah berubah. Scope Asisten AI existing berbeda dari deferred AI CFO Dashboard.

### M6 — Kandidat operasional lintas role/platform

- [ ] Owner, Finance Admin, Purchasing, PM/Designer, custom role; PM hanya assigned projects.
- [ ] iOS system-native controls, Android iOS-like visuals; back/IME/accessibility tidak rusak.
- [ ] Read, write, refresh, return/deep-link, error/retry, draft recovery dan confirmation flow lengkap.
- [ ] Cek 320/360/390/430 px dan device representative, large text, screen readers, Reduce Motion/Reduce Transparency dan keyboard.
- [ ] Semua klaim native selesai memiliki screenshot/flow evidence dan required tests; tidak ada placeholder yang tampil siap.
- [ ] Website regression gates lolos jika shared core/token/backend berubah.
- [ ] Owner memahami dashboard dalam 30 detik; seluruh role menyelesaikan tugas operasional yang relevan.

## Gerbang teknis

Baseline yang sudah lolos pada audit: mobile typecheck/lint/5 routing tests dan export Metro iOS/Android. Tidak ada baseline runtime baru.

Untuk unit executable: jalankan typecheck/lint dan tes yang bermakna bagi contract yang diubah. Jika core/server/token berubah, gunakan workspace scripts dari root, termasuk `bun run test`, token checks dan `bun run build` web sesuai dampak. Jangan menjalankan bare `bun test` dari root atau reset database tanpa kebutuhan yang sah.

Setelah unit UI lengkap: bandingkan running website dan native pada dataset/role yang sama; cek flow/gesture, bukan hanya bundling. Tooling browser/native yang belum ada menjadi prerequisite verification, bukan alasan mengklaim pass. Kumpulkan inspeksi dalam satu round, perbaiki satu batch, konfirmasi maksimal satu round lagi sesuai Impeccable.

Pisahkan tiga status dalam handoff: **UI parity**, **workflow parity**, **device verified**. Semua harus lolos untuk label siap. Setelah perubahan kode besar, refresh Graft graph. Handoff harus menyebut shared primitive yang reused/extended dan alasan new adapter.

## Referensi native

- [Expo UI SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/ui/): cocokkan dengan installed typings sebelum implementasi.
- [Expo GlassEffect SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/): native iOS 26+, unsupported-platform fallback dan known opacity caveat.
- [Expo native tabs](https://docs.expo.dev/router/advanced/native-tabs/): gunakan kontrak installed Expo Router 57 ketika mengatur material/navigation.
