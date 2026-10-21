# Profil Swalayan

**Tanggal:** 2026-08-24
**Status:** Disetujui (21 keputusan, tiga putaran)
**Mencabut batasan:** [2026-07-15-profile-main-surface-rework.md](2026-07-15-profile-main-surface-rework.md)

## Masalah

`/profile` selesai sebagai **tampilan**, belum sebagai **akun**. Semua yang ada di
sana hari ini hanya membaca sesi; tidak ada satu pun jalur tulis.

| Gejala                                          | Bukti                                                                                                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foto profil tidak pernah muncul untuk siapa pun | `user.image` ada di `db/schema/auth.ts:46`, tetapi **nol** jalur tulis di seluruh repo — bukan di action, bukan di seed, bukan di form administrasi. Kolomnya hanya pernah dibaca. |
| Avatar bilah atas bukan milik siapa pun         | `components/layout/mobile-shell.tsx:24` memasang satu URL foto stok dari CDN mockup Google, identik untuk setiap pengguna. Komponennya tidak membaca sesi sama sekali.             |
| Nama hanya bisa diubah orang lain               | `app/actions/administration-staff.ts:93` (`updateStaffUser`) menuntut izin `manage:users`. Pengguna tidak punya jalur untuk memperbaiki namanya sendiri.                           |
| Ganti kata sandi hanya ada sebagai jalur paksa  | `app/profile/password/page.tsx` mengalihkan ke `/` ketika `mustChangePassword` bernilai `false`. Setelah kata sandi sementara diganti sekali, pintunya tertutup selamanya.         |

Ini bukan regresi. Plan [2026-07-15](2026-07-15-profile-main-surface-rework.md)
**sengaja** menuliskan "tidak ada edit nama/avatar, perubahan password, atau
pengelolaan sesi/perangkat" sebagai batasan. Dokumen ini mencabut batasan itu
untuk avatar, nama, dan kata sandi; sesi/perangkat tetap ditunda.

### Utang yang ikut terungkap

Pola unggah ImageKit sudah ditulis **dua kali dengan isi identik** —
`features/expenses/utils/expense-receipt-ocr.ts:38` (`/field-receipts`) dan
`features/projects/list/components/drawers/project-drawer.tsx:160`
(`/project-covers`). Keduanya menanam public key yang sama sebagai fallback
hardcoded, dan `.env.example` **tidak menyebut ImageKit sama sekali** — baik
`IMAGEKIT_PRIVATE_KEY` maupun `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`. Avatar adalah
call site ketiga; menyalinnya untuk ketiga kalinya bukan pilihan.

### Cacat yang ditemukan saat menelusuri preseden

`changeTemporaryPasswordUseCase` menghapus **semua** sesi, bukan sesi lain:

```ts
await tx.delete(session).where(and(eq(session.userId, actor.userId), ne(session.id, "")));
```

`ne(session.id, "")` tidak pernah tidak cocok — tidak ada baris ber-`id` string
kosong — jadi predikat itu tidak menyaring apa pun. Perilakunya benar untuk
jalur kata sandi sementara (formulirnya memang memanggil `signOut()` setelahnya,
`features/administration/components/forms/temporary-password-form.tsx:33`),
tetapi bentuknya menyesatkan dan **tidak boleh disalin**. Keputusan 20 menutup
ini untuk jalur baru; badan transaksi lama tidak disentuh karena dikunci uji
snapshot di `server/usecases/administration/temporary-password-gate.test.ts`.

## Keputusan

| #   | Keputusan                                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lingkup: foto profil, avatar bilah atas, edit nama sendiri, ganti kata sandi mandiri. Ganti email **ditolak** (identitas login = urusan admin di ERP internal). Manajemen sesi/perangkat dan layar profil native **ditunda**.                                                                                                           |
| 2   | Unggah mengikuti pola ImageKit yang ada (tanda tangan di server → POST dari peramban), folder `/user-avatars`. Bukan lewat Server Action: batas body 1 MB akan ditembus foto kamera terus-menerus.                                                                                                                                      |
| 3   | `accept="image/*"` **tanpa** `capture` — picker iOS/Android sudah menawarkan "Ambil Foto" sendiri, sedangkan `capture` mengunci ke kamera dan membuang galeri. Sebelum unggah: resize + center-crop lewat canvas ke **512×512 JPEG**. Input ditolak di atas 8 MB, sama dengan cover proyek.                                             |
| 4   | Avatar hanya bisa diubah pemiliknya. Nama tetap punya dua jalur tulis (sendiri + admin); keduanya lewat use-case dan keduanya menulis `audit_log`.                                                                                                                                                                                      |
| 5   | Server Action tipis → use-case → Drizzle dalam transaksi + `audit_log`, kontrak `ActionResponse<T>`. Better Auth dipakai **hanya** untuk hashing (`auth.$context.password`), bukan API level-atasnya.                                                                                                                                   |
| 6   | File lama di ImageKit **tidak** dihapus. Belum ada infrastruktur hapus di repo ini; nota dan cover proyek pun meninggalkan yatim. Itu masalah lintas-fitur, bukan bagian pekerjaan ini.                                                                                                                                                 |
| 7   | Primitif baru `UserAvatar` di `components/ui`, dipakai identity surface **dan** bilah atas. Dua penampil avatar hari ini punya aturan fallback yang berbeda; itu yang membuat bilah atas bisa memasang foto stok tanpa ada yang merasa aneh.                                                                                            |
| 8   | Satu `OperationalFormSheet` "Ubah profil" berisi foto + nama, dengan avatar di identity surface **juga** bisa ditekan sebagai jalan pintas ke sheet yang sama. Kata sandi mendapat baris dan sheet sendiri — kelas risiko berbeda.                                                                                                      |
| 9   | Ganti kata sandi mencerminkan `changeTemporaryPasswordUseCase`: verifikasi hash, seluruh efek dalam satu `db.transaction`. `auth.api.changePassword` ditolak karena menaruh audit di luar transaksi — kata sandi bisa berganti sementara jejaknya hilang.                                                                               |
| 10  | Ganti kata sandi mencabut sesi lain dan **mempertahankan sesi saat ini**. Disebutkan di sheet sebelum submit, bukan sebagai kejutan sesudahnya.                                                                                                                                                                                         |
| 11  | Nama: semua peran boleh mengubah miliknya sendiri, 2–80 karakter, di-trim, audit `UPDATE_OWN_PROFILE`. Kolomnya `varchar(255)`, tetapi 80 sudah berlebih dan menjaga identity surface utuh di 320 px. Jejak approval menyimpan `userId`, bukan string nama, jadi tidak ada yang rusak.                                                  |
| 12  | "Hapus foto" tersedia: `user.image` → `null`, tanpa dialog konfirmasi terpisah. Bukan aksi merusak — bisa diunggah ulang kapan saja.                                                                                                                                                                                                    |
| 13  | Bilah atas mengambil avatar dari `authClient.useSession()`, pola yang sudah dipakai `bottom-nav.tsx:23` dan `use-header-menu.ts:55`. Saat `isPending` render **inisial**, bukan skeleton: bilah atas tidak boleh berkedip di setiap navigasi.                                                                                           |
| 14  | Public key ImageKit pindah ke **satu** konstanta di dalam helper bersama; env menang bila diisi. `.env.example` mendokumentasikan `IMAGEKIT_PRIVATE_KEY` dan `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`. Dua call site lama kehilangan fallback lokalnya tanpa berubah perilaku — mereka tidak boleh berhenti bekerja gara-gara pembersihan ini. |
| 15  | Prosedur tRPC dipasang sekarang meski layar native belum ada: harganya satu baris per use-case, dan itu yang membuktikan use-case-nya benar-benar bebas `next/headers`. `UserAvatar` **belum** disebar ke daftar staf administrasi — loader di sana tidak menarik kolom `image`.                                                        |
| 16  | Dokumen rencana ini ditulis lebih dulu, sekaligus menandai batasan plan 2026-07-15 sudah dicabut supaya dokumen itu tidak menjadi jebakan bagi sesi berikutnya.                                                                                                                                                                         |
| 17  | Foto dan nama tersimpan **bersama** saat Simpan. Unggah menghasilkan URL yang ditahan di state sheet. Satu Simpan = satu perubahan; Batal = tidak ada yang berubah.                                                                                                                                                                     |
| 18  | Pratinjau lokal (`URL.createObjectURL`) tampil sejak berkas dipilih, dengan indikator pada badge kamera. Unggah gagal → pratinjau dibuang kembali ke foto lama, **galat inline di dalam sheet** dengan "Coba lagi" (bukan toast — toast menghilang sementara sheet masih terbuka). Nama tetap bisa disimpan meski foto gagal.           |
| 19  | Simpan tanpa perubahan tidak menulis apa pun dan tidak melahirkan baris audit. `audit_log` di sini adalah alat investigasi finansial; kebisingan di dalamnya ada biayanya.                                                                                                                                                              |
| 20  | `Actor` mendapat `sessionId`. Perubahan aditif dan terpusat di `toActor`, sehingga kedua transport ikut mendapatkannya. Ini juga prasyarat yang tidak terhindarkan untuk manajemen sesi/perangkat yang ditunda di keputusan 1.                                                                                                          |
| 21  | Avatar dirender lewat parameter transform ImageKit (`?tr=w-…,h-…,f-auto`) dengan `unoptimized` dipertahankan. `next.config.ts` tidak mendapat blok `images`: melewatkan avatar ke optimizer Next hanya untuk mengecilkan berkas yang **sudah** kita kecilkan ke 512 px di klien adalah pekerjaan ganda di jalur serverless.             |

## Bentuk akhir

```
components/ui/
  identity/user-avatar.tsx            ← BARU: foto + fallback inisial + onError, satu aturan
  identity/user-avatar.test.tsx       ← BARU
  index.ts                            ← ekspor UserAvatar

lib/media/
  upload-to-imagekit.ts               ← BARU: sign → POST → URL, folder sebagai argumen
  resize-image.ts                     ← BARU: canvas → 512×512 JPEG (center-crop, EXIF dihormati)

app/actions/profile/
  update-own-profile.ts               ← BARU
  change-own-password.ts              ← BARU

server/usecases/profile/
  update-own-profile.ts               ← BARU
  change-own-password.ts              ← BARU
  change-own-password.test.ts         ← BARU: integritas transaksi kedua use-case
server/trpc/routers/profile.ts        ← BARU: dua prosedur activeProcedure
server/trpc/root.ts                   ← namespace `profile`
server/actor.ts                       ← + sessionId

features/profile/
  components/views/profile-identity-surface.tsx  ← UserAvatar + badge kamera sebagai pemicu
  components/views/profile-actions-provider.tsx  ← BARU: pemilik tunggal state kedua sheet
  components/views/profile-account-rows.tsx      ← BARU: baris "Ubah profil" & "Ganti password"
  components/views/edit-profile-sheet.tsx        ← BARU
  components/views/change-password-sheet.tsx     ← BARU
  components/views/profile-sheets.test.ts        ← BARU: keputusan yang tidak bisa dirender
  utils/profile-form.ts                          ← BARU: keadaan formulir dari skema bersama
  utils/profile-form.test.ts                     ← BARU
  utils/profile-access.ts                        ← getProfileInitials pindah ke @atria/core
  server/get-profile-page-data.ts                ← impor inisial dari @atria/core

packages/core/src/
  validations/profile.ts              ← BARU: skema nama, foto, dan kata sandi
  validations/profile.test.ts         ← BARU
  validations/administration.ts       ← kebijakan kata sandi diekspor untuk dipakai bersama
  presentation/user-identity.ts       ← BARU: inisial, dipakai dua lapis yang tak saling impor

app/profile/page.tsx                  ← dibungkus provider; dua baris aksi baru
components/layout/mobile-shell.tsx    ← avatar dari sesi; konstanta foto stok dihapus
components/layout/use-header-menu.ts  ← + userName, userImageUrl
features/expenses/utils/expense-receipt-ocr.ts               ← memakai helper bersama
features/projects/list/components/drawers/project-drawer.tsx ← memakai helper bersama
.env.example                          ← dua variabel ImageKit didokumentasikan
```

## Kontrak server

Dua Server Action, keduanya pembungkus tipis di atas use-case bernama sama:

```ts
updateOwnProfile({ name, imageUrl }): ActionResponse<{ updated: boolean }>
changeOwnPassword({ currentPassword, newPassword }): ActionResponse<{ changed: true }>
```

- `imageUrl` bernilai `null` berarti hapus foto (keputusan 12); `undefined`
  berarti tidak disentuh.
- `updated: false` adalah jalur "tidak ada yang berubah" dari keputusan 19 —
  sukses, tanpa tulisan, tanpa audit.
- Aksi audit: `UPDATE_OWN_PROFILE` dan `CHANGE_OWN_PASSWORD`. `newState` hanya
  memuat field yang benar-benar berubah.
- Kata sandi salah → `FORBIDDEN` dengan pesan Bahasa Indonesia, mengikuti
  preseden `changeTemporaryPasswordUseCase`. Kredensial tidak ditemukan →
  `NOT_FOUND`.
- Identitas selalu dari `resolveActor()`; tidak ada `userId` yang diterima dari
  klien.

## Yang sengaja tidak dikerjakan

- Ganti email (ditolak, bukan ditunda).
- Daftar sesi/perangkat aktif dan pencabutan per perangkat — `sessionId` di
  `Actor` menyiapkan jalannya, UI-nya tidak dibangun.
- Layar profil native di `apps/mobile` — prosedur tRPC-nya sudah ada, layarnya
  menyusul di fase Expo.
- Penghapusan berkas lama di ImageKit.
- `UserAvatar` di daftar staf administrasi, kartu approval, atau baris
  pengeluaran.
- Blok `images` di `next.config.ts`.

## Verifikasi

- `bun run test` hijau, termasuk `lib/architecture/` (boundary use-case,
  `"use server"` hanya mengekspor fungsi async, allowlist rute API tidak
  berubah — pekerjaan ini tidak menambah route handler).
- Uji baru: skema Zod di `@atria/core`, keadaan formulir klien
  (`profile-form.test.ts`), rendering `UserAvatar`, dan integritas transaksi
  kedua use-case bergaya snapshot seperti `temporary-password-gate.test.ts`.
- Isi sheet **tidak** diuji lewat `renderToStaticMarkup`: sheet dirender ke
  portal, jadi markup statisnya kosong. Aturannya diangkat ke `profile-form.ts`
  dan diuji sungguhan di sana; sisanya dikunci sebagai asersi sumber, mengikuti
  `components/ui/overlay/dialogs.test.tsx`.
- `lib/media/resize-image.ts` **tidak** di-unit-test: `canvas` tidak tersedia di
  Bun test, dan mem-mock-nya hanya menguji mock. Diverifikasi di peramban
  sungguhan lewat panel pratinjau.
- Lebar 320 / 360 / 390 / 430 px untuk identity surface, sheet, dan bilah atas.
- Fokus keyboard, target sentuh 48×48, reduced motion, safe area.
- `bun run lint`, `bun run tailwind:format`, dan production build.
