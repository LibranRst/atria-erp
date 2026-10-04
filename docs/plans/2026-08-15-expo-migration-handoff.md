# Handoff — Migrasi Cross-Platform Expo

> Backend paths in this historical handoff were superseded on 1 October 2026. Hono/Bun now owns backend execution in `apps/api`; web files are HTTP facades. Use [independent backend implementation](2026-10-01-independent-backend.md) and [current local development](../guide/mobile-api-development.md).

**Untuk:** agent mana pun (Claude Code, Codex, Antigravity/Gemini, Cursor) yang melanjutkan migrasi ini.
**Cara pakai:** salin blok **Prompt** di bawah apa adanya ke agent baru. Sisanya adalah konteks untuk manusia.

Dokumen ini diperbarui **setiap kali satu Step selesai**. Yang melanjutkan wajib memperbarui bagian "Posisi sekarang" sebelum menyerahkan lagi.

---

## Posisi sekarang

**Terakhir diperbarui:** 2026-09-30 · Capabilities efektif, shared shell/native-menu adapters, bridge registry dan Dashboard tersedia. Core 296 + mobile 10 + web 1.040 test pass (web 151 skip), workspace lint, typecheck, web build dan export iOS/Android lolos. Owner UAT berhasil login melalui @Browser dan client Atria di simulator iOS 26.5. Header/FAB tanpa keyboard, floating topbar, dock sejajar yang tetap expanded, detail/back dan form dismissal telah diperiksa pada 402 pt; Android/runtime accessibility/full-state parity masih terbuka. M0/M1 belum siap UAT. Lihat [handoff implementasi](2026-09-30-expo-m0-m1-implementation.md) dan [bukti perbaikan chrome](2026-09-30-expo-floating-chrome-fix.md).

**Acuan aktif:** [rencana parity dan native controls](2026-09-30-expo-web-parity-native-controls.md) dan [audit kode September](../guide/expo-web-parity-audit-2026-09-30.md). Pengguna memilih struktur halaman mengikuti website, glass pada chrome/control, Android bergaya iOS, serta bridge **Buka di web** selama port belum selesai. NativeWind **sudah aktif (4.2.6)**. Mulai dari capabilities/shell dan Dashboard sesuai rencana aktif; bukan otomatis P2.5.

**Dock iOS terbaru:** [UITabBarController + UIButton/UIMenu](2026-09-30-expo-uikit-native-dock.md) menggantikan custom tab pill. Native hold/drag dan active state sistem sudah diverifikasi; bar tidak compact; FAB dismissal visual lolos 5 loop. Memerlukan build/client native Atria karena memakai local Expo module. Android masih shared fallback. Header floating/menu judul dan native AI/notifikasi/profil tetap mengikuti pilihan pengguna terakhir.

Tabel dan bukti simulator di bawah adalah **progres historis sampai Agustus**, bukan full parity atau kelulusan UAT aplikasi saat ini. Blok Prompt P2.5 di dokumen ini disimpan sebagai arsip scope domain; jangan menjalankannya sebagai instruksi aktif untuk brief September. Unit server Wave 2–3 tetap dipakai sebagai worklist domain sesuai rencana baru.

| Step                                            | Status | Bukti                                                                                                                      |
| ----------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| 0 · Baseline                                    | ✅     | 502 pass / 0 fail, build ✓, lint 0 error                                                                                   |
| 1 · pnpm → Bun                                  | ✅     | `pnpm-lock.yaml` + `pnpm-workspace.yaml` dihapus, tree hoisted (tidak ada `.modules.yaml`), 907 paket                      |
| 2 · `git mv` ke `apps/web`                      | ✅     | 812 rename murni, semua gerbang hijau, dev server + halaman login terverifikasi di browser                                 |
| 3 · Re-anchor architecture tests                | ✅     | 504 pass (2 test baru), anchor terbukti jalan dari `/tmp`, kedua guard baru terbukti menggigit                             |
| 4 · Ekstrak `packages/core`                     | ✅     | 49 modul + 26 test pindah, 223 file impor di-codemod, `permissions.ts` di-split, purity test hijau                         |
| 5 · Plugin Better Auth (`expo()` + `bearer()`)  | ✅     | Nol perubahan schema (dibuktikan via `@better-auth/cli generate`), `atria://`+`exp://` → 401, origin asing → 403           |
| 6 · Actor context + `payFieldRequest`           | ✅     | Satu use-case dipakai Server Action + tRPC; test finance lama tetap hijau tanpa perubahan guardrail transaksi              |
| 7 · Skeleton tRPC + route ke-3                  | ✅     | Allowlist tepat 3 route; tanpa sesi → 401, peran tanpa `pay:cost` → 403, input mutation tervalidasi Zod                    |
| 8 · Permukaan Phase 1                           | ✅     | 4 screen query bearer hijau; role gating benar; media + OCR router aktif; 320/360/390/430 px terverifikasi                 |
| 9 · Scaffold `apps/mobile`                      | ✅     | SDK 57 + Expo Router build; login Expo via LAN membuat sesi native; bearer `screen.approvals` → `ready`                    |
| Phase 3 · Design tokens & primitive RN          | ✅     | Token CSS→TS sinkron; 12 primitive native; iOS 320/360/390/430 px; export iOS + Android hijau                              |
| Phase 4 · Shell & navigasi mobile               | ✅     | Session gate + QueryClient; 4 Native Tabs role-aware; 4 drawer → formSheet; iOS + export Android hijau                     |
| Phase 5 · Layar Phase 1                         | ✅     | Redirect role/onboarding; Dashboard + Biaya/draft/OCR + Persetujuan/pembayaran; iOS + Android bundle hijau                 |
| Plan · Layar native Wave 2–3                    | ✅     | 23 unit P2.1–P3.11 dikunci; 517 test, build, dan lint 0 error tetap hijau                                                  |
| P2.1 · Ganti password sementara native          | ✅     | `protectedProcedure` khusus; transaksi verbatim + drift test terbukti menggigit; loop simulator tertutup                   |
| P2.1b · Fidelity layar Wave 1                   | ✅     | Auto-center tab aktif dipakai bersama web+native; angka ajaib inset tab bar dihapus; terverifikasi di simulator            |
| P2.2 · Daftar Proyek read-only                  | ✅     | Kontrak list ke core; scope PM terbukti server-side (Owner 7 / Budi 4 / Siti 3 / Purchasing 0); FlatList + filter          |
| P2.2b · SegmentedTabs sesuai DESIGN.md          | ✅     | Pil ink aktif kini dirender di mode scrollable; empat metrik hitungan tidak lagi tampil sebagai rupiah                     |
| P2.3 · Buat dan edit identitas Proyek           | ✅     | Use-case ber-Actor + tRPC identity-only; scope bearer terbukti; form sheet create/edit hijau di simulator                  |
| P2.4 · Ringkasan detail Proyek                  | ✅     | `screen.projectOverview` ringan (bukan loader detail penuh); pintu domain `[projectId]/index`; scope bearer terbukti       |
| Audit · Fidelity Dashboard vs web               | ✅     | Kartu fokal gelap + `DuotoneIconTile` + ikon `SegmentedTabs` dibangun; Ringkasan/Persetujuan cocok dengan web di simulator |
| P2.5 · Setup, approval budget & aktivasi Proyek | ⏭️     | Unit berikutnya; ekstrak use-case budget/activation satu per mutation, port form alokasi/approve/reject/activation         |

**Belum di-commit.** Seluruh pekerjaan di atas ada di working tree branch `development`, belum ada commit. Pemilik repo yang memutuskan kapan commit.

### Yang sudah berubah dan mudah salah paham

- Root repo **bukan lagi** Next app. Next ada di `apps/web/`. Root hanya workspace + `docs/` + file `*.md`.
- **Jangan pernah menjalankan `bun test` telanjang dari root.** `bunfig.toml` (yang mem-preload `mock.module("server-only")`) ada di `apps/web/`, dan dimuat dari cwd. Dari root, setiap `features/**/server/*.test.ts` akan meledak. Pakai `bun run test` (yang menjalankan `bun --filter '*' test`) atau `cd apps/web && bun test`.
- `.env` dan `.env.example` ikut pindah ke `apps/web/`. Konsekuensinya `bun run db:seed` sekarang menulis fixture demo ke `apps/web/.atria-demo/`, bukan root.
- 3 test `rounded-*` yang sempat merah sudah diperbaiki di sesi terpisah (`rounded-3xl`/`rounded-[28px]` → `rounded-owner`). Tidak ada lagi test merah yang "sudah wajar" — **kalau ada yang merah, itu regresi baru.**
- **Baseline sekarang 550** (`@atria/core` 121 + `@atria/web` 429). P2.3 menambah 7 test kontrak identitas proyek, P2.4 menambah 5 test kontrak `screen.projectOverview`; `@atria/tokens` juga menjalankan drift check generator sebagai bagian `bun run test`.
- **Impor kode bersama sekarang lewat `@atria/core/...`, bukan `@/lib/...`.** Contoh: `@/lib/validations/finance` → `@atria/core/validations/finance`, `@/lib/utils/money` → `@atria/core/utils/money`. Yang **tetap** di `@/lib/` adalah yang terikat DB/Next: `lib/auth.ts`, `lib/auth/{permissions,scoping}.ts`, `lib/server/session.ts`, `lib/budget/{budget-sync,project-budget-creation}.ts`, `lib/finance/{approval-details,balance-mutation,vendor-bill-write}.ts`, `lib/ai/**`, `lib/hooks/**`, `lib/utils/{cn,motion,use-url-search-param}.ts`.
- **`lib/auth/permissions.ts` sudah di-split.** Matriks murni (`PermissionKey`, `ROLE_PERMISSIONS`, `ROLE_ID_TO_NAME`, `actorHasPermission`, `resolveStaticRoleName`) ada di `@atria/core/auth/permissions`. Yang terikat DB (`resolveRoleName`, `assertPermission`) tetap di `@/lib/auth/permissions` dan me-re-export bagian murninya, jadi seluruh pemanggil sisi server tidak berubah. **File `"use client"` wajib impor langsung dari `@atria/core/auth/permissions`** — jangan lewat `@/lib/auth/permissions`, karena itu menarik Drizzle ke graf bundle client.
- Beberapa test sengaja **tidak** ikut ke `packages/core` karena membaca file sumber `app/actions/**` atau mengimpor kode aplikasi: `lib/auth/{administration-access,developer-account-simulation}.test.ts`, `lib/material/stock-valuation.test.ts`, `lib/validations/expense-draft.test.ts`, plus seluruh integration test finance/project. Semuanya tetap di `apps/web`.
- `CLAUDE.md`, `AGENTS.md`, dan `GEMINI.md` sudah diperbarui untuk layout monorepo. Path tak berkualifikasi di dokumen-dokumen itu (`app/`, `lib/`, `features/`) relatif terhadap `apps/web/`.
- **Better Auth sekarang punya plugin `expo()` + `bearer()`** (urutan itu wajib). `trustedOrigins` menerima `atria://` selalu, dan `exp://` hanya di development. Terverifikasi lewat curl: `atria://` dan `exp://` → 401 (origin dipercaya, kredensial salah), `https://evil.example.com` → 403 `INVALID_ORIGIN`, `http://localhost:3000` dan `http://192.168.1.18:3000` → 401. **Nol perubahan schema** — dibuktikan dengan `@better-auth/cli generate` lalu membandingkan kolomnya: 46 kolom yang dibutuhkan semuanya sudah ada di `db/schema/auth.ts`.
- **`lib/server/session.ts` sekarang meneruskan objek `Headers` utuh**, bukan `{ cookie }` polos. Ini wajib: bentuk polos menjatuhkan header `authorization` sehingga plugin `bearer()` tidak akan pernah terpakai. `getSessionFromHeaders(headers)` sekarang dipakai context tRPC untuk menyatukan sesi cookie dan bearer.
- **Bridge tRPC sekarang aktif di route ketiga** `app/api/trpc/[trpc]/route.ts` dengan `superjson`. `activeProcedure` menegakkan sesi, permission metadata, dan gerbang `mustChangePassword`; context menerima cookie web maupun bearer native.
- **Step 8 mengekspos satu bootstrap query per layar**: `screen.ledger`, `screen.approvals`, `screen.expenses`, dan `screen.newExpense`. Owner terverifikasi mendapat keempatnya `ready`; Project Manager mendapat `restricted` untuk ledger/approvals dan `ready` untuk expenses/newExpense. Tidak ada lagi `NEXT_REDIRECT` transitif di jalur bearer ledger.
- **Dashboard finansial, onboarding overview, ImageKit signature, dan OCR receipt sekarang punya use-case ber-actor eksplisit.** Server Action tetap wrapper sesi tanpa argumen actor yang bisa dipalsukan; tRPC memanggil use-case yang sama dari actor bearer. `ai.processReceipt` juga memakai Zod di batas tRPC dan permission `create:cost`.
- **Kontrak wire expenses sekarang bersumber dari `@atria/core/types/expenses`.** Loader dan komponen utama tidak lagi mengambil tipe payload dari komponen UI; file tipe feature lama hanya compatibility shim.
- **Verifikasi akhir Step 8:** `bun run test` = 512 pass / 0 fail, `bun run build` ✓, `bun run lint` = 0 error (1 warning Storybook lama). Empat route web diperiksa pada 320/360/390/430 px: tidak ada overflow dokumen, alert runtime, atau nilai uang primer yang membungkus.
- **Step 9 menambahkan `apps/mobile` dari template resmi Expo SDK 57** (`expo@57.0.13`, React Native 0.86.2, React 19.2.3) tanpa layar produk. Route sementara hanya harness bukti koneksi; ia memakai `authClient.signIn.email`, SecureStore, bearer token dari cookie sesi, dan `import type { AppRouter }` untuk query tRPC.
- **Tipe `AppRouter` diisolasi dari graf runtime Metro.** `@atria/web/api` mengekspor deklarasi yang dibuat oleh `apps/web/tsconfig.api.json`; mobile melarang value import dari seluruh `@atria/web/*`. Metro berhasil membuat bundle iOS 1.369 modul dan Expo Go menjalankan bundle lewat `exp://192.168.1.18:8081`.
- **Bukti LAN Step 9:** login dari Expo Go membuat sesi dengan user-agent `Expo/57.0.9` dan IP LAN `192.168.1.18`; login bearer terpisah mengembalikan `set-auth-token`, lalu `screen.approvals` menjawab HTTP 200 dengan `status: ready`. Tidak ada perangkat fisik yang terdeteksi oleh `xcrun devicectl`/ADB pada sesi ini, jadi pengulangan tap-through di hardware nyata tetap perlu saat perangkat tersedia; simulator iOS 26.5 dan jalur LAN sudah hijau.
- **Verifikasi akhir Step 9:** mobile typecheck ✓, mobile lint ✓, dependensi Expo sesuai ✓, export Metro iOS ✓, `bun run test` = 512 pass / 0 fail, `bun run build` ✓, `bun run lint` = 0 error (1 warning Storybook lama).
- **Phase 3 menambahkan `packages/tokens` sebagai turunan deterministik dari `apps/web/app/globals.css`.** `scripts/generate-tokens.ts` membaca `:root` + `@theme`, menyelesaikan alias `var()`, `color-mix`, dimensi, shadow, tipografi, serta lima warna opacity inline. `bun run tokens:check` ikut `bun run test`, jadi drift CSS→TS menggagalkan gerbang.
- **Preset motion sekarang bersumber dari `@atria/tokens/motion`.** Adapter web tetap memberi tipe Framer Motion, sedangkan mobile memakai nilai stiffness/damping/mass yang sama lewat Reanimated. Empat variant set dan seluruh preset proses lama tetap tersedia; tidak ada angka spring baru di primitive native.
- **Mapping 45 status dipindah verbatim ke `@atria/core/presentation/status-presentation`.** Web me-re-export kontrak lama dan mobile memakai sumber yang sama. Tone sukses tetap ink netral sesuai One Accent Rule; fallback label tetap memakai `formatBusinessLabel`.
- **Theme native bertipe sudah aktif dan light-only.** Manrope 400/500/600/700/800 + JetBrains Mono 500 dimuat eksplisit, exact money saja yang mono, `userInterfaceStyle` dikunci `light`, dan surface/radius/shadow/spacing tidak diketik ulang di layar. Export final hanya membawa enam font yang dipakai.
- **Seluruh primitive Phase 3 selesai:** `AppIcon`, `FormField`, `MoneyValue`, `FormSection`, `TextInput`, `SheetSelect`, `GroupedSurface`, `BottomSheet`, `StatusBadge`, `Button`, `SegmentedTabs`, dan `FactRow`/`SummaryFact`. Grouped form tidak menumpuk kapsul, kontrol mandiri berkapsul 48 px, nested surface tetap datar, dan `BottomSheet` adalah wrapper isi untuk route native `presentation: "formSheet"`—bukan mesin drag buatan.
- **Dependency native Phase 3 sudah terpasang:** Phosphor 3.0.6, Reanimated 4.5, Sonner Native 0.27, MMKV 4.3, camera/image picker, haptics, dan native date-time picker. Draft Phase 5 memakai MMKV pada development/production build dan AsyncStorage sebagai fallback Expo Go; token autentikasi tetap hanya di SecureStore.
- **Katalog primitive sementara pernah menjadi route root mobile** dan route `primitive-sheet` membuktikan konfigurasi form sheet native. Keduanya dipensiunkan saat root menjadi auth gate pada Phase 4; bukti 320/360/390 di iPhone 17 Pro dan 430 di iPhone 17 Pro Max tetap tercatat. Regresi flex-basis `SummaryFact` di 320 sudah diperbaiki, dan nilai uang primer tetap satu baris di keempat lebar.
- **Bukti platform Phase 3:** mobile typecheck ✓, mobile lint ✓, `expo install --check` ✓, export Metro iOS ✓ (5.087 modul, bundle Hermes 12 MB) dan Android ✓ (5.181 modul). Mesin ini tidak memiliki Android system image/AVD maupun perangkat Android, jadi inspeksi visual Android masih harus diulang saat emulator/perangkat tersedia; bundle Android dan autolinking sudah hijau.
- **Verifikasi akhir Phase 3:** `bun run test` = 514 pass / 0 fail (`core` 115 + `web` 399; token drift ✓), `bun run build` ✓, `bun run lint` = 0 error (1 warning Storybook lama).
- **Phase 4 membangun shell native yang sesungguhnya.** Root layout sekarang memuat font, `ThemeProvider`, TanStack Query dengan integrasi fokus/konektivitas, `AuthProvider`, protected routes, splash struktural, dan login gate. Sesi Better Auth dari SecureStore menentukan akses sebelum layout tab di-mount; akun `mustChangePassword` tidak dapat masuk ke shell dan mendapat pemulihan yang mengarahkan ke Atria web.
- **Kontrak navigasi peran tidak diduplikasi.** `getRoleNavItems()` + daftar tujuan dipindah ke `@atria/core/navigation/role-navigation`; web mempertahankan matcher pathname lokal, sementara mobile memakai kontrak yang sama bersama `ROLE_PERMISSIONS`. Owner terverifikasi hanya melihat Dashboard/Proyek/Biaya; empat `NativeTabs.Trigger` selalu dideklarasikan lalu diberi `hidden` setelah sesi selesai, dan setiap tab memiliki nested native Stack sendiri.
- **Empat drawer global web sudah dipetakan menjadi route.** Biaya baru hidup di `/expenses/new`; tagihan vendor, proyek baru, dan invoice klien hidup di `/modal/*`. Keempatnya memakai `presentation: "formSheet"`, detent + grabber native, guard permission/role, dan tidak menyimpan state pembuka di query param. `/approvals` juga menjadi route stack terlindungi.
- **Safe area dan keyboard shell sudah native.** Scroll utama memakai `contentInsetAdjustmentBehavior="automatic"` + inset bawah, form sheet menghormati inset saat dibuka sebagai cold deep link, Android memakai `softwareKeyboardLayoutMode: "resize"`, dan tidak ada `SafeAreaView`/`Platform.OS` baru.
- **Bukti visual Phase 4:** iPhone 17 Pro iOS 26.5 memperlihatkan login gate, header stack reguler, form sheet, serta tab Owner yang tepat tanpa Material. Inspeksi menemukan lalu memperbaiki large-title kosong dan header sheet yang terpotong. Mesin tetap tidak memiliki Android system image/AVD, jadi Android diverifikasi lewat Metro export + autolinking, bukan screenshot emulator.
- **Verifikasi akhir Phase 4:** mobile typecheck ✓, mobile lint ✓, `expo install --check` ✓, export Metro iOS ✓ (5.086 modul) dan Android ✓ (5.162 modul), `bun run test` = 517 pass / 0 fail (`core` 118 + `web` 399; token drift ✓), `bun run build` ✓, `bun run lint` = 0 error (1 warning Storybook lama).
- **Phase 5 menyelesaikan redirect login penuh dari server.** Query `screen.home` meniru `app/page.tsx`: Owner melewati gate onboarding, Finance Admin diarahkan ke review saldo awal bila masih pending, Purchasing ke Material, dan peran lain ke Proyek. Karena onboarding native berada di luar cakupan Phase 5, dua route bridge membuka workspace onboarding web tanpa melewati gate sesi atau memalsukan status.
- **Dashboard native memakai data produksi dari satu query `screen.ledger`.** Enam tab Ringkasan/Persetujuan/Budget/Jatuh Tempo/Rekening/Material memakai `MoneyValue`, `SummarySurface`, `MetricPill`, `SegmentedTabs`, dan `StatusBadge`; nilai primer dan nilai exact tetap satu baris pada iPhone 17 Pro.
- **Biaya native sekarang end-to-end.** `/expenses` membaca loader web yang sama; `/expenses/new` memakai grouped `FormSection`, `SheetSelect`, `MoneyInput`, `QuantityStepper`, dan `WorkflowFormSheet`. Draft tersimpan otomatis di perangkat, lalu `finance.saveExpenseDraft` menyimpan optimistic revision di server. Submit memanggil `finance.submitExpenseDraft`; badan `db.transaction` dibandingkan tekstual dengan sumber lama dan identik tanpa selisih.
- **Kamera dan OCR aktif di native.** `expo-image-picker` kamera/galeri → `media.signImagekit` → upload langsung ImageKit → `ai.processReceipt` Gemini. Hasil OCR hanya mengisi draft dan tetap wajib ditinjau manusia; tidak ada mutation finansial otomatis. Public key dapat diisi lewat `EXPO_PUBLIC_IMAGEKIT_PUBLIC_KEY`, private key tetap server-only.
- **Persetujuan dan mutation pembayaran native aktif.** `screen.approvals` mengembalikan antrean keputusan, rekening aktif, dan biaya berstatus disetujui dalam satu bootstrap. Tab Siap dibayar memanggil use-case `payFieldRequest` yang sudah dipakai web; integration test tetap membuktikan approval Owner untuk nominal >= Rp5 juta/overrun, mutasi kas, audit, state machine, dan penolakan rekonsiliasi ganda.
- **Smoke test Phase 5 menemukan lalu menutup crash Expo Go.** Import MMKV langsung gagal karena NitroModules tidak ada di Expo Go; adapter sekarang memuat MMKV secara dinamis hanya pada native build dan memakai AsyncStorage saat `ExecutionEnvironment.StoreClient`. Dashboard, form biaya form-sheet, dan antrean Persetujuan kemudian tampil dengan data seed nyata di iPhone 17 Pro iOS 26.5. Android terverifikasi lewat Metro export (5.314 modul); mesin tetap tidak memiliki emulator/perangkat Android aktif.
- **Verifikasi akhir Phase 5:** mobile typecheck ✓, mobile lint ✓, export Metro Android ✓, smoke test iOS ✓, `bun run test` = 517 pass / 0 fail (`core` 118 + `web` 399; token drift ✓), `bun run build` ✓, `bun run lint` = 0 error (1 warning Storybook lama).
- **Rencana layar Wave 2–3 sudah dikunci** di `docs/plans/2026-08-15-expo-native-phase-2-3-screens.md`. Wave 2 memindahkan password wajib, Proyek/budget/RAP/RAB, Material/stok, serta operasional/keuangan proyek. Wave 3 memindahkan onboarding/saldo awal, rekonsiliasi, Settings/administrasi, profil, dan AI chat. Setiap P2.x/P3.x adalah unit kerja terpisah dan tidak boleh digabung.
- **P2.3 mengekstrak create/update proyek ke dua use-case ber-`Actor` eksplisit.** Server Action web sekarang hanya me-resolve actor lalu mendelegasikan. Golden transaction test membekukan kedua badan `db.transaction`; probe sementara pada action audit membuat test merah 5 pass / 1 fail, lalu kembali 6/6 setelah dipulihkan. Tidak ada guard transaksi yang diketik ulang atau diubah.
- **Transport P2.3 memakai `activeProcedure` dan input Zod.** Bootstrap hanya membawa opsi klien/PM serta satu identitas proyek. Mutation native tidak menerima `status`, `financialHealth`, nilai kontrak, cover, user ID, atau role dari client; status/health/cover terbaru diambil server tepat saat submit sebelum use-case lama dipanggil. ID seed UUID-like lama tetap diterima, string kosong tetap ditolak.
- **Bukti bearer P2.3:** Owner create ✓, Finance Admin create ✓, PM create → `FORBIDDEN`; PM Budi bootstrap proyek sendiri → `ready`, proyek Siti → `restricted`; update proyek sendiri ✓, update proyek Siti → `FORBIDDEN`. Kedua proyek tetap `DRAFT`, nama proyek sendiri berubah, lalu seluruh proyek/audit uji dibersihkan dan sisa data uji = 0.
- **Bukti simulator P2.3 (iPhone 17 Pro, iOS 26.5):** setelah baris Metro baru `iOS Bundled` (5.370 modul), sheet create menampilkan grouped identity + jadwal + catatan, selector klien aktif, dan sheet edit terisi data seed. Inspeksi menemukan lalu memperbaiki `ScrollView` yang kolaps tanpa `flex: 1`, ID seed non-RFC, keyboard inset, target sentuh efektif 48 pt, label footer sempit, dan error klien baru lokal.
- **Verifikasi akhir P2.3:** `bun run test` = 545 pass / 0 fail (`core` 121 + `web` 424; token drift ✓), `bun run build` ✓, `bun run lint` = 0 error (1 warning Storybook lama), mobile typecheck ✓, mobile lint ✓, `expo install --check` ✓, export Metro iOS ✓ (5.243 modul) dan Android ✓ (5.319 modul).
- **P2.4 menambahkan `screen.projectOverview({ projectId })`** sebagai loader ringan tersendiri di `server/usecases/project/get-project-overview.ts` — sengaja tidak memakai `getProjectDetailData` web (yang memuat seluruh pohon RAP/RAB/vendor bill/movement). Payload berisi identitas, `effectiveHealth` (rumus sama dengan daftar proyek lewat `buildProjectBudgetDashboard`), `isLocked` (`status !== "APPROVED"`, sama seperti web), empat baris kesiapan (RAB/RAP/Material/Tagihan), daftar blocker dari `buildProjectOverviewActions` (core, dipakai verbatim), dan hingga lima kategori budget. `shortageCount` dan angka tagihan overdue dihitung dengan rumus persis sama dengan halaman detail (`projectMaterialProjection` dari core untuk shortage; filter status+dueDate yang sama untuk overdue) — bedanya loader ini hanya mengambil kolom yang perlu dan tidak pernah mengirim array item RAP/RAB/vendor payment ke klien.
- **Scope dan gate P2.4 sama persis dengan pola yang sudah ada:** `actorHasPermission(actor.roleName, "view:budget")` lalu `assertProjectAccess` di dalam try/catch → `{ status: "restricted" }`. Proyek yang tidak ada → `{ status: "notFound" }`. Tidak ada `redirect()` atau `notFound()` Next di dalam use-case ini.
- **Route native `(tabs)/projects/[projectId]/index.tsx` adalah pintu domain detail.** Header identitas + badge status/health, banner locked bila budget belum approved, grup fakta jadwal/lokasi, seksi Kesiapan, seksi "Perlu perhatian" (blocker, murni informasi — belum ada navigasi karena tab RAP/RAB/dst. belum dibangun), dan seksi Kategori budget. Baris di daftar proyek sekarang `Pressable` menuju `/projects/[projectId]`; tombol "Ubah" tetap area sentuh terpisah menuju form sheet identitas (P2.3) — keduanya diverifikasi tidak saling menimpa di simulator.
- **Dua bug fidelity ditemukan dan diperbaiki saat verifikasi simulator, bukan saat menulis kode.** Pertama, teks nilai kesiapan ("Perlu dilengkapi") tidak diberi `numberOfLines`, jadi membungkus tiga baris di kartu sempit — ditambahkan `numberOfLines={1}`. Kedua, kontainer nilai `FactRow` yang menerima `ReactNode` sudah dibatasi `maxWidth: "58%"` oleh `factSlot` primitive (`grouped-surface.tsx`); menambahkan `maxWidth: "58%"` lagi di kontainer lokal membuatnya bersarang jadi ~34% lebar baris, sehingga "9% dari Rp 390.000" terpotong jadi "9% ter…" walau teksnya pendek. Perbaikannya menghapus `maxWidth` lokal yang duplikat, dan menyederhanakan baris kategori jadi "X% terpakai" (konsisten dengan pola `rowUsage` di daftar proyek) alih-alih mengulang nominal yang sudah tampil di `MoneyValue` di atasnya.
- **Bukti bearer P2.4:** Owner pada proyek Siti → `ready` dengan identitas lengkap; PM Budi pada proyek miliknya (Menteng Villa) → `ready` dengan `shortageCount=3` cocok dengan baris "3 kurang" dan tagihan overdue Rp440.000.000 cocok dengan "1 overdue"; PM Budi pada proyek Siti → `restricted`; Purchasing (Agus, tanpa `view:budget`) → `restricted`; project ID acak → `notFound`; tanpa bearer → `401`; `projectId` kosong → `BAD_REQUEST` Zod.
- **Bukti simulator P2.4 (iPhone 17 Pro, iOS 26.5):** setelah baris Metro baru `iOS Bundled`, tab Proyek → tekan baris "Sudirman Suites" membuka ringkasan dengan identitas, badge AKTIF/KRITIS, nilai kontrak, Mulai/Selesai/Lokasi/Tipe, Kesiapan (RAB R1, RAP "Perlu dilengkapi", Material "Siap", Tagihan "Terbuka" Rp480.000.000), "Perlu perhatian" (3 item: setup RAP, kategori Subcon melewati batas), dan lima Kategori budget (Tukang/Material/Operasional/Lain-lain/Subcon) — seluruhnya data produksi nyata, cocok dengan bukti bearer. Tombol back kembali ke daftar; "Ubah" tetap membuka sheet edit terpisah tanpa memicu navigasi baris.
- **Catatan lingkungan simulator:** `bunx expo start --localhost` mengikat Metro ke IPv6 loopback saja (`TCP localhost:*` tanpa `127.0.0.1`), sehingga Expo Go yang meminta `http://127.0.0.1:8081` gagal terhubung meski `/status` via `curl localhost:8081` tetap 200. Jangan pakai flag `--localhost` untuk verifikasi simulator di mesin ini — `bunx expo start --port 8081` polos sudah mengikat ke seluruh interface dan terbukti bekerja.
- **Verifikasi akhir P2.4:** `bun run test` = 550 pass / 0 fail (`core` 121 + `web` 429; token drift ✓), `bun run build` ✓, `bun run lint` = 0 error (1 warning Storybook lama), mobile typecheck ✓, mobile lint ✓, export Metro iOS ✓ dan Android ✓, `git diff --check` ✓.
- **Audit fidelity Dashboard native vs web (di luar urutan P2.x, atas permintaan pemilik repo).** Kode-level audit menemukan bahwa `SummarySurface` native tidak pernah memakai tier gelap (`shadow-inverse`/`primary`) yang jadi identitas visual inti DESIGN.md ("one confident dark surface for the number that matters") — kartu fokal Ledger malah selalu putih, dan angka headline-nya (`Sisa budget proyek`) berbeda dari web (`Kas tersedia`). Audit juga menemukan `DuotoneIconTile` — primitive yang dipakai di hampir setiap baris list web (approval, kategori, material, rekening) — tidak pernah dibangun di native, sehingga baris "Perlu perhatian" jadi teks pasif tanpa tap affordance, bukan kartu keputusan. Ditemukan juga `SegmentedTabs` native tidak punya slot ikon sama sekali (`SegmentedTab` type tidak punya field `icon`), padahal web menampilkan ikon di setiap tab dashboard.
- **Ruang lingkup perbaikan disepakati eksplisit dengan pemilik repo: chrome (sheet/modal/tab bar) dibiarkan native mentah** (termasuk `SelectionSheet` yang memakai `Modal` RN — itu justru benar, bukan temuan) — **fokus hanya ke konten section, halaman, dan `SegmentedTabs`.**
- **Primitive baru:** `DuotoneIconTile` (`components/ui/duotone-icon-tile.tsx`, tone neutral/attention/critical/inverse, selalu flat — Nested-Stays-Flat) dan `BudgetSplitIndicator` (`components/ui/budget-split-indicator.tsx`, port langsung dari web lewat `getBudgetGeometry` di `@atria/core`, bukan ditulis ulang).
- **`SegmentedTab` bertambah field `icon?: AppIconName | string`**, dirender sebelum label di kedua mode (scrollable/non-scrollable). Enam tab Ledger (`Ringkasan/Persetujuan/Budget/Jatuh tempo/Rekening/Material`) memakai ikon persis sama dengan web (`space_dashboard/approval/monitoring/event_busy/account_balance/inventory_2`).
- **Tab Ringkasan Ledger dibangun ulang mengikuti struktur `FinancialPosition` web persis**, bukan lagi memakai `SummarySurface` generik: kartu gelap (`theme.colors.primary` + `shadows.inverse`) dengan headline "Kas tersedia" (`variant="fullDynamic"`, size `hero`), tiga sel Piutang/Hutang/≤7 hari, dan kotak budget bersarang (persentase + `BudgetSplitIndicator` + caption) — seluruhnya data yang sudah tersedia di `overview.summary` (`receivablesOutstanding`/`payablesOutstanding` sudah ada di tipe core, hanya belum pernah dirender native). Section "Margin dan penggunaan" yang lama dihapus karena isinya sudah terwakili di kartu gelap (persis seperti web, yang juga tidak punya section terpisah untuk itu).
- **"Perlu perhatian" (Ringkasan) dan preview approval (Persetujuan) sekarang jadi baris keputusan yang bisa ditekan**, memakai `DuotoneIconTile` + label severity (Kritis/Perhatian) + chevron — meniru `OverviewPriorityList`/`ApprovalWorkbenchRow` web. Tekan baris "Perlu perhatian" memanggil `setTab(...)` ke tab Ledger yang relevan (bukan navigasi lintas-route, karena ini sama-sama satu layar); tekan baris Persetujuan tetap `router.push("/approvals")` seperti sebelumnya.
- **Bukti visual (iPhone 17 Pro, iOS 26.5):** setelah baris Metro baru `iOS Bundled`, tab Ringkasan dan Persetujuan dibandingkan berdampingan dengan browser web (login Owner yang sama) — kartu gelap, tiga sel Piutang/Hutang/≤7 hari, kotak budget, ikon `SegmentedTabs`, dan baris keputusan dengan icon tile+chevron seluruhnya cocok dengan web.
- **Follow-up yang sengaja belum dikerjakan (bukan lupa):** baris list di tab Budget/Jatuh Tempo/Rekening/Material Ledger juga memakai `DuotoneIconTile` di web (icon per kategori/tipe transaksi/bank), tapi belum dipetakan — perlu riset icon-mapping terpisah per tab, di luar cakupan audit ini. Ada juga bug kosmetik kecil: nilai uang pada baris preview approval "Saldo awal stok" kadang mengecil drastis (indikasi `adjustsFontSizeToFit` di `MoneyValue` salah ukur lebar kontainer saat pertama render) — sudah dicoba `flexShrink: 0` + `minWidth` pada kontainer pembungkus, belum menyelesaikan; kemungkinan perlu perbaikan di `MoneyValue` sendiri.
- **Verifikasi akhir Audit fidelity Dashboard:** `bun run test` = 550 pass / 0 fail (`core` 121 + `web` 429; token drift ✓), `bun run build` ✓, `bun run lint` = 0 error (1 warning Storybook lama), mobile typecheck ✓, mobile lint ✓, export Metro iOS ✓ dan Android ✓.
- **Bug lama "isi form sheet hilang saat digeser ke full-height" akhirnya ditemukan akar masalahnya, dan itu BUKAN `automaticallyAdjustKeyboardInsets`.** Fix P2.4 yang mengklaim menyelesaikan ini di `project-form-sheet.tsx` ternyata tidak benar-benar menutup bug-nya — direproduksi ulang di simulator tanpa keyboard sama sekali (drag langsung ke full-height, tanpa fokus ke input apa pun) dan isinya tetap hilang. Root cause sesungguhnya: `react-native-screens` di iOS ([RNSScreenContentWrapper.mm](https://github.com/software-mansion/react-native-screens/blob/main/ios/RNSScreenContentWrapper.mm), dikonfirmasi lewat [issue #2992](https://github.com/software-mansion/react-native-screens/issues/2992)) hanya memaksa ulang frame `ScrollView` saat sheet berganti detent **kalau `ScrollView` itu anak langsung** dari native content wrapper milik screen — dan hanya mengenali dua pola: `ScrollView` sendirian, atau `[header, ScrollView]`. `BottomSheet` dan `WorkflowFormSheet` sebelumnya membungkus `ScrollView` (dan footer) di dalam `<View>` pembungkus, jadi `ScrollView` tidak pernah ditemukan sebagai anak langsung → frame-nya tidak pernah dikoreksi → tetap memakai ukuran detent awal → isinya terlihat hilang begitu sheet menjadi full-height.
- **Fix sesungguhnya: hilangkan `<View>` pembungkus di sekitar `ScrollView`.** `BottomSheet` (`components/ui/bottom-sheet.tsx`) sekarang me-return `ScrollView` langsung sebagai root, tanpa canvas `View`. `WorkflowFormSheet` (`components/ui/workflow-form-sheet.tsx`) me-return Fragment berisi `[ScrollView, footer]` sebagai saudara langsung — `ScrollView` sebagai anak pertama (dapat ukuran penuh), footer memakai `position: "absolute"` supaya tetap melayang di bawah tanpa jadi "anak ketiga" yang merusak deteksi library, dengan tinggi footer diukur lewat `onLayout` untuk menyisakan padding bawah yang tepat di `ScrollView`. `project-form-sheet.tsx` juga sempat membungkus `WorkflowFormSheet` dalam `<View style={{flex:1}}>` — itu ikut dihapus (jadi Fragment) karena membungkus lagi di layer atasnya sama merusaknya.
- **`automaticallyAdjustKeyboardInsets={false}` tetap dipertahankan** di kedua primitive (bukan dihapus) — itu default RN di iOS yang bisa memicu masalah serupa saat keyboard aktif, jadi tetap relevan sebagai lapisan pencegahan kedua meski bukan akar masalah utama.
- **Bukti visual (iPhone 17 Pro, iOS 26.5):** direproduksi dulu di kondisi gagal (form Biaya, drag ke full-height → isi kosong total, drag kembali ke detent parsial → tetap kosong, bukan cuma soal ukuran viewport saat itu), lalu diverifikasi hijau setelah fix di DUA form terpisah — Proyek baru dan Catat biaya proyek — keduanya menampilkan seluruh isi + footer dengan benar di full-height maupun saat scroll ke atas/bawah.
- **Verifikasi akhir fix bottom sheet:** `bun run test` = 550 pass / 0 fail (`core` 121 + `web` 429; token drift ✓), `bun run build` ✓, `bun run lint` = 0 error (1 warning Storybook lama), mobile typecheck ✓, mobile lint ✓, export Metro iOS ✓ dan Android ✓.
- **Unit berikutnya adalah P2.5 — setup, approval budget, dan aktivasi Proyek.** Ekstrak use-case budget/activation satu per mutation tanpa mengubah formula atau transaksi; port form alokasi kategori, review budget, approve/reject, reallocation dengan alasan, dan activation checklist. Settings hanya dibaca sebagai default untuk budget baru.
- **Verifikasi unit perencanaan Wave 2–3:** `bun run test` = 517 pass / 0 fail (`core` 118 + `web` 399; token drift ✓), `bun run build` ✓, `bun run lint` = 0 error (1 warning Storybook lama), dan `git diff --check` ✓.
- **P2.1 memindahkan `changeTemporaryPassword` ke use-case ber-actor** di `server/usecases/administration/change-temporary-password.ts`. Server Action web menjadi wrapper tipis yang me-resolve actor sendiri; prosedur tRPC memanggil use-case yang sama. Badan `db.transaction` dipindah verbatim — satu-satunya substitusi adalah `actor.id` → `actor.userId`.
- **Mutation password adalah satu-satunya `protectedProcedure` di router.** Ini disengaja: `activeProcedure` akan menolak akun `mustChangePassword=true` dengan `MUST_CHANGE_PASSWORD` dan membuatnya buntu. Seluruh prosedur layar tetap `activeProcedure`, dan ada test yang menjaga kedua sisi asimetri itu sekaligus — kalau salah satunya bergeser, test merah.
- **Drift test transaksi memakai golden snapshot yang dibekukan di file test**, bukan `git show HEAD`. Alasannya: begitu pekerjaan ini di-commit, HEAD berubah dan pembanding berbasis git akan membandingkan file dengan dirinya sendiri. Snapshot terbukti menggigit — mengubah guard `ne(session.id, "")` membuat test merah, lalu hijau lagi setelah dipulihkan.
- **Layar native `/profile/password` menggantikan dead-end ke web.** Sebelum P2.1, `login.tsx` menyuruh akun kata sandi sementara membuka Atria web. Sekarang gate root punya tiga keadaan eksklusif: belum masuk → login, kata sandi sementara → hanya `/profile/password`, selain itu → shell operasional. `signOut()` di provider dibuat tahan terhadap kegagalan karena sesi memang sudah dicabut server saat dipanggil.
- **Bukti P2.1 di server:** akun kata sandi sementara → `screen.ledger` `FORBIDDEN MUST_CHANGE_PASSWORD`, `administration.changeTemporaryPassword` lolos gate; kata sandi sementara salah → `FORBIDDEN` sebagai `ActionResponse`; kata sandi benar → sesi 1 → 0, `mustChangePassword` false, audit `CHANGE_TEMPORARY_PASSWORD` tertulis; token lama → `UNAUTHORIZED`; login kata sandi lama → 401; login kata sandi baru → sukses.
- **Bukti P2.1 di simulator (iPhone 17 Pro, iOS 26.5):** login akun kata sandi sementara mendarat langsung di layar password tanpa tab mana pun; ganti kata sandi berhasil; sesi lokal dibersihkan dan kembali ke login; login ulang dengan kata sandi baru masuk ke shell dengan tab peran PM (Proyek/Material/Biaya). Akun uji coba dan seluruh artefaknya sudah dihapus setelah verifikasi.
- **Verifikasi akhir P2.1:** `bun run test` = 533 pass / 0 fail (`core` 118 + `web` 415; token drift ✓), `bun run build` ✓, `bun run lint` = 0 error (1 warning Storybook lama), mobile typecheck ✓, mobile lint ✓, `expo install --check` ✓, export Metro iOS ✓ dan Android ✓, `git diff --check` ✓.
- **P2.1b menutup dua fidelity gap layar Wave 1 yang terlihat di simulator.** Pertama, `calculateCenteredScrollLeft` dipindah dari komponen web ke `@atria/core/presentation/segmented-tabs-scroll`; web mengimpor lalu me-re-export-nya sehingga seluruh pemanggil dan test lama tidak berubah, dan native memakai matematika yang sama lewat `onLayout` + `scrollTo`. Sebelumnya `SegmentedTabs` native tidak punya perilaku ini sama sekali, jadi "Jatuh tempo" selalu terpotong jadi "Ja…" dan tab di luar layar tidak pernah terbaca.
- **Angka ajaib `+ 84` untuk tinggi tab bar dihapus** dari layar ledger dan expenses, diganti `TAB_SCREEN_BOTTOM_SPACE` berbasis token di `src/constants/scroll-insets.ts`. Dokumentasi Expo menyatakan tinggi tab bar **tidak bisa diukur programatis**, dan sejak SDK 55 ScrollView pertama tiap tab sudah menerima inset otomatis — jadi padding manual itu menduplikasi inset yang sudah ada, bukan menambah ruang yang kurang. `useSafeAreaInsets` yang jadi yatim ikut dihapus.
- **Catatan verifikasi:** `bun test` sempat hijau padahal `tsc` merah, karena re-export `export { x } from "..."` tidak membawa nama ke scope lokal sementara komponen web memakainya. Gerbang `bun run build` yang menangkapnya — jangan pernah menyimpulkan hijau hanya dari test.
- **Bukti visual P2.1b (iPhone 17 Pro, iOS 26.5):** setelah bundle segar, menekan tab "Budget" membuat strip menggeser sendiri sehingga "Budget" ke tengah dan "Jatuh tempo" terbaca penuh; konten bawah berakhir bersih di atas tab bar mengambang. Bundle basi Expo Go sempat menyesatkan pembacaan awal — pastikan ada baris `iOS Bundled` baru di log sebelum menilai perubahan UI.
- **P2.2 memindahkan kontrak daftar proyek ke core.** `project-list-types.ts` → `@atria/core/types/projects` dan `project-list-utils.ts` → `@atria/core/project/project-list` (berikut test-nya). Web menyimpan dua shim `export * from`, jadi seluruh pemanggil lama tidak berubah. Guard purity sempat merah karena file yang dipindah masih mengimpor `@atria/core/project/effective-health` — self-reference itu harus jadi relatif.
- **`getProjectListPageData(actor)` kini union status.** `restricted` dikembalikan saat peran tidak punya `view:budget`; halaman web yang menerjemahkannya jadi redirect. `screen.projects` memakai `activeProcedure` seperti layar operasional lain.
- **Scope proyek tetap sepenuhnya server-side dan sudah dibuktikan lewat bearer:** Owner 7 proyek, Budi 4 (hanya miliknya), Siti 3 (hanya miliknya), Purchasing 0. 4 + 3 = 7 tanpa tumpang tindih, jadi tidak ada kebocoran antar-PM. Klien tidak pernah mengirim daftar proyek yang boleh dilihat.
- **Baris proyek native sengaja belum bisa ditekan.** Route `/projects/[projectId]` baru dibangun di P2.4, jadi chevron atau area tekan sekarang akan menjanjikan tujuan yang belum ada. Navigasi ke detail menyusul bersama layarnya.
- **Bukti visual P2.2 (iPhone 17 Pro, iOS 26.5):** tab Proyek menampilkan 7 proyek seed dengan nilai kontrak, status, dan kesehatan; menekan filter "Ditunda" menyaring ke 1 proyek dan strip filter menggeser sendiri berkat perbaikan P2.1b. Filter tanpa isi disembunyikan supaya strip tidak penuh pilihan kosong.
- **`SegmentedTabs` native sempat melanggar DESIGN.md di empat titik sekaligus**, dan itu sebab utama layar native terasa jauh dari web. Cabang `scrollable` mengembalikan `{tabs}` saja tanpa `Animated.View` indikator — jadi pil aktif memang tidak pernah dirender di layar mana pun, karena semua layar memakai `scrollable`. Selain itu track memakai `surfaceContainer` (spec: `inset-gray`), pil memakai `surfaceContainerLowest` putih (spec: `ink-primary`), dan label aktif memakai `onSurface` gelap (spec: `#ffffff`). Keempatnya sudah disesuaikan; lebar pil pada mode scrollable dianimasikan dari hasil `onLayout` karena tiap tab berbeda lebar.
- **Jangan mengganti `SegmentedTabs` dengan segmented control native.** `UISegmentedControl` iOS dan `SegmentedButton` `@expo/ui` sama-sama tidak mendukung badge angka maupun scroll horizontal, dan yang Android bergaya Material 3. Dashboard punya enam tab berbadge yang harus bisa digeser, jadi kontrol native akan menghapus fungsi sekaligus menjauh dari bahasa visual Atria.
- **`MetricPill` selalu merender `MoneyValue`,** sehingga empat metrik hitungan di dashboard (`totalCount`, `criticalCount`, `materialShortageCount`, `lowStockCount`) terbaca "Rp 3" dan "Rp 2" — salah arti di layar finansial. Sekarang ada prop `format="count"` yang merender angka tabular biasa; default tetap `money` supaya pemanggil lama tidak berubah.
- **`bun run format:check` merah untuk 29 file, dan itu drift lama, bukan akibat migrasi.** Sebagian besar `features/**` plus `GEMINI.md`, `docs/ANTIGRAVITY_INDEX.md`, dan beberapa snapshot drizzle. Tidak satu pun disentuh Step 0–2. Gerbang resmi hanya `test` + `build` + `lint`; jangan menjalankan `prettier --write .` di tengah migrasi karena akan mencampur ratusan baris format ke dalam diff yang harus tetap terbaca sebagai rename murni. Bereskan terpisah setelah migrasi.

---

## Prompt

> Salin mulai dari sini.

```
Aku melanjutkan migrasi Atria ERP jadi cross-platform (web + native Android/iOS
dengan Expo SDK 57). Repo: /Volumes/DekoriaSSD/App Projects/Websites/atria-erp,
branch `development`.

BACA DULU, berurutan, sebelum menyentuh apa pun:
1. docs/plans/2026-08-15-expo-cross-platform-migration.md   — rencana lengkap
2. docs/plans/2026-08-15-expo-migration-handoff.md          — posisi sekarang
3. docs/plans/2026-08-15-expo-native-phase-2-3-screens.md   — unit P2.x/P3.x
4. CLAUDE.md dan AGENTS.md                                  — aturan repo
5. DESIGN.md + .impeccable/design.json                      — sistem visual

Repo ini SUDAH jadi Bun monorepo: Next app ada di apps/web/, root cuma workspace
+ docs. Step 0-9, Phase 3-5, P2.1, P2.1b, P2.2, P2.2b, P2.3, dan P2.4 sudah
selesai dengan semua gerbang hijau (550 test pass, build ✓, lint 0 error).

TUGASMU: kerjakan P2.5 — Setup, approval budget, dan aktivasi Proyek. Berhenti
setelah P2.5.

Cakupan P2.5 (persis ini, tidak lebih):
- Ekstrak use-case budget/activation satu per mutation (jangan digabung satu
  use-case besar) tanpa mengubah formula atau isi `db.transaction`.
- Port form alokasi kategori, review budget, approve/reject, reallocation
  dengan alasan, dan activation checklist ke native.
- Settings hanya dibaca sebagai default untuk budget baru; perubahan Settings
  tidak boleh mengubah budget proyek yang sudah ada.
- Bukti wajib mencakup: persentase kategori, buffer tidak teralokasi, approval,
  audit log, dan locked tabs (bandingkan dengan `isLocked` yang sudah dikirim
  `screen.projectOverview` di P2.4 — jangan hitung ulang dengan formula baru).
- JANGAN ikut memindahkan RAP/RAB (itu P2.6/P2.7) atau menyentuh ringkasan
  overview yang sudah ada di P2.4.

Aturan yang tidak boleh dilanggar:
- Satu unit = satu pekerjaan. Jangan gabungkan unit. Kalau gerbang merah,
  perbaiki dulu, jangan lanjut.
- Gerbangnya, semua dari root repo: `bun run test` (baseline 550 pass: core 121 +
  web 429, termasuk token drift check, 0 fail), `bun run build`, `bun run lint`
  (0 error; 1 warning Storybook lama memang sudah ada). Angkanya harus sama atau
  lebih baik, tidak boleh turun. Untuk mobile: `cd apps/mobile` lalu typecheck,
  lint, dan `bunx expo export --platform ios` + `--platform android`.
- Saat memakai `FactRow` atau primitive lain yang menerima `ReactNode` sebagai
  `value`, JANGAN menambahkan `maxWidth` lagi di kontainer lokal —
  `factSlot` (`components/ui/grouped-surface.tsx`) sudah membatasi 58%; double
  `maxWidth: "58%"` bersarang jadi ~34% dan memotong teks pendek sekalipun.
  Ketahuan di P2.4 pada baris kategori budget.
- Kalau memverifikasi di simulator iOS lewat `bunx expo start`, JANGAN memakai
  flag `--localhost` — di mesin ini itu mengikat Metro ke IPv6 loopback saja
  sehingga Expo Go yang connect ke `127.0.0.1:8081` gagal walau `/status`
  tetap 200. Pakai `bunx expo start --port 8081` polos.
- JANGAN jalankan `bun test` telanjang dari root repo — bunfig.toml ada di
  apps/web dan dimuat dari cwd. Pakai `bun run test` dari root, atau
  `cd apps/web && bun test`.
- Jangan pernah menyimpulkan hijau hanya dari `bun test`. Pernah terjadi test
  hijau padahal `tsc` merah (re-export tidak membawa nama ke scope lokal).
  `bun run build` yang menangkapnya.
- Guardrail finansial tidak boleh diketik ulang saat refactor. Saat memindahkan
  badan Server Action ke use-case, isi `db.transaction` dipindah verbatim —
  satu-satunya substitusi yang diizinkan adalah `currentUser.id` → `actor.userId`.
  Row lock pesimistik, gerbang approval >= Rp 5.000.000, penulisan
  cash_transaction + audit_log, dan immutability baris terekonsiliasi semuanya
  harus tetap identik.
- Daftar route API dikunci oleh asersi allowlist di
  apps/web/lib/architecture/server-boundaries.test.ts. Sekarang tepat tiga:
  auth, ai/chat, dan trpc. Jangan pernah ada route keempat.
- Kode yang dipakai bersama web dan mobile harus murni: tanpa next/*, react*,
  drizzle-orm, better-auth, server-only, node:*, atau impor `@/`. Ada test purity
  yang menegakkannya di packages/core.
- Mutation tidak boleh mempercayai user ID atau role dari client. Input mutation
  wajib divalidasi Zod. Strict TypeScript; jangan menambah `any`.
- UI native wajib sesuai DESIGN.md, bukan kira-kira. Cek nilai token yang
  sesungguhnya sebelum menulis style — di P2.2b ketahuan `SegmentedTabs` native
  melanggar spec di empat titik sekaligus dan pil tab aktif tidak pernah dirender.
  Kalau kamu membuat atau menyentuh primitive, bandingkan dengan padanan webnya.
- Copy user-facing dan komentar domain memakai Bahasa Indonesia. Ikuti bahasa
  di sekitarnya saat mengedit.
- Working tree `development` kotor dan itu disengaja (884+ path, belum di-commit).
  Jangan reset, checkout, stash, atau menimpa perubahan yang sudah ada. Pakai
  edit patch, bukan penulisan ulang file. JANGAN commit kecuali diminta pemilik
  repo.
- `bun run format:check` merah untuk 29 file dan itu drift lama, bukan akibat
  migrasi. Jangan menjalankan `prettier --write .` untuk "membereskannya".

Verifikasi yang diharapkan sebelum menyatakan selesai:
- Buktikan setiap guard baru benar-benar menggigit: rusakkan sekali, lihat merah,
  lalu pulihkan.
- Buktikan permission dan scope approval/aktivasi lewat bearer token sungguhan,
  bukan asumsi — termasuk siapa yang boleh approve/reject dan reallocation.
- Verifikasi alur setup budget → approve → aktivasi di simulator iOS dengan data
  seed nyata. Pastikan ada baris `iOS Bundled` baru di log Metro sebelum menilai
  perubahan UI — bundle basi Expo Go pernah menyesatkan pembacaan, dan jangan
  pakai `bunx expo start --localhost` (lihat aturan di atas).
- Bersihkan data uji coba yang kamu buat setelah verifikasi.

Setelah P2.5 selesai dan gerbangnya hijau, perbarui tabel "Posisi sekarang" dan
catatan bukti di docs/plans/2026-08-15-expo-migration-handoff.md, lalu berhenti.

Mulai dengan melaporkan rencana konkretmu sebelum mengubah file.
```

> Sampai sini.

---

## Cara menjalankan di tiap agent

Skill Expo resmi (25 skill) sudah terpasang project-scoped di `.agents/skills/` dan ikut ter-commit, jadi **agent apa pun yang membaca `.agents/skills/` langsung dapat pengetahuan Expo SDK 57 tanpa setup tambahan.**

### Codex

```bash
cd "/Volumes/DekoriaSSD/App Projects/Websites/atria-erp"
codex
```

Plugin Expo sudah terpasang (`codex plugin add expo@openai-curated`). Codex membaca `AGENTS.md` di root. Tempel Prompt di atas.

### Antigravity / Gemini

```bash
cd "/Volumes/DekoriaSSD/App Projects/Websites/atria-erp"
```

Antigravity membaca `GEMINI.md` di root repo ini (sudah ada) plus `.agents/skills/`. Buka project-nya di Antigravity, lalu tempel Prompt.

### Claude Code (sesi baru)

```bash
cd "/Volumes/DekoriaSSD/App Projects/Websites/atria-erp"
claude
```

Plugin Expo terpasang di user scope, jadi skill + Expo MCP server otomatis aktif. Tempel Prompt.

### Cursor / Windsurf / lainnya

`.agents/skills/` sudah ada di repo. Kalau agent-nya belum membaca direktori itu:

```bash
npx skills@latest add expo/skills --skill '*'
```

---

## Perintah rujukan

```bash
# gerbang lengkap — jalankan dari root
bun run test && bun run build && bun run lint

# satu file test
cd apps/web && bun test lib/finance/dashboard.test.ts

# architecture tests saja (paling sering dipakai selama Step 3-4)
cd apps/web && bun test lib/architecture/

# dev server (LAN aktif — dibutuhkan Expo dev client nanti)
bun run dev

# format
bun run format
```

## Yang sengaja BUKAN bagian dari rencana ini

### Pembaruan 1 Oktober 2026 — lifecycle mobile

Navigasi menu/dock sekarang berbagi tab navigator yang sama dan mengembalikan stack workspace di dalam wrapper Expo `__root`. Dashboard tanpa parameter eksplisit mempertahankan subtab. Shared screen queries mengisolasi cache per akun/sesi/izin, refresh saat fokus/resume, menjaga cached content saat gagal, menangani first-load offline, dan memakai abort signal. Filter/subtab/scroll memakai memori sesi; tidak ada cache finance baru di disk atau antrean mutation offline. Native chrome yang sudah disepakati tetap dipertahankan.

Rincian implementasi, acceptance dan batas verifikasi: [mobile navigation/loading](./2026-10-01-mobile-navigation-loading.md). Typecheck, lint workspace, 17 mobile tests dan export iOS/Android lolos. Root format check masih menandai 239 file di luar perubahan task ini; format file yang diubah lolos.

Supaya penerus tidak "membetulkan" hal yang sengaja ditinggalkan:

- **Tidak ada `packages/db`.** `@/db` diimpor 111 file, dan `db/seed.ts` → `@/lib/auth` → `@/db` bikin siklus. Mobile tidak pernah menyentuh DB.
- **Tidak ada `packages/api`.** Screen loader mengimpor tipe UI dari komponen feature, jadi paket API bersama akan bergantung pada `apps/web/features/**`. Use-case tinggal di `apps/web/server/`.
- **NativeWind 4.2.6 sudah aktif.** Mobile memakai NativeWind untuk komposisi RN, generated Tailwind config dari token web, dan typed theme/StyleSheet untuk kebutuhan lainnya. Pertahankan Metro css-interop dedupe. Brief September tidak meminta upgrade NativeWind v5; native SwiftUI controls memakai props/modifiers, bukan className.
- **Tidak ada dark mode.** Sistem ini light-only secara desain. Kunci `userInterfaceStyle: "light"` di `app.json`.
- **`success` sengaja ink netral, bukan hijau** (One Accent Rule di DESIGN.md). Jangan "perbaiki".
