# Pemasangan PWA dan WebAPK Android

**Tanggal:** 2026-09-13
**Terkait:** `docs/guide/vercel-deployment.md`, `docs/plans/2026-09-12-pwa-webapk-install-fix.md`

Panduan ini menjawab satu pertanyaan: bagaimana memasang Atria di ponsel Android
sebagai **WebAPK sungguhan** — ikon di launcher, tanpa address bar, tanpa lencana
Chrome — dan bagaimana membuktikan jalur pemasangannya bersih sebelum menyalahkan
manifest, ikon, atau aplikasinya.

## Ringkasan cepat

| Langkah | Perintah |
| --- | --- |
| Buka tunnel HTTPS | `cloudflared tunnel --url http://localhost:3300` |
| Salin host tunnelnya | mis. `https://<kata>-<kata>-<kata>.trycloudflare.com` |
| Build produksi dengan origin tunnel (inline) | `TUNNEL=https://<host-tunnel> BETTER_AUTH_URL=$TUNNEL NEXT_PUBLIC_APP_URL=$TUNNEL bun run build` |
| Sajikan di port 3300 dengan origin tunnel (inline) | `TUNNEL=https://<host-tunnel> BETTER_AUTH_URL=$TUNNEL PORT=3300 bun run start` |
| Buka di ponsel | buka `https://<host-tunnel>/login` di Chrome Android |

Origin tunnel diberikan sebagai **variabel shell inline**, dan **tidak pernah**
dituliskan ke `.env`, `.env.local`, atau berkas `.env*` mana pun. Rinciannya di
bawah.

## Mengapa HTTPS wajib

WebAPK hanya bisa dicetak dari **secure context**. Chrome menolak mencetak WebAPK
bila origin-nya tidak aman, dan diam-diam turun ke *shortcut* biasa. Karena itu:

- `bun run dev` memakai `scripts/dev-lan.mjs`, yang memilih alamat LAN
  (`http://192.168.x.x:3000`). Alamat itu **tidak pernah** bisa dipakai untuk
  menguji WebAPK: `isSecureContext` bernilai `false`, service worker tidak
  terdaftar, dan `Page.getInstallabilityErrors` akan melaporkan
  `not-in-secure-context`. Ini bukan bug manifest.
- `http://localhost:3000` **adalah** secure context (Chrome memperlakukan
  `localhost` sebagai aman), tetapi ponsel tidak bisa menjangkau `localhost`
  komputer Anda. Karena itu perlu tunnel HTTPS.
- `https://atria-erp.vercel.app` adalah origin produksi yang sungguhan, tetapi
  saat panduan ini ditulis ia belum menyajikan berkas PWA sama sekali — lihat
  bagian *Perbaikan produksi yang sebenarnya* di bawah.

Ringkasnya: **tunnel HTTPS adalah cara membawa secure context ke ponsel.**

## Prasyarat: authtoken ngrok

`ngrok` dipasang lewat Homebrew (`brew install ngrok/ngrok/ngrok`), tetapi
**authtoken belum terpasang** di mesin pengembangan ini. Tanpa authtoken, ngrok
menolak membuka sesi:

```
ERROR: authentication failed: This ngrok session is not authenticated.
ERR_NGROK_4018
```

Authtoken harus ditambahkan sendiri oleh pemilik akun; jangan menempelkan token
ke dalam obrolan atau ke berkas mana pun di repo:

```bash
ngrok config add-authtoken <token-dari-dashboard-ngrok>
```

Perintah `ngrok config check` akan melaporkan berkas konfigurasi yang dipakai
(mis. `~/Library/Application Support/ngrok/ngrok.yml`). Cukup laporkan
keberadaannya, jangan pernah menyalin isinya.

Pada ngrok 3.x, domain tetap dipilih dengan **`--url`** (bukan `--domain` atau
`--hostname`):

```bash
ngrok http --url=https://<nama-dev-domain>.ngrok-free.app 3300
```

Paket gratis mendapatkan **satu dev domain yang stabil per akun**, jadi URL-nya
tidak berubah setiap restart. Domain statis cadangan (`--url`) memerlukan paket
berbayar; URL acak (`--url 'https://'`) juga berbayar.

### Jebakan: halaman perantara (interstitial) ngrok

ngrok paket gratis menampilkan halaman peringatan "You are about to visit…" di
depan **trafik HTML peramban**. Dokumentasi resminya (`ERR_NGROK_6024` dan
*Free Plan Limits*) menyebut dua cara melewatinya: mengirim header
`ngrok-skip-browser-warning`, atau memakai User-Agent non-standar. Chrome tidak
mengirim keduanya, dan halaman itu muncul sekali per domain (lalu ditekan cookie
selama 7 hari).

Apakah ini merusak pemasangan PWA? Yang bisa dipastikan secara terukur:

- Permintaan manifest, service worker, dan ikon **bukan navigasi**, sehingga
  tidak tersentuh halaman perantara yang menyasar navigasi dokumen. Terukur
  dengan Chrome 152 ber-UA Android pada server uji: hanya permintaan dokumen
  yang membawa `Sec-Fetch-Mode: navigate`.

  | Permintaan | `Accept` | `Sec-Fetch-Dest` | `Sec-Fetch-Mode` |
  | --- | --- | --- | --- |
  | dokumen (`/login`) | `text/html,application/xhtml+xml,…` | `document` | `navigate` |
  | `/manifest.webmanifest` | `*/*` | `manifest` | `cors` |
  | `/notification-sw.js` | `*/*` | `serviceworker` | `same-origin` |
  | `/icons/*.png` | `image/avif,image/webp,…,image/*,*/*` | `image` | `no-cors` |

  Hanya baris pertama yang merupakan navigasi. Manifest tetap dibaca sebagai
  JSON.
- Namun halaman perantara **akan** muncul saat pertama kali membuka aplikasi di
  ponsel, sebelum cookie-nya tertanam. Itu mengganggu, meski tidak mematikan
  pemasangan.

**Kesimpulan:** untuk jalur ini, pakai `cloudflared`. Ia tidak punya perantara
sama sekali dan sudah terbukti bersih di sini (semua permintaan 200 + tipe konten
benar). ngrok tetap berguna bila Anda menginginkan domain **stabil** dan sudah
memasang authtoken — perantaranya tidak menghalangi manifest, tetapi akan muncul
sekali di layar ponsel.

```bash
# tanpa perantara, tanpa akun:
brew install cloudflared
cloudflared tunnel --url http://localhost:3300
```

Quick tunnel `trycloudflare.com` mendapat nama acak setiap kali dijalankan, jadi
URL-nya berubah tiap restart. Itu berarti setiap kali restart tunnel Anda harus
menjalankan ulang **build** dan **start** dengan origin tunnel yang baru (lihat
peringatan di bawah) — tanpa menyunting berkas `.env*` apa pun.

## Menyiapkan origin

Aplikasi harus tahu origin yang dilihat ponsel, bukan `localhost`. Nilai itu
diberikan sebagai **variabel shell inline** pada perintah build/start — **jangan**
disimpan ke `.env`, `.env.local`, atau berkas `.env*` mana pun.

```
BETTER_AUTH_URL="https://<host-tunnel>"
NEXT_PUBLIC_APP_URL="https://<host-tunnel>"
```

Keduanya harus berupa **origin saja** — tanpa garis miring di akhir, tanpa jalur.

- `BETTER_AUTH_URL` masuk ke `getConfiguredOrigins()` di `apps/web/lib/auth.ts`
  dan menentukan `trustedOrigins`. Origin yang tidak terdaftar ditolak Better Auth
  dengan `403 {"message":"Invalid origin","code":"INVALID_ORIGIN"}`, yang muncul
  di ponsel sebagai kegagalan login yang membingungkan.
- `NEXT_PUBLIC_APP_URL` dibaca di `apps/web/lib/auth-client.ts`.

### Kenapa inline, bukan `.env.local`

Next.js memuat `.env.local` di **semua** environment, dan `.env.local` menang atas
`.env`. Akibatnya, menuliskan origin tunnel ke `.env.local` membuat `bun run dev`
di `localhost` juga memakai origin tunnel: berkas klien dev menyisipkan origin
tunnel (terlihat sebagai `TURBOPACK compile-time value` di
`.next/static/chunks/*.js`), sehingga peramban mengirim POST auth ke host tunnel,
dan `trustedOrigins` tidak lagi memuat `http://localhost:3000`. Gejalanya:
login lokal gagal `failed to fetch`, dan server lokal menjawab
`403 INVALID_ORIGIN`. Itulah regresi yang pernah terjadi di sini.

Variabel **inline** tidak pernah masuk ke berkas mana pun, karena ia hanya hidup
di environment proses yang menjalankan perintah itu. `bun run dev` yang dijalankan
tanpa variabel tersebut tetap membaca `.env` dan mendapat `http://localhost:3000`.
Bukti terukur di mesin ini: memanggil loader `@next/env` dengan
`NEXT_PUBLIC_APP_URL` di environment mengembalikan nilai inline, sedangkan tanpa
variabel itu hasilnya kembali ke nilai `.env`
(`RESOLVED=http://localhost:3000`).

> **Peringatan build-time.** `NEXT_PUBLIC_*` **disisipkan saat `bun run build`**,
> bukan saat `bun run start`. Nilai yang salah menghasilkan build yang masih
> menunjuk `localhost` dan gagal hanya di ponsel — sulit dilacak. Karena itu
> variabel inline **wajib diberikan ulang pada perintah `start` yang menyajikan
> hasil build**, dan urutan yang benar selalu: **`bun run build` (dengan origin
> tunnel) → `bun run start` (dengan origin tunnel) → tunnel**. Terbukti di sini:
> origin tunnel muncul di berkas klien hasil build (`.next/static/chunks/*.js`),
> sedangkan `localhost:3000` tidak muncul sama sekali.

`allowedDevOrigins` di `apps/web/next.config.ts` **tidak relevan** untuk jalur ini
karena kita memakai build produksi. Nilai itu hanya perlu ditambah host tunnel
bila Anda menjalankan `next dev` (mis. `bun run dev:default`) alih-alih build
produksi.

Origin lain yang sudah ditangani otomatis dan tidak perlu diubah:
`getTrustedOrigins()` di `apps/web/lib/auth.ts` juga menerima origin jaringan
privat saat `NODE_ENV=development`, dan `app/layout.tsx` **tidak** menyetel
`metadataBase`, sehingga tidak ada URL kanonik/OG yang bisa salah menunjuk di
belakang tunnel.

> **Jangan pernah menaruh origin tunnel di `.env.local`.** Itu satu-satunya cara
> membuat jalur tunnel merusak `bun run dev`. Bila login lokal tiba-tiba gagal
> setelah pekerjaan tunnel, periksa `.env.local` terhadap origin tunnel yang
> tertinggal (lihat bagian *Pemecahan masalah*).

## Langkah lengkap

Dari **root repo** (bukan dari `apps/web`). Perhatikan urutannya: **tunnel dulu**,
supaya originnya sudah diketahui sebelum build.

```bash
# 1. Terminal pertama: sajikan hasil build di port non-3000 agar tidak menabrak
#    `bun run dev`. Jalankan tunnel lebih dulu juga tidak masalah; yang wajib
#    adalah originnya diketahui SEBELUM langkah build di bawah.
cloudflared tunnel --url http://localhost:3300
#    → https://<kata>-<kata>-<kata>.trycloudflare.com

# 2. Salin origin itu (tanpa garis miring di akhir), lalu build produksi.
#    Variabel ini HANYA hidup di perintah ini — tidak ditulis ke berkas mana pun.
TUNNEL=https://<host-tunnel> \
  BETTER_AUTH_URL=$TUNNEL NEXT_PUBLIC_APP_URL=$TUNNEL \
  bun run build

# 3. Sajikan hasil build dengan origin yang sama. `start` perlu variabelnya
#    kembali supaya `trustedOrigins` server memuat origin tunnel.
TUNNEL=https://<host-tunnel> \
  BETTER_AUTH_URL=$TUNNEL PORT=3300 \
  bun run start

# 4. Buka https://<host-tunnel>/login di Chrome Android.
```

Port 3300 dipilih agar tidak menabrak `bun run dev` yang memakai 3000. Untuk
menghentikan sesi tunnel, tekan Ctrl-C di kedua terminal — tidak ada berkas yang
perlu dibersihkan.

## Pemecahan masalah

**Login lokal (`bun run dev`) tiba-tiba gagal `failed to fetch` setelah pekerjaan
tunnel.** Periksa `apps/web/.env.local` apakah ada origin tunnel yang tertinggal:

```bash
grep -n "trycloudflare\|BETTER_AUTH_URL\|NEXT_PUBLIC_APP_URL" apps/web/.env.local
```

Bila muncul, hapus baris-baris itu (biarkan sisa berkas apa adanya), lalu
**restart** `bun run dev` — server yang sedang berjalan masih memegang nilai lama
karena `NEXT_PUBLIC_*` disisipkan saat kompilasi. Konfirmasi cepat bahwa origin
lokal sehat:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
# → 200

curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"email":"nobody@example.com","password":"wrong-password"}'
# → 401 {"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}
#    (401 = origin dipercaya; 403 INVALID_ORIGIN = konfigurasi origin masih salah)
```

## Bukti jalur pemasangan bersih

Diambil terhadap origin tunnel, bukan `localhost`.

Manifest kembali **200 JSON**, bukan HTML dan bukan halaman perantara:

```
HTTP/2 200
content-type: application/manifest+json

{"id":"/","name":"Atria ERP","short_name":"Atria","start_url":"/","scope":"/",
 "display":"standalone","theme_color":"#f5f5f7",
 "icons":[{"src":"/icons/icon-192.png",...},{"src":"/icons/icon-512.png",...},
          {"src":"/icons/icon-maskable-512.png",...}]}
```

Semua aset dan `/login` mengembalikan **200**, tidak ada yang dialihkan ke
`/login`:

```
/manifest.webmanifest      : 200
/notification-sw.js        : 200
/icons/icon-192.png        : 200
/icons/icon-512.png        : 200
/icons/icon-maskable-512.png : 200
/icons/apple-touch-icon.png  : 200
/offline                   : 200
/login                     : 200
```

Header service worker bertahan:

```
content-type: application/javascript; charset=UTF-8
cache-control: public, max-age=0, must-revalidate
service-worker-allowed: /
```

Root HTML memuat `<link rel="manifest" href="/manifest.webmanifest">`,
`<meta name="theme-color" content="#f5f5f7">`, dan
`<meta name="apple-mobile-web-app-capable" content="yes">`.

Service worker benar-benar terdaftar di origin tunnel
(`isSecureContext: true`, scope `/`, `controller` = `notification-sw.js`), dan
halaman login dirender sebagai formulir sungguhan (email + kata sandi) — bukan
halaman perantara tunnel.

### Cek menentukan lewat CDP

Dijalankan dengan Chrome DevTools Protocol, User-Agent Android (Pixel 7) dan
`Emulation.setDeviceMetricsOverride` mobile:

```
manifest.errors        : []
installabilityErrors   : []
manifest.display       : kStandalone
manifest.startUrl      : https://<host-tunnel>/
manifest.scope         : https://<host-tunnel>/
manifest.id            : https://<host-tunnel>/
icons[].url            : absolut (https://<host-tunnel>/icons/…)
```

`installabilityErrors: []` inilah kriteria lulus. Bila nilainya tidak kosong,
bacalah `errorId`-nya: `not-in-secure-context` berarti tunnel/HTTP salah,
`no-manifest` berarti manifest tidak tersaji, `no-acceptable-icon` berarti ikon
tidak terbaca.

### Login tidak ditolak karena origin

```
POST /api/auth/sign-in/email   Origin: https://<host-tunnel>
→ 401 {"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}

POST /api/auth/sign-in/email   Origin: https://jahat.example.com
→ 403 {"message":"Invalid origin","code":"INVALID_ORIGIN"}
```

Origin tunnel **tidak** menghasilkan `INVALID_ORIGIN`; yang tersisa hanyalah
kredensial yang memang sengaja dikosongkan. Artinya jalur trusted-origin sudah
benar. Login sungguhan dengan kredensial asli belum diuji di sini dan hanya bisa
dibuktikan di ponsel.

## Shortcut vs WebAPK

| | Shortcut ("Add to Home screen") | WebAPK ("Install app") |
| --- | --- | --- |
| Launcher | ikon kecil dengan **lencana Chrome** | ikon penuh, **tanpa** lencana |
| Toolbar | membuka di dalam tab Chrome | tanpa address bar |
| Daftar aplikasi | tidak muncul | muncul di Settings → Apps |
| Deep link | tidak ditangani | menangkap URL dalam `scope` |
| Jejak paket | tidak ada | terdaftar di `chrome://webapks` |

Cara membedakan yang paling cepat ada di **menu Chrome**: buka menu, dan baca
labelnya. `Install app` / `Pasang aplikasi` berarti Chrome siap mencetak WebAPK.
`Add to Home screen` / `Tambahkan ke layar utama` berarti Chrome hanya menawarkan
shortcut — biasanya karena `installabilityErrors` tidak kosong atau origin tidak
aman.

Untuk memeriksa apa yang benar-benar terpasang, buka `chrome://webapks` di
Chrome Android. WebAPK akan terdaftar di sana; shortcut tidak akan muncul sama
sekali.

## Prosedur pemasangan ulang di ponsel

Chrome **dapat memakai ulang shortcut lama** walaupun manifest sudah benar, jadi
memasang ulang di atasnya tidak membuktikan apa pun. Hapus dulu:

1. Tekan lama ikon Atria di Home Screen → **Uninstall** / **Hapus**.
   Bila yang terpasang shortcut, hapus juga lewat daftar itu.
2. Tutup **semua** tab Atria di Chrome (recents → hapus semua kartu Chrome).
3. Opsional namun disarankan: buka `chrome://webapks` dan pastikan tidak ada
   entri Atria yang tersisa. Bila ada, hapus dari sana.
4. Buka `https://<host-tunnel>/login` di Chrome Android, tunggu halaman selesai
   dimuat. Bila muncul halaman perantara ngrok, tekan **Visit** sekali.
5. Menu Chrome → pastikan labelnya **Install app** / **Pasang aplikasi**, lalu
   pilih itu. Jangan pilih "Add to Home screen".
6. Periksa ikon di Home Screen: harus **tanpa lencana Chrome**, dan membukanya
   harus **tanpa address bar**.
7. Konfirmasi di `chrome://webapks` bahwa entri Atria muncul.

## Kendala Google Play Services

WebAPK dicetak oleh **server minting Google**, jadi perangkat **tanpa Google Play
Services (GMS)** tidak akan pernah bisa menghasilkan WebAPK. Di perangkat seperti
itu, pemasangan selalu berakhir sebagai shortcut dengan lencana Chrome — tanpa
peduli sebagus apa manifest Anda.

Karena itu, bila ikon **masih** berlencana setelah prosedur di atas dijalankan
dengan `installabilityErrors: []`: periksa apakah perangkat punya GMS sebelum
menganggapnya bug aplikasi. Perangkat Huawei/HarmonyOS tanpa GMS, ROM AOSP, dan
emulator tanpa image Google APIs adalah penyebab yang jauh lebih mungkin
daripada masalah manifest.

## Perbandingan dengan iOS

iPhone tidak mengenal WebAPK. Safari iOS selalu memakai **"Add to Home Screen"**
dan menyimpan aplikasi sebagai Web Clip — tanpa paket Android, tanpa
`chrome://webapks`, dan tanpa minting dari server mana pun.

Bedanya yang penting untuk fitur: sebelum dipasang ke Layar Utama, Safari iOS
tidak mengekspos `PushManager`, sehingga tombol **Aktifkan** di `/notifications`
tidak akan berfungsi. Jalur pemasangan iOS (Bagikan → Tambahkan ke Layar Utama)
tetap harus ada dan tidak boleh dihapus tanpa menggantinya.

## Perbaikan produksi yang sebenarnya

Tunnel ini adalah alat **diagnosis dan pengujian**, bukan perbaikan produksi.
Symptom awal — Chrome melaporkan `{"errorId":"no-manifest"}`, pemasangan turun ke
shortcut — terjadi karena `https://atria-erp.vercel.app` tidak menyajikan manifest
sama sekali: `/manifest.webmanifest`, `/icons/*.png`, `/notification-sw.js`, dan
`/offline` semuanya mengembalikan **307 → `/login`**. Penyebabnya dua, dan
keduanya harus dibereskan:

1. **Berkas PWA belum ter-deploy.** `app/manifest.ts`, `app/offline/`,
   `public/icons/`, `lib/pwa/**`, `features/pwa/**`, dan pengecualian `proxy.ts`
   masih belum di-commit pada saat tulisan ini dibuat, sehingga tidak pernah ikut
   terkirim ke produksi. Penolakan `proxy.ts` untuk `manifest.webmanifest`,
   `notification-sw.js`, `icons/`, dan `offline` memang wajib: permintaan berkas
   itu tidak selalu membawa cookie sesi, dan pengalihan ke `/login` membuat
   pemeriksaan pembaruan worker gagal serta halaman offline tersimpan sebagai
   halaman login.
2. **Production branch Vercel salah.** Produksi dibangun dari `main`, sedangkan
   seluruh pekerjaan ada di `development`, jadi push ke `development` hanya
   menghasilkan preview deployment. Perbaikan dan konsekuensinya dijelaskan di
   `docs/guide/vercel-deployment.md`; jangan diulang di sini.

Setelah keduanya dibereskan, pengujian yang sama dapat dijalankan langsung
terhadap `https://atria-erp.vercel.app` tanpa tunnel. Untuk prasyarat PWA di sisi
produksi (VAPID, penjadwalan worker, header CDN), rujuk
`docs/guide/vercel-deployment.md` — khususnya bagian *Prasyarat PWA dan push* —
agar isinya tidak terduplikasi di dua tempat dan tidak saling bertentangan.

## Daftar periksa pra-terbang

Sebelum menyalahkan ponsel, pastikan semuanya lulus di komputer:

- [ ] `bun run build` selesai tanpa error, dan dijalankan **dengan** `BETTER_AUTH_URL` + `NEXT_PUBLIC_APP_URL` inline berisi origin tunnel.
- [ ] `PORT=3300 bun run start` (dengan origin tunnel inline) melaporkan siap dan port 3300 mendengarkan.
- [ ] Berkas tunnel sudah menyala dan menampilkan satu URL HTTPS.
- [ ] `curl -sD - https://<host-tunnel>/manifest.webmanifest` → **200**, `content-type: application/manifest+json`, isinya JSON.
- [ ] `curl -s -o /dev/null -w "%{http_code}"` untuk `/notification-sw.js`, `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`, `/offline`, `/login` → semuanya **200**.
- [ ] `curl -sI https://<host-tunnel>/notification-sw.js` menampilkan `service-worker-allowed: /` dan `cache-control: public, max-age=0, must-revalidate`.
- [ ] Halaman root memuat `<link rel="manifest"`, `<meta name="theme-color"`, dan `apple-mobile-web-app-capable`.
- [ ] `installabilityErrors` bernilai `[]`.
- [ ] Tidak ada origin tunnel yang tertinggal di berkas `.env*` mana pun (`grep -rn "trycloudflare" apps/web/.env.local` → kosong).
- [ ] `bun run dev` di `localhost:3000` tetap bisa login (POST auth dari Origin `http://localhost:3000` → **401**, bukan **403**).
- [ ] Di ponsel: ikon lama sudah dihapus, semua tab Atria ditutup, menu Chrome menawarkan **Install app**, dan ikon baru tanpa lencana Chrome.

## Menghentikan semuanya

```bash
# hentikan tunnel dan server produksi (keduanya proses latar)
pkill -f "cloudflared tunnel --url http://localhost:3300"
pkill -f "next-server"
```

Hentikan juga sesi `bun run dev` bila Anda tidak memakainya; setelah itu
`bun run dev` akan start bersih dengan origin `localhost:3000` dari `.env`.

Tidak ada satu pun perintah di panduan ini yang menyentuh basis data atau
mengubah data pengguna.
