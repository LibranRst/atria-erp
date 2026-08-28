# Tier 1 — Kecerdasan Peran Read-Only untuk Asisten AI

> Lanjutan [2026-08-25-role-permission-unification.md](2026-08-25-role-permission-unification.md).
> **Status: Tier 1 ✅ · Tier 2 ✅ · Tier 3 ✅ (2026-08-25).**

## Keputusan

> **Ditinjau ulang (2026-08-25).** Tier 3 akhirnya dibangun atas permintaan
> pemilik produk, dengan keempat pagar di bawah. Keberatan aslinya tetap
> dicatat apa adanya, karena pagar-pagar itu hanya masuk akal kalau alasannya
> ikut terbaca — dan keberatan (1) dijawab langsung oleh kartu yang menampilkan
> **akibat** tiap izin dalam kalimat, bukan daftar kunci.

Asisten AI **tidak** diberi jalan untuk mengubah izin. Yang diberikan adalah
kemampuan menjelaskan dan mensimulasikan — pekerjaan yang layar tidak bisa
lakukan, dan yang tidak menyentuh satu pun baris database.

Alasan menolak jalur tulis (Tier 3) tercatat supaya tidak perlu diperdebatkan
ulang:

1. **Card izin tidak bisa dinilai dalam satu ketukan.** Card expense membawa
   bahan penilaiannya sendiri (nominal, sisa budget). Card izin berbunyi
   `pay:cost` — untuk menilainya orang harus tahu jalur kode mana yang
   memeriksanya dan siapa pemegang peran itu. Konfirmasinya turun menjadi
   stempel, dan stempel di atas pemberian wewenang lebih buruk daripada tidak
   ada alur sama sekali karena ia memproduksi penampakan peninjauan.
2. **Tidak ada jurnal balik untuk wewenang.** Expense salah punya jalan pulang
   yang dirancang. Izin yang diberikan lalu dicabut tidak membatalkan pencairan
   yang sempat terjadi di antaranya — sebagian sudah direkonsiliasi, dan baris
   rekonsiliasi bersifat append-only.
3. **Anti-eskalasi selamat, maknanya tidak.** `findEscalation` memeriksa id
   aktor, dan aktornya tetap manusia. Tetapi aturan itu mengasumsikan pemberi
   adalah yang *memikirkan* pemberiannya; ketika model yang menyusun, kesadaran
   itu menguap dan pemeriksaannya tidak bisa mendeteksinya.
4. **Bias sistematis ke arah memberi.** Pemicu tersering adalah "si A tidak
   bisa X", dan jalan paling membantu bagi model adalah mengusulkan pemberian.
   Padahal jawaban benarnya sering justru bukan memberi. Tiap pemberian tampak
   wajar satu per satu — itu mekanisme permission creep.
5. **Terdampaknya orang yang tidak ada di percakapan.** Perubahan izin memicu
   `revalidatePath("/", "layout")` karena ia mengubah sesi orang lain.

Tier 1 adalah **prasyarat** Tier 3, bukan penggantinya: kalau
`analyzeRoleChangeImpact` terbukti bisa menghasilkan kalimat konsekuensi yang
benar-benar terbaca, keberatan (1) runtuh dan Tier 3 layak ditinjau ulang.

## Prasyarat yang harus dibereskan lebih dulu

`lib/ai/tools/context.ts` masih membaca `ROLE_PERMISSIONS[roleName]` dan tabel
cakupan seed — bukan database. Untuk tool biasa itu sudah salah; untuk tool yang
**pekerjaannya menjelaskan izin**, itu fatal: ia akan melaporkan izin yang
berbeda dari yang ditegakkan server, persis pada pertanyaan yang orang ajukan
karena sedang bingung. Konteks tool dipindahkan ke `getRoleAccess(roleId)`.

## Tool

Ketiganya read-only dan tunduk pada `read-only.test.ts`.

| Tool | Gerbang | Menjawab |
| --- | --- | --- |
| `explainUserAccess` | diri sendiri bebas; orang lain butuh `manage:users` atau `manage:roles` | "saya boleh apa saja", "kenapa Budi tidak bisa mencairkan?" |
| `whoCanDo` | `manage:roles` | "siapa yang bisa menyetujui budget?" |
| `analyzeRoleChangeImpact` | `manage:roles` | "kalau `pay:cost` dicabut dari Finance Admin, apa yang berhenti?" |

`analyzeRoleChangeImpact` tidak menulis apa pun. Ia melaporkan: jumlah dan nama
pemegang peran, izin yang benar-benar berubah (bukan no-op), modul yang
menyeberangi nol, izin yang akan ditolak server karena aktornya sendiri tidak
memegangnya, dan — yang paling penting — **izin kritis yang kehilangan pemegang
terakhirnya di seluruh perusahaan**.

## Tier 2 — kartu serah-terima

`suggestRoleReview` menghasilkan kartu yang **menautkan** ke penyunting peran,
bukan kartu yang menerapkan. Tidak ada tombol konfirmasi dan tidak ada Server
Action di ujungnya; sakelar yang disarankan hanya **tersorot**, dan manusia yang
menekannya di layar yang dirancang untuk itu.

Kontrak tautannya hidup di `packages/core/src/auth/role-deep-link.ts` supaya
kedua sisi tidak bisa menyimpang: asisten menyusun URL-nya, layar membacanya
kembali. Kalau nama parameternya ditulis dua kali, kartu akan membuka peran yang
benar tanpa satu pun sakelar tersorot — gagal diam-diam.

Saran yang **sudah dikerjakan** berhenti disorot: sorotan yang bertahan setelah
sakelarnya ditekan akan terbaca sebagai pekerjaan yang belum selesai.

## Yang sengaja tidak dikerjakan

- Tool tulis apa pun untuk peran (keputusan di atas).
- Menerapkan saran secara otomatis saat tautan dibuka. Itu akan mengubah tautan
  menjadi jalan pintas menulis izin — persis Tier 3 lewat pintu belakang.

## Catatan eksekusi

**Prasyarat ternyata lebih dalam dari dugaan.** Bukan hanya `hasPermission` yang
membaca matriks seed — `hasGlobalScope` juga, lewat `hasGlobalDataScope(roleName)`.
Keduanya sekarang membaca `AiToolContext.permissions` dan `.dataScope` yang
diselesaikan `getRoleAccess(roleId)` di route handler. Tes arsitektur
`role-authority.test.ts` ikut diperkuat: ia dulu menuntut `context.ts` memakai
`hasGlobalDataScope`, sekarang menuntut yang lebih kuat — konteks tidak boleh
menurunkan izin maupun cakupan dari nama peran sama sekali.

**Matematika dampak dipisah ke `packages/core/src/auth/role-impact.ts`.**
Murni, teruji, dan siap dipakai ulang oleh layar peran: pertanyaan "apa yang
rusak kalau ini dicabut" sama pentingnya di dalam penyunting seperti di dalam
percakapan.

**Diverifikasi terhadap database UAT** (read-only, tanpa satu pun tulisan):

- Project Manager ditolak `whoCanDo` dan `analyzeRoleChangeImpact`.
- `whoCanDo("pay:cost")` → OWNER (Ronald Wijaya), FINANCE_ADMIN (Lisa Permata).
- Kunci salah ketik "bayar tagihan vendor" → saran `pay:vendor_bill`.
- Mencabut `pay:cost` dari FINANCE_ADMIN → **tanpa** peringatan kritis, karena
  Owner masih memegangnya dan pemegangnya aktif. Tool benar, bukan diam.
- Mencabut `approve:cost` dari OWNER → `criticalGaps` berisi "tidak ada yang
  bisa menyetujui pengeluaran lapangan". Inilah kalimat yang harus dibawa card
  Tier 3 seandainya ia dibangun nanti.

**Belum terjangkau dataset sekarang:** `blockedGrants` (laporan anti-eskalasi)
tidak bisa menyala selama satu-satunya pemegang `manage:roles` adalah Owner yang
memegang segalanya. Ia baru berarti setelah ada peran buatan yang diberi
`manage:roles`.

## Catatan eksekusi Tier 2

**Dua efek diganti turunan saat render.** Membuka peran dari tautan dan membuka
grup yang memuat saran keduanya sempat ditulis sebagai `useEffect` + `setState`,
dan `react-hooks/set-state-in-effect` menolaknya — dengan benar. Yang pertama
punya bug nyata: efek yang membuka sheet berdasarkan parameter URL akan
membukanya kembali setiap kali pengguna menutupnya, karena parameternya masih di
sana. Keduanya sekarang diturunkan saat render.

**Verifikasi di browser** dengan tautan sungguhan dari database UAT
(`?admin=roles&role=…&grant=verify:cost,approve:cost&revoke=view:budget`):
Settings terbuka di tab Organisasi → workspace Peran → sheet Project Manager,
spanduk "3 saran dari asisten", **dua** grup yang memuat saran terbuka sekaligus,
dan ketiga sakelarnya tetap pada nilai aslinya dengan footer berbunyi "Belum ada
perubahan".

Membuka hanya grup pertama sempat menyembunyikan dua dari tiga saran di balik
delapan panel tertutup — ditemukan saat verifikasi, bukan dari kode.

## Tier 3 — kartu yang benar-benar menulis

`proposeRoleChange` menghasilkan kartu yang bisa dikonfirmasi langsung di chat.
Empat pagar yang menjadi syaratnya, semuanya ditegakkan **di server**, bukan
hanya di tool:

1. **Kartunya bisa dinilai.** Tiap baris menyatakan akibat dalam kalimat ("Bisa
   memverifikasi pengeluaran lapangan"), bukan `verify:cost`. Nama orang yang
   terdampak ikut disebut — merekalah yang menanggung akibatnya, dan mereka tidak
   ada di percakapan itu.
2. **Sebagian izin ditolak total dari jalur ini** (`ai-role-proposal.ts`):
   pencairan uang (`pay:cost`, `pay:vendor_bill`), pengelolaan user dan peran
   (`manage:users`, `manage:roles` — jalur yang bisa memperluas dirinya sendiri),
   dan `override:self_approval` yang melewati pemisahan tugas. Layarnya tetap
   terbuka untuk semuanya; yang ditutup hanya jalan pintasnya.
3. **Audit terpisah.** `AI_PROPOSED_ROLE_CHANGE`, lewat `RoleChangeOrigin` pada
   use-case yang sama dengan layar — satu baris audit per keputusan, dengan
   asalnya tercatat.
4. **Anti-eskalasi terhadap manusianya.** Server Action menyelesaikan aktor dari
   sesi dan menumpang `updateRolePermissionsUseCase`, jadi aturan yang berlaku
   sama persis dengan yang berlaku di layar.

Pagar tambahan yang tidak ada di layar: **pencabutan yang menyisakan nol pemegang
izin kritis ditolak**, bukan sekadar diperingatkan. Layar menempatkan Owner di
depan daftar lengkap; kartu menempatkannya di depan satu tombol.

Isi kartu tidak dipercaya sedikit pun. Server hanya memakai id peran dan daftar
kunci, lalu menghitung ulang selisihnya terhadap keadaan database saat itu —
peran bisa berubah antara kartu dibuat dan tombolnya ditekan.

## Catatan eksekusi Tier 3

**Diverifikasi terhadap database UAT.** Lewat tool: `pay:cost` ditolak,
`manage:roles` ditolak, mencabut `approve:cost` dari Owner ditolak dengan
kalimat akibatnya, dan pemberian `verify:cost` ke Project Manager menghasilkan
kartu lengkap dengan dua nama pemegangnya.

**Dan lewat payload yang dikarang langsung ke Server Action** — melewati tool
sepenuhnya, seperti klien yang dimodifikasi: `pay:cost` FORBIDDEN,
`manage:users` FORBIDDEN, peran Owner FORBIDDEN, kunci karangan
VALIDATION_ERROR. Tidak satu pun menulis. Ini yang penting: pagar di tool hanya
menjaga model, pagar di Server Action yang menjaga sistem.

**Belum terjangkau data seed:** jalur "pemegang terakhir" pada Server Action
tidak bisa dipicu lewat peran non-Owner, karena satu-satunya peran yang memegang
izin kritis seorang diri adalah Owner — dan Owner sudah ditolak lebih dulu. Tool
memicunya (terbukti di atas); Server Action-nya tertutup tes terintegrasi yang
menunggu `ATRIA_TEST_DATABASE_URL`.

## Pembuatan peran lewat asisten (2026-08-25)

`proposeCreateRole` melengkapi Tier 3. Alasannya adalah pembalikan dari
kekhawatiran biasa: **peran baru selalu nol pemegang.** Tidak ada kemampuan
siapa pun yang berubah saat ia dibuat, dan menugaskan orang ke dalamnya menuntut
`manage:users` yang tertutup dari jalur asisten. Radius ledakan saat pembuatan
benar-benar nol.

Yang dijaga karena itu bukan dampak seketikanya, melainkan **isi perannya ketika
ia menyala** — saat seseorang ditugaskan berbulan kemudian, oleh orang yang
jarang membuka lagi daftar izinnya. Daftar terlarang yang sama berlaku.

**Ditolak seluruhnya, bukan disaring diam-diam.** "Bikin peran seperti Finance
Admin" membawa `pay:cost`. Membuangnya tanpa bilang menghasilkan peran yang
dikira mirip Finance Admin padahal tidak, dan selisihnya baru ketahuan ketika
sudah ada yang memakainya. Penolakannya mengembalikan `href` ke sheet
"Peran baru" dengan nama dan cakupan terisi, jadi penolakan itu tetap punya
jalan keluar.

Konsekuensi yang disengaja: permintaan "peran seperti Finance Admin" akan
**selalu** ditolak jalur asisten. Yang lolos adalah peran yang memang tidak
menyentuh uang.

### Catatan eksekusi

Diverifikasi terhadap database UAT: Project Manager ditolak (bukan pemegang
`manage:roles`), "Finance Assistant" dengan `pay:cost` ditolak beserta href
jalan keluarnya, nama yang sudah ada ditolak, dan "Site Supervisor" dengan tiga
izin aman menghasilkan kartu lengkap. Tautan jalan keluarnya dibuka di browser:
sheet pembuatan terisi "Finance Assistant" dan cakupan "Seluruh proyek", dan
menutupnya tidak membuatnya terbuka lagi.

**Satu pelanggaran React ditemukan dari console, bukan dari tes.** Isian awal
sempat memanggil `onCreateOpenChange` milik komponen induk **saat render** —
menyetel state komponen lain saat render bukan sekadar tidak rapi, React
menolaknya terang-terangan. Keputusan membuka sheet dipindahkan ke
`AdministrationManager` yang memang memiliki state itu; yang tersisa di
`RoleAccessManager` hanyalah isian formulirnya sendiri.
