# Native notification banner reliability — 2026-09-12

## Ringkasan

Web Push sudah terpasang di server dan klien, tetapi banner tidak sampai ke
pemilik perangkat iOS, dan bisa hilang diam-diam di perangkat mana pun yang
catatan langganannya hilang di server. Pekerjaan ini menutup empat celah:

1. Kontrol di `/notifications` menyebut "browser ini belum mendukung push
   notification" untuk iOS Safari di tab biasa. Itu salah, dan pengguna iOS
   tidak pernah diberi cara memperbaikinya.
2. Langganan perangkat yang sudah hidup tidak pernah dicatat ulang ke server.
   Reset basis data, perpindahan tenant, atau POST yang gagal membuat pengguna
   melihat "Aktif" tanpa baris `user_push_subscription`.
3. Tujuan notifikasi hasil `notificationDestination` belum pernah dibandingkan
   sistematis dengan allowlist service worker dan rute Next.js nyata.
4. Klien Expo belum memastikan syarat banner OS: izin runtime Android 13,
   kanal notifikasi ber-importance tinggi, dan tujuan tap yang mendarat di rute
   native nyata.

## 1. Kebenaran keadaan push di web

`apps/web/features/notifications/utils/push-state.ts` memisahkan keputusan dari
render. `resolvePushState(signals)` menerima `PushEnvironment` (`install` dari
`readInstallEnvironment`, `pushApiSupported`, `serverKeyConfigured`),
`PushPermission`, `ServerRegistration`, dan `subscribed`.

| Keadaan                | Syarat                                                        | Aksi          |
| ---------------------- | ------------------------------------------------------------- | ------------- |
| `unconfigured`         | VAPID public key kosong                                       | —             |
| `ios-install-required` | platform iOS dan `!isIosPushAvailableWithoutInstall(install)` | —             |
| `unsupported`          | Push API tidak ada di browser non-iOS (atau iOS terpasang)    | —             |
| `denied`               | `Notification.permission === "denied"`                        | —             |
| `disabled`             | izin belum diminta / belum berlangganan                       | Aktifkan      |
| `sync-required`        | izin `granted`, langganan hidup, pencatatan server gagal      | Sambung ulang |
| `enabled`              | izin `granted`, langganan hidup, server terkonfirmasi         | Matikan       |

Urutan cabang adalah kontrak: panduan pemasangan iOS diperiksa **sebelum**
`unsupported`, sehingga tab Safari iOS yang belum dipasang tidak lagi disebut
tidak mendukung. `PUSH_STATE_COPY` adalah satu-satunya sumber salinan; komponen
hanya memetakan `action` ke satu `Button size="mini"` yang sudah ada, memakai
`GroupedSurface`, ikon tile, dan `StatusBadge` tanpa primitif baru.

Salinan iOS memakai badge "Perlu dipasang" bertone `pending` dan menjelaskan
langkah Bagikan → Tambahkan ke Layar Utama. Tidak ada tombol yang tidak bisa
berhasil dari tab biasa.

## 2. Rekonsiliasi langganan

`apps/web/features/notifications/utils/push-sync.ts` mengekspor
`inspectWebPush(deps)`: logika murni terhadap environment, permission, langganan,
dan callback `register`. Komponen menyuntikkan klien nyata; tes menyuntikkan
perangkat palsu dengan state server yang bertahan antar-panggilan.

Perilaku yang dikunci tes:

- langganan hidup + catatan server hilang → dipulihkan, `serverRegistration`
  menjadi `confirmed`;
- pemanggilan berulang tetap meninggalkan satu catatan (idempoten);
- tanpa langganan → `register` tidak pernah dipanggil;
- izin belum `granted` → tidak ada penulisan server;
- `register` yang menolak atau melempar → `failed`, dan langganan perangkat
  tidak dicabut hanya karena satu percobaan gagal.

Sisi server sudah idempoten dan tidak perlu diubah. Bukti: pada
`registerPushSubscription`
(`apps/web/server/usecases/notifications/notification-queries.ts`), kredensial
dikunci lebih dulu lewat `notificationCondition` (`SELECT … FOR UPDATE`), baris
yang cocok dicari dengan `(tenantId, platform, credential)`, kembar lama
dipensiunkan, lalu baris pertama diperbarui atau baris baru disisipkan — tidak
ada jalur yang bisa menumpuk baris kembar. Fixture database kini membuktikan
hal itu: dua kali `registerPushSubscription` untuk endpoint yang sama tetap
menyisakan satu baris, dan `p256dh` diperbarui ke nilai kedua.

`enable()` juga sudah menangani langganan tanpa catatan server: langganan yang
sudah ada dipakai ulang (`existing ?? subscribe`), bukan dibuat ulang, dan hanya
langganan **baru** yang dibatalkan saat pencatatan server gagal. Urutan
`disable()` — server dulu, baru `unsubscribe()` perangkat — dipertahankan,
sehingga kegagalan jaringan tidak meninggalkan baris server aktif untuk
perangkat yang sudah mencabut langganan.

## 3. Audit tujuan notifikasi

Sumber tunggal: `notificationDestination` di
`packages/core/src/notifications/types.ts`. Nilainya adalah
`safeNotificationUrl(actionUrl)` — allowlist sama dengan service worker — yang
kemudian dipetakan ulang untuk `rab`/`change_order` ber-`projectId` dan untuk
tab proyek berdasarkan `referenceType`.

`notificationDestination` dapat menghasilkan tepat 18 tujuan berbeda:

| #   | Tujuan                                | `referenceType` pemicu                                          | Route Next.js                    |
| --- | ------------------------------------- | --------------------------------------------------------------- | -------------------------------- |
| 1   | `/approvals`                          | cost/vendor_payment/opening inventory, aksi `/approvals`        | `app/approvals/page.tsx`         |
| 2   | `/expenses`                           | cost/vendor_bill tanpa `projectId`, aksi `/expenses`            | `app/expenses/page.tsx`          |
| 3   | `/expenses?filter=NEEDS_VERIFICATION` | cost `SUBMITTED`                                                | `app/expenses/page.tsx`          |
| 4   | `/ledger`                             | referensi non-proyek, notifikasi system                         | `app/ledger/page.tsx`            |
| 5   | `/materials`                          | goods_receipt, stock_count, material minimum                    | `app/materials/page.tsx`         |
| 6   | `/materials/opening`                  | inventory_opening pending/posted/reversed                       | `app/materials/opening/page.tsx` |
| 7   | `/notifications`                      | aksi `/notifications`                                           | `app/notifications/page.tsx`     |
| 8   | `/reconciliation`                     | notifikasi system/reconciliation                                | `app/reconciliation/page.tsx`    |
| 9   | `/projects/<id>`                      | project, project_budget, rab, change_order tanpa tab            | `app/projects/[id]/page.tsx`     |
| 10  | `/projects/<id>?tab=budget`           | project_budget, vendor_bill due, vendor_payment, project health | idem, tab internal               |
| 11  | `/projects/<id>?tab=expenses`         | project_cost, vendor_bill, vendor_payment                       | idem                             |
| 12  | `/projects/<id>?tab=invoices`         | client_invoice                                                  | idem                             |
| 13  | `/projects/<id>?tab=materials`        | goods_receipt, rap shortage                                     | idem                             |
| 14  | `/projects/<id>?tab=overview`         | fallback `projectId` tanpa tab dikenal                          | idem                             |
| 15  | `/projects/<id>?tab=payments`         | client_invoice, client_payment                                  | idem                             |
| 16  | `/projects/<id>?tab=rab`              | rab, change_order ber-`projectId`                               | idem                             |
| 17  | `/projects/<id>?tab=rap`              | rap tanpa shortage                                              | idem                             |
| 18  | `/projects/<id>?tab=stok`             | stock_movement, goods_receipt_reversal                          | idem                             |

Hasil: **tidak ada ketidaksesuaian di kedua arah.**

- Setiap tujuan lolos allowlist service worker
  `/^\/(approvals|projects|materials|expenses|ledger|notifications|reconciliation)([/?#]|$)/`.
  Allowlist itu byte-identik dengan allowlist `safeNotificationUrl`, jadi service
  worker tidak pernah menulis ulang tujuan sah menjadi `/notifications`.
- Setiap pathname cocok dengan `page.tsx` nyata. Tab proyek bukan rute terpisah:
  `ProjectTabs` membaca `?tab=` lewat `useUrlSearchParam("tab")` dan `toTabId`
  memvalidasi nilainya terhadap `TABS`, dengan fallback yang aman.
- `safeNotificationUrl` tetap same-origin only. Diperiksa: `//evil.test/projects`
  → `null`, `https://evil.test/projects` → `null`, `/\evil.test` → `null`,
  `javascript:alert(1)` → `null`, `/projects\x` → `null`, path dengan karakter
  kontrol (≤ 32) → `null`. `new URL(value, "https://atria.invalid")` hanya
  dipakai setelah prefix dan protokol-relative disaring, dan hasilnya
  direkonstruksi dari `pathname`/`search`/`hash`.

Tidak ada perubahan yang dibutuhkan pada `apps/web/public/notification-sw.js`,
karena itu tidak ada diff yang perlu diserahkan ke pemilik berkas tersebut.

**Catatan role.** Tujuan role-dependent tetap benar sebagai tujuan penurunan
pengguna: notifikasi hanya dikirim ke penerima yang lolos `requiredPermission`
dan scope proyek (`recordNotificationEvent`, `notification-events.ts`), dan
halaman yang dibuka menampilkan keadaan terbatas alih-alih data (`/approvals` →
`PageState` restricted; `/expenses` → redirect `/projects` untuk role tanpa
`view:cost`; `/reconciliation` → pesan akses tidak tersedia). `/ledger` hanya
dituju notifikasi `system`/referensi non-proyek yang tidak membawa data proyek,
jadi tidak ada kebocoran lintas role.

Kesepakatan ini dijaga `apps/web/features/notifications/destination-allowlist.test.ts`:
tes membaca literal `actionUrl` dari `app/`, `server/`, dan `db/`, mengalikannya
dengan setiap `NOTIFICATION_REFERENCE_TYPES` × ada/tidaknya `projectId`, lalu
memastikan setiap tujuan lolos allowlist service worker dan cocok dengan
`page.tsx` nyata. Rute notifikasi baru otomatis ikut terperiksa.

## 4. Klien Expo

Ditemukan dan diperbaiki:

- **Izin runtime Android 13.** `POST_NOTIFICATIONS` tidak ada di
  `android.permissions`. Tanpa izin itu, `requestPermissionsAsync` di Android 13+
  tidak akan pernah menampilkan prompt dan tidak ada banner yang bisa muncul.
  Sekarang terdaftar di `apps/mobile/app.json`.
- **`channelId` tidak pernah dikirim.** Aplikasi sudah membuat kanal `operasional`
  ber-importance tinggi, tetapi worker mengirim pesan Expo tanpa `channelId`,
  sehingga Android memakai kanal cadangan bawaan library (`IMPORTANCE_HIGH`,
  nama generik). Konstanta `ANDROID_NOTIFICATION_CHANNEL_ID` sekarang tinggal di
  `@atria/core/notifications/types`, dipakai klien untuk membuat kanal dan
  worker untuk mengirimnya — hanya untuk `EXPO_ANDROID`; payload iOS tetap
  tanpa `channelId`.
- **Kanal belum ada saat izin diminta.** `setNotificationChannelAsync` hanya
  dipanggil di dalam `registerDevice`. Sekarang kanal disiapkan sebelum
  pemeriksaan izin, sekali per proses.
- **`shouldPlaySound: false`** membuat notifikasi yang tiba saat aplikasi terbuka
  senyap meskipun server mengirim `sound: "default"`. Diubah menjadi `true`.
- **Peta rute tandingan.** `safeNotificationUrl` dipakai langsung sebagai
  tujuan `router.push`, sehingga `/reconciliation`, `/materials/opening`, dan
  `/projects/<id>?tab=stok` didorong ke rute yang belum ada di aplikasi native.
  `apps/mobile/src/lib/notification-route.ts` memetakannya ke rute native nyata:
  tab proyek dibuang, `/reconciliation` → `/ledger`, halaman turunan memakai
  layar induknya, dan rute asing memakai tab pertama sesuai peran
  (`getRoleNavItems`), bukan rute hard-coded.
- **Kegagalan senyap.** `.catch(() => undefined)` pada penyiapan dan penyegaran
  token menelan kegagalan tanpa jejak. Sekarang kegagalan dicatat lewat
  `console.warn` hanya di `__DEV__`.

Diverifikasi tanpa perangkat: konfigurasi `app.json`, TypeScript (`tsc --noEmit`
di `apps/mobile`), dan tes unit pemetaan rute. **`[UNVERIFIED — needs real
device]`**: banner OS yang benar-benar muncul di Android 13+ dan iOS, prompt izin
sistem, heads-up dari kanal `operasional`, penerimaan APNs/FCM, dan rute tap pada
notifikasi nyata.

## 5. Paritas payload server

Payload Web Push `{ title, body, url, notificationId }` dikonsumsi service worker
apa adanya: `title` dan `body` dipakai untuk `showNotification`, `url` lewat
`safeDestination`, `notificationId` menjadi `tag` (`renotify: false`) agar
pengiriman ulang menimpa notifikasi yang sama.

Payload Expo `{ to, title, body, data: { notificationId, url }, sound,
channelId? }` dikonsumsi klien: `title`/`body` dirender sistem, `data.url` lewat
`safeNotificationUrl` lalu `resolveMobileNotificationRoute`, `data.notificationId`
tersedia untuk deduplikasi, `sound: "default"` dan `channelId` mengatur kanal.
Tidak ada field yang dikirim tetapi tidak dibaca, dan tidak ada yang dibaca
tetapi tidak pernah dikirim. Tidak ada perubahan payload yang diperlukan selain
penambahan `channelId` di atas.

## 6. Verifikasi

Perintah dan hasil nyata:

```
cd apps/web && bun test features/notifications
  38 pass, 0 fail — 8 file
cd apps/web && bun test features/notifications/notification-database.test.ts
  1 pass, 0 fail
cd apps/web && bun test features/notifications/destination-allowlist.test.ts
  2 pass, 0 fail — 22 expect
cd apps/web && bun test features/notifications/utils/push-state.test.ts
  8 pass, 0 fail
cd apps/web && bun test features/notifications/utils/push-sync.test.ts
  6 pass, 0 fail
cd apps/mobile && bun test src/lib/notification-route.test.ts
  5 pass, 0 fail
cd apps/mobile && bunx tsc --noEmit -p tsconfig.json
  exit 0
```

Berkas yang diubah dan dibuat:

- `apps/web/features/notifications/components/web-push-control.tsx`
- `apps/web/features/notifications/utils/push-state.ts` (baru)
- `apps/web/features/notifications/utils/push-sync.ts` (baru)
- `apps/web/features/notifications/utils/push-state.test.ts` (baru)
- `apps/web/features/notifications/utils/push-sync.test.ts` (baru)
- `apps/web/features/notifications/destination-allowlist.test.ts` (baru)
- `apps/web/features/notifications/fixtures/database-case.ts`
- `apps/web/server/services/notification-delivery.ts`
- `packages/core/src/notifications/types.ts`
- `apps/mobile/src/providers/push-notifications-provider.tsx`
- `apps/mobile/src/lib/notification-route.ts` (baru)
- `apps/mobile/src/lib/notification-route.test.ts` (baru)
- `apps/mobile/app.json`
- `apps/mobile/tsconfig.json`
- `docs/guide/notifications.md`

Tidak ada berkas PWA yang disentuh: `notification-sw.js`, `app/layout.tsx`,
`next.config.ts`, `app/manifest.ts`, `lib/pwa/**`, `features/pwa/**`,
`app/offline/**`, dan aset ikon semuanya milik agen lain.

**`[UNVERIFIED — needs real device]`**: banner OS Android/iOS yang sebenarnya,
prompt izin sistem, dan tap notifikasi pada perangkat. Butuh build
development/production dengan credentials APNs/FCM; remote push SDK 53+ tidak
didukung di Expo Go.
