# AI Agent Chat — Rencana Implementasi

**Tanggal:** 2026-08-14
**Status:** Selesai. Fase 1–6 terkirim dan terverifikasi di aplikasi berjalan.
**Ruang lingkup:** Mengaktifkan tombol chat di header ([mobile-shell.tsx:81](../../components/layout/mobile-shell.tsx:81)) menjadi AI agent read-only berbasis tool-calling, dengan proposal card untuk aksi yang dikonfirmasi manusia.

---

## 1. Keputusan Produk

| Aspek          | Keputusan                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------- |
| Audiens fase 1 | Owner/Finance Admin **dan** PM lapangan sekaligus, satu chat yang menyesuaikan role                |
| Kemampuan      | Menjawab pertanyaan finansial/material, **plus** merender proposal card                            |
| Mutasi data    | AI tidak pernah menulis. Proposal card memanggil Server Action existing setelah konfirmasi manusia |
| Model utama    | `deepseek-v4-flash` (pin `DeepSeek-V4-Flash-0731`)                                                 |
| Model fallback | `gemini-3.7-flash`, dipakai saat DeepSeek gagal otentikasi/kredit/rate-limit                       |
| Bahasa output  | Bahasa Indonesia sederhana dan praktis                                                             |

### Perubahan scope yang perlu disetujui

`CLAUDE.md` saat ini menyatakan _"AI CFO/financial briefing is deferred from the Dashboard; do not reintroduce it unless product scope explicitly changes."_ Rencana ini **adalah** perubahan scope tersebut, dengan pembatasan: AI hadir sebagai **chat di header**, bukan sebagai kartu/briefing di permukaan Dashboard. Dashboard tetap bersih. `CLAUDE.md` dan `docs/06-technical/AI_AGENT_ARCHITECTURE.md` diperbarui sebagai bagian dari fase 1.

---

## 2. Keputusan Arsitektur

### 2.1 Transport: satu route handler (pengecualian terdokumentasi)

`CLAUDE.md` melarang internal REST endpoint. Rencana ini membuka **tepat satu** pengecualian: `app/api/ai/chat/route.ts`.

Alasan:

- Streaming token + tool-call steps + generative UI adalah kebutuhan inti; Server Action non-streaming akan terasa mati untuk jawaban 5–10 detik.
- `useChat` dari Vercel AI SDK memberi `status`, `stop`, `regenerate`, dan resume gratis.

Batasan yang membuat pengecualian ini aman:

- Route handler **hanya** streaming + tool **read-only**. Tidak ada satupun tool yang menulis.
- Semua mutasi tetap lewat Server Action ber-RBAC di `app/actions/**`.
- Route memverifikasi sesi lewat `requireServerSession()` di baris pertama.

**Catatan verifikasi:** `lib/architecture/server-boundaries.test.ts` hanya memeriksa `page.tsx` untuk import `@/db`/`drizzle-orm`; route handler tidak melanggar test apa pun. Yang berubah hanya prosa di `CLAUDE.md` dan `docs/06-technical/ARCHITECTURE.md`.

### 2.2 Provider dan fallback

Dependensi baru: `ai`, `@ai-sdk/openai-compatible` (DeepSeek), `@ai-sdk/google` (Gemini), `@ai-sdk/react`.

```
lib/ai/providers.ts
  deepseekModel()  -> OpenAI-compatible, baseURL https://api.deepseek.com, model deepseek-v4-flash
  geminiModel()    -> provider Google, model gemini-3.7-flash
  resolveChatModel(attempt: "primary" | "fallback")
```

**Strategi fallback.** Fallback diputuskan **sebelum token pertama**. Bungkus panggilan `streamText` pertama; jika gagal dengan 401/402/429/5xx sebelum stream dimulai, ulangi dengan Gemini. Jika stream sudah berjalan lalu putus, **jangan** menjahit dua stream — tandai pesan gagal dan biarkan pengguna menekan "coba lagi" (yang otomatis memakai Gemini). Provider yang dipakai disimpan di `ai_message.provider` untuk audit biaya.

**System prompt per provider.** DeepSeek V4 Flash tercatat sangat agresif memanggil tool (median ~28 panggilan per trial, dibanding Gemini 2.5 Flash ~8). Karena itu:

- `stopWhen: stepCountIs(8)` sebagai pagar keras.
- Instruksi eksplisit di system prompt: jawab begitu data cukup, jangan memanggil tool untuk hal yang sudah ada di konteks.
- System prompt punya varian kecil per provider; disimpan di `lib/ai/prompts.ts`.

**Model OCR yang tertinggal.** [process-receipt.ts:127](../../app/actions/ai/process-receipt.ts:127) masih memakai `gemini-3-flash-preview` — model preview, sementara lini Flash sudah GA di 3.7. Perlu diverifikasi apakah model preview itu masih dilayani; kalau tidak, OCR sudah rusak diam-diam. Pemutakhiran model OCR ditangani di fase 1 bersamaan dengan rename `geminiClient`, tapi dicatat sebagai temuan terpisah karena ini bug existing, bukan bagian dari fitur chat.

### 2.3 Konflik penamaan

`lib/ai/gemini.ts` mengekspor variabel bernama `ai`, sementara paket Vercel juga bernama `ai`. Rename export menjadi `geminiClient` dan perbarui pemakaian di [process-receipt.ts](../../app/actions/ai/process-receipt.ts) serta `lib/ai/gemini.test.ts`.

---

## 3. Skema Database (aditif)

Tabel `ai_run` **tetap** untuk run one-shot (OCR, briefing terjadwal). Chat butuh dua tabel baru di `db/schema/system.ts`.

```ts
export const aiConversation = pgTable(
  "ai_conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }), // diisi dari pesan pertama
    projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }), // opsional: chat dalam konteks proyek
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("ai_conversation_user_id_idx").on(table.userId)],
);

export const aiMessage = pgTable(
  "ai_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // user | assistant
    parts: jsonb("parts").notNull(), // UIMessage parts: text, tool calls, proposal
    provider: varchar("provider", { length: 20 }), // DEEPSEEK | GEMINI
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("ai_message_conversation_id_idx").on(table.conversationId)],
);
```

`parts` disimpan sebagai `jsonb` karena format `UIMessage` AI SDK memang berbentuk array parts (teks + tool call + hasil tool). Menyimpan mentah membuat riwayat chat bisa dirender ulang persis, termasuk proposal card-nya.

Migrasi Drizzle baru di `drizzle/`. Tidak ada perubahan pada tabel existing.

---

## 4. RBAC

### 4.1 Perubahan matriks izin

`view:ai_brief` saat ini **hanya dimiliki OWNER** ([permissions.ts:94](../../lib/auth/permissions.ts:94)). Tambahkan kunci baru:

```
"use:ai_chat"   -> OWNER, FINANCE_ADMIN, PROJECT_MANAGER
```

`view:ai_brief` dibiarkan apa adanya (tetap OWNER) untuk briefing terjadwal nanti. Role lain (PURCHASING, SALES, DESIGNER, MARKETING) belum dapat akses chat di fase 1; tombol chat disembunyikan untuk mereka.

### 4.2 Aturan scoping tool — tidak bisa ditawar

- Route handler memanggil `requireServerSession()`, lalu `assertPermission("use:ai_chat")`.
- Setiap tool menerima **konteks sesi tertutup** (closure), bukan argumen dari model. Model tidak pernah mengirim `userId` atau `role`.
- Jika model mengirim `projectId`, tool **wajib** memverifikasi akses proyek untuk sesi tersebut sebelum query. PM/Designer scoped per proyek; Owner dan Finance Admin global.
- Tool tidak pernah mengembalikan RAP cost internal, margin, markup, atau catatan vendor ke output yang bisa berakhir di dokumen client-facing.

---

## 5. Tool Registry

Lokasi: `lib/ai/tools/`, setiap file diawali `import "server-only";`.

**Temuan penting:** loader existing di `features/*/server/get-*-page-data.ts` berbentuk _page-shaped_ — tanpa argumen dan mengembalikan seluruh payload halaman. Loader itu **tidak** dipakai langsung sebagai tool (terlalu besar, tidak bisa difilter). Tool memakai query Drizzle sendiri yang sempit, lalu mendelegasikan perhitungan ke kalkulator murni yang sudah teruji di `lib/finance/`, `lib/project/`, `lib/material/`.

### Batch 1 — orientasi (wajib untuk kedua audiens)

| Tool               | Input              | Output ringkas                                 | Kalkulator yang dipakai         |
| ------------------ | ------------------ | ---------------------------------------------- | ------------------------------- |
| `listProjects`     | `status?`, `limit` | id, nama, klien, status, health                | `resolveEffectiveProjectHealth` |
| `getProjectBudget` | `projectId`        | per kategori: budget, actual, sisa, % , status | `budget-indicator.ts`           |
| `getProjectHealth` | `projectId`        | health + alasan                                | `effective-health.ts`           |

### Batch 2 — kas & persetujuan (condong ke Owner/Finance)

| Tool                  | Input        | Output ringkas                         |
| --------------------- | ------------ | -------------------------------------- |
| `getBankBalances`     | —            | daftar rekening + saldo                |
| `getPendingApprovals` | `limit`      | antrean approval + nilai + umur tunggu |
| `getUpcomingBills`    | `withinDays` | tagihan vendor jatuh tempo per bucket  |

### Batch 3 — material & lapangan (condong ke PM)

| Tool                   | Input                 | Output ringkas                          |
| ---------------------- | --------------------- | --------------------------------------- |
| `getMaterialShortage`  | `projectId`           | item kurang, qty dibutuhkan vs tersedia |
| `getMyRecentExpenses`  | `projectId?`, `limit` | pengeluaran terakhir + statusnya        |
| `getExpenseCategories` | —                     | kategori dari Settings (untuk proposal) |

### Aturan desain tool

- Skema Zod datar, parameter sedikit, deskripsi jelas dalam bahasa Inggris (model lebih patuh) sementara output boleh Bahasa Indonesia.
- Output dibatasi jumlah baris (`limit` default kecil) supaya tidak meledakkan token.
- Uang dikembalikan sebagai **string terformat** _dan_ angka rupiah bulat, supaya model tidak salah menghitung sendiri. Model dilarang melakukan aritmatika uang — semua agregat sudah dihitung di server.

---

## 6. Proposal Card

AI boleh **mengusulkan**, tidak pernah mengeksekusi.

Alur:

1. Model memanggil tool `proposeExpenseDraft` (read-only: hanya memvalidasi dan menormalkan usulan, tidak menyentuh DB).
2. Hasilnya dirender sebagai kartu React di stream chat lewat generative UI AI SDK.
3. Kartu menampilkan ringkasan lengkap: proyek, kategori, jumlah, deskripsi.
4. Tombol konfirmasi memanggil **Server Action existing** di `app/actions/**` — jalur yang sama persis dengan form manual, termasuk validasi Zod dan RBAC.
5. Setelah sukses, kartu berubah jadi status "terkirim" dan menyimpan referensi dokumen.

Fase 1 mencakup **satu** jenis proposal: draf pengajuan biaya lapangan. Jenis lain menyusul setelah polanya terbukti.

**Aturan keras:** kartu proposal tidak pernah auto-submit, tidak punya perilaku "konfirmasi otomatis", dan Server Action-nya tidak boleh mempercayai satupun field yang belum divalidasi ulang di server.

---

## 7. Keamanan

- **Prompt injection.** Nama vendor, deskripsi pengeluaran, dan catatan adalah data yang diketik pengguna dan bisa berisi instruksi. Output tool dibungkus penanda eksplisit sebagai data, dan system prompt menyatakan bahwa isi data tidak pernah menjadi perintah. Karena semua tool read-only, dampak terburuk injection terbatas pada jawaban yang menyesatkan — bukan mutasi.
- **Rate limit** per pengguna per menit di route handler.
- **Biaya** dicatat per pesan (`inputTokens`/`outputTokens`/`provider`).
- **API key** hanya di server: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`. Tidak pernah masuk bundle klien.
- **Kebocoran lintas proyek** dicegah di layer tool, bukan prompt.

---

## 8. UI

Komponen baru di `features/ai-chat/` (slice baru; perlu penambahan edge di `feature-boundaries.test.ts`).

- Full-screen sheet dari tombol header, memakai `slideUpDrawerVariants` + `transitionSpringSmooth` dari `lib/utils/motion.ts`.
- Mengikuti DESIGN.md: shell `max-w-md` satu kolom, capsule control, tanpa glass/gradient.
- Bubble pengguna dan balasan asisten dibedakan lewat tonal layering, bukan warna mencolok.
- Angka memakai `MoneyValue` (tabular numerals, tidak wrap).
- Indikator "sedang memanggil data" saat tool berjalan — bukan spinner kosong, tapi label yang menyebut apa yang sedang diambil.
- `loading.tsx` struktural untuk riwayat chat.
- Target sentuh 48×48, focus ring keyboard, label SR, clearance safe-area, dukungan reduced-motion.
- Verifikasi di lebar 320, 360, 390, 430 px.

---

## 9. Urutan Kerja

| Fase | Isi                                                                                                       | Hasil yang bisa dilihat                 |
| ---- | --------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1    | Dependensi, `lib/ai/providers.ts`, rename `ai` -> `geminiClient`, izin `use:ai_chat`, dua tabel + migrasi | Fondasi, belum ada UI                   |
| 2    | Route handler + agent loop + tool batch 1 + persistensi                                                   | Chat jalan, bisa tanya proyek & budget  |
| 3    | UI chat sesuai DESIGN.md + riwayat percakapan                                                             | Tombol header berfungsi penuh           |
| 4    | Tool batch 2 & 3                                                                                          | Cakupan pertanyaan Owner + PM lengkap   |
| 5    | Proposal card draf pengajuan biaya                                                                        | AI bisa mengusulkan, manusia konfirmasi |
| 6    | Update `CLAUDE.md`, `AI_AGENT_ARCHITECTURE.md`, `ARCHITECTURE.md`, `API_ACTIONS.md`                       | Dokumen selaras dengan kode             |

Seluruh fase di atas sudah dikerjakan; lihat Catatan Pelaksanaan di bawah untuk penyimpangan dari rencana awal.

Fase 1–3 sudah membuat tombol chat berguna. Fase 5 adalah bagian paling berisiko dan sebaiknya melewati review gate tersendiri.

---

## 10. Pengujian

- Unit test tiap tool: scoping RBAC (PM tidak bisa membaca proyek orang lain), pembatasan limit, bentuk output.
- Test fallback provider: DeepSeek gagal sebelum stream -> Gemini dipakai; gagal di tengah stream -> pesan ditandai gagal, tidak ada stream tergabung.
- Test bahwa tidak ada tool yang menulis ke DB (assert atas registry).
- `bun test lib/architecture/` setelah menambah slice `features/ai-chat/`.
- Verifikasi manual di lebar 320–430 px.

---

## 11. Risiko Terbuka

| Risiko                                                   | Mitigasi                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| DeepSeek terlalu banyak memanggil tool -> lambat & mahal | `stepCountIs(8)`, prompt tegas, monitor token per pesan                         |
| Perilaku berbeda antara DeepSeek dan Gemini              | System prompt bervarian per provider; uji pertanyaan yang sama di keduanya      |
| Benchmark agentic DeepSeek adalah klaim vendor           | Evaluasi sendiri dengan ~20 pertanyaan nyata sebelum fase 4                     |
| Sheet chat menambah berat mobile shell                   | Muat komponen chat secara lazy; jangan bebani first paint                       |
| Scope fase 1 lebar (dua audiens + proposal)              | Fase 5 dipisah sebagai gate tersendiri agar bisa ditunda tanpa merusak fase 1–4 |

---

## Catatan Pelaksanaan (fase 1–3)

Yang berubah dari rencana awal setelah bertemu kode dan data nyata:

- **AI SDK yang terpasang adalah v7**, bukan v5. API yang dipakai: `streamText`, `createUIMessageStream`, `toUIMessageStream`, `stepCountIs`, `useChat`, `DefaultChatTransport`.
- **`ai_conversation.projectId` dibatalkan.** Mengimpor tabel `project` ke `db/schema/system.ts` menciptakan siklus impor (`system → projects → auth → system`). Kolom itu belum dipakai di fase 1–3, jadi dihapus daripada memaksa siklus.
- **Id percakapan dikirim lewat data part transient**, bukan header respons, karena `DefaultChatTransport` tidak memaparkan header ke klien.
- **`z.string().uuid()` diganti `z.guid()`.** Zod v4 `.uuid()` menegakkan bit versi/varian RFC 4122, sementara seed data memakai id seperti `77777777-7777-7777-7777-777777777772` yang varian-nya tidak sah. Akibatnya setiap tool ber-`projectId` gagal validasi walau id-nya benar-benar ada di database. Ini akan mengenai data seed dan demo mana pun — gunakan `z.guid()` untuk id internal.
- **`bunfig.toml` + `scripts/test-preload.ts` ditambahkan.** `bun test` tidak menetapkan kondisi resolusi `react-server`, sehingga modul ber-`import "server-only"` gagal dimuat di test. Preload menetralkannya tanpa melemahkan pagar di kode produksi.
- **`server-only` dipasang sebagai devDependency.** Next.js meng-alias-nya saat build dan tidak pernah menginstalnya; test runner butuh paket nyata.
- **Model OCR diperbarui** dari `gemini-3-flash-preview` ke `gemini-3.7-flash`, disatukan sebagai `GEMINI_OCR_MODEL` di `lib/ai/gemini.ts`.
- **Jawaban dibersihkan dari sisa Markdown** di `features/ai-chat/utils/answer-text.ts`. Permukaan chat sengaja tanpa pemroses Markdown; system prompt meminta teks biasa, dan penanda yang lolos dibuang agar tidak terbaca sebagai simbol asing.
- **Jejak tool identik berturut-turut digabung** menjadi satu baris bercacah, dan tool yang gagal ditandai gagal — bukan ditampilkan seolah selesai.
- **Migrasi `0029` disunting**: DDL `cash_transaction` yang ikut ter-generate dibuang karena kolom, indeks, dan constraint-nya sudah ada di database (diterapkan di luar Drizzle, snapshot 0028 ketinggalan). Snapshot 0029 sudah mencatatnya, jadi `generate` berikutnya tetap benar.

## Catatan Pelaksanaan (fase 4–6)

- **Registry tool dipecah** menjadi `project-tools`, `finance-tools`, `operations-tools`, dan `proposal-tools`, digabung di `lib/ai/tools/index.ts`. Pembantu bersama pindah ke `shared.ts`.
- **Penggerbangan izin ditambahkan di layer tool** lewat `hasPermission`, memakai `ROLE_PERMISSIONS` yang sama dengan Server Action. Penolakan dikembalikan sebagai data, bukan dilempar, supaya model bisa menjelaskannya tanpa menggagalkan seluruh jawaban.
- **`getPendingApprovals` sengaja dibatasi ke peran berlingkup global.** Antrean persetujuan adalah pandangan lintas proyek; membukanya untuk PM akan membocorkan pengajuan proyek lain. `getPendingApprovalDetails` yang ada tidak menyaring per proyek, jadi pembatasan dilakukan di tool.
- **`getUpcomingBills` dan `getRecentExpenses` membatasi di dalam query** lewat `projectScopeCondition`, bukan menyaring setelah baris terbaca.
- **Proposal card**: tool `proposeExpenseDraft` hanya menormalkan dan memverifikasi. Kategori budget dicocokkan dengan `projectBudgetId` **dan** `expenseCategoryId` sekaligus — mencocokkan hanya lewat kategori bisa mengambil baris milik proyek lain.
- **`aiExpenseProposalSchema` sengaja sempit.** `stockHandling`, `materialId`, dan `projectRapItemId` tidak diterima dari jalur AI, sehingga percakapan tidak bisa memicu efek samping stok. Ada test yang menjaga ini.
- **`read-only.test.ts` diperkuat**: kini juga menggagalkan suite bila ada berkas tool mengimpor dari `@/app/actions/**`, dan mengunci daftar nama tool di registry.

### Terverifikasi di aplikasi berjalan

- Total kas dan tagihan vendor yang dijawab asisten cocok persis dengan angka Dashboard (Rp 1.048.650.000 dan Rp 61.000.000).
- Kartu usulan dikonfirmasi manusia menghasilkan satu baris `project_cost` berstatus `SUBMITTED`, atas nama pengguna yang menekan tombol — bukan atas nama asisten.

## Lanjutan: Pemilih Percakapan dan Perbaikan Konfirmasi Ganda

Dikerjakan setelah fase 6, dipicu laporan bug dari pengguna.

**Bug: kartu usulan bisa dikonfirmasi dua kali.** Status "terkirim" hanya hidup di state React, sehingga setiap kali riwayat dimuat ulang kartu lama kembali menawarkan tombol konfirmasi — dan menekannya akan membuat dokumen kedua untuk permintaan yang sama.

Perbaikannya diletakkan di database, bukan di antarmuka. Tabel `ai_proposal_confirmation` mencatat `tool_call_id` (identitas kartu dari AI SDK, ikut tersimpan di `ai_message.parts`) dengan batasan UNIQUE. Akibatnya satu kartu hanya bisa menghasilkan satu dokumen, apa pun yang terjadi di klien: klik ganda, permintaan berlomba, atau percakapan yang dibuka lagi setelah berhari-hari. `confirmAiExpenseProposal` memeriksa catatan itu lebih dulu dan mengembalikan dokumen yang sama bila sudah ada.

Kegagalan mencatat jejak konfirmasi sengaja **tidak** dilaporkan sebagai kegagalan pengajuan, karena dokumennya sudah tercipta — melaporkannya sebagai gagal justru akan mendorong pengguna menekan tombol lagi.

**Pemilih percakapan** ditambahkan di dalam sheet, bukan sebagai overlay kedua di atasnya, agar hierarki z-index yang berlaku tidak dilanggar. Berisi tombol percakapan baru, daftar percakapan dengan waktu relatif, penanda percakapan aktif, dan penghapusan dengan konfirmasi sebaris. Menghapus percakapan tidak menghapus pengeluaran yang sudah tercatat darinya.

## Lanjutan: Hasil Tool Dirender sebagai Antarmuka

Sebelumnya seluruh jawaban keluar sebagai teks: tool mengembalikan data terstruktur, lalu model menarasikannya kembali menjadi paragraf. Sekarang setiap tool data punya renderer kartu sendiri di `features/ai-chat/components/tool-results/`, memakai primitif bersama yang sama dengan `/ledger`.

Tiga hal yang menopangnya:

- **`lib/ai/tool-output.ts`** memegang skema Zod untuk seluruh keluaran tool dan sengaja tanpa penanda `server-only`. Tool membentuk kembaliannya dari skema itu, renderer klien membacanya lewat `safeParse`. Karena keluaran tersimpan sebagai JSON dan dibaca ulang sebagai `unknown`, tanpa skema bersama renderer pasti menyimpang diam-diam.
- **Registry renderer** memetakan nama tool ke komponen. Tool tanpa entri, parse yang gagal, atau hasil berupa penolakan hanya menyumbang baris jejak. Pesan lama yang tersimpan sebelum sebuah kolom ada tetap dirender, hanya tanpa deep link.
- **`TOOLS_WITH_CARDS`** dipakai dua arah — oleh registry dan oleh system prompt — dan diuji agar keduanya selalu identik.

**Temuan yang layak diingat:** memberi tahu model secara abstrak bahwa "antarmuka sudah menampilkan kartu" tidak berhasil; ia tetap menuliskan ulang seluruh tabel. Menyebut nama toolnya secara eksplisit langsung berhasil — jawaban turun dari ~620 karakter berbentuk daftar berpoin menjadi ~280 karakter prosa yang memimpin dengan penilaian.

Kartu dirender di luar gelembung dengan lebar penuh, karena menumpuk padding kartu di dalam padding gelembung menyempitkan kolom angka sampai nilai uang utama wrap di 320 px.

Kartu budget hanya menampilkan kategori bermasalah plus dua kategori teratas sebagai konteks; sisanya diringkas satu baris. Tanpa itu, satu jawaban lintas empat proyek menghasilkan ~2.200 px yang harus digulir.

## Belum Dikerjakan

- Jenis proposal selain pengajuan biaya lapangan.
- Kartu untuk `getProjectHealth` masih menampilkan agregat sederhana; belum ada perbandingan margin target versus proyeksi.
- Briefing dan Risk Agent terjadwal; keduanya bisa memakai ulang registry tool yang sama.
- Evaluasi sendiri atas ~20 pertanyaan nyata untuk mengukur perilaku DeepSeek versus Gemini, seperti disebut di tabel risiko.

## Sumber

- [DeepSeek API Docs](https://api-docs.deepseek.com/)
- [DeepSeek V4 Preview Release](https://api-docs.deepseek.com/news/news260424/)
- [DeepSeek-V4-Flash-0731 agentic upgrade](https://www.marktechpost.com/2026/07/31/deepseek-upgrades-deepseek-v4-flash-0731-with-major-agentic-and-coding-gains/)
