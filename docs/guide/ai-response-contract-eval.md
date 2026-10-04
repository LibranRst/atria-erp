# Evaluasi Kontrak Jawaban AI

**Tanggal:** 20 Agustus 2026  
**Harness:** `apps/api/scripts/eval-ai-response-contract.ts`

Evaluasi memakai enam fixture sintetis Atria — fakta sederhana, perbandingan,
risiko kritis, card-backed answer, permintaan detail, dan jawaban tool-heavy.
Tidak ada data produksi, persistence, atau mutasi finance/material yang digunakan.

## Rubric

- Jawaban rutin maksimal sekitar 100 kata; explicit detail dan fakta keputusan
  boleh lebih panjang.
- Kesimpulan muncul lebih dulu, maksimal tiga bullet untuk jawaban rutin.
- Tidak ada progress narration, generic closing, atau pengulangan row kartu.
- Follow-up berjumlah 1–3, unik, dan grounded pada temuan atau next action.
- `suggestFollowUps` hanya menghentikan agent loop setelah jawaban teks tersedia.

## Hasil bounded pass

DeepSeek memenuhi kontrak panjang pada keenam skenario: jawaban rutin berada pada
rentang 16–88 kata, explicit detail sekitar 116–150 kata, dan tool-heavy sekitar
111–136 kata. Card-backed answer turun menjadi 42 kata, menyebut satu tagihan
prioritas, dan tidak lagi diulang setelah follow-up tool.

Follow-up DeepSeek tetap bersifat probabilistik: pada beberapa run model memberi
dua chip yang grounded, pada run lain melewati tool atau membuka topik operasional
yang berdekatan. Prompt sekarang mewajibkan tool, mengizinkan satu chip agar tidak
menciptakan filler, dan melarang topik baru; membuat invocation sepenuhnya
deterministik memerlukan generation kedua yang sengaja berada di luar scope.

Gemini menghasilkan sample singkat yang sesuai pada skenario fakta sederhana dan
risiko kritis. Ia juga menemukan edge memanggil follow-up sebelum jawaban; shared
stop-condition kini membiarkan loop lanjut sampai teks tersedia. Recheck penuh
tidak dapat diselesaikan karena provider mengembalikan quota/rate-limit, sehingga
skenario Gemini yang tersisa berstatus belum dievaluasi, bukan gagal.

## Menjalankan ulang

```bash
cd apps/web
bun --conditions react-server scripts/eval-ai-response-contract.ts
```

Gunakan `AI_EVAL_PROVIDER=DEEPSEEK|GEMINI` dan `AI_EVAL_SCENARIO=<id>` untuk
bounded rerun. Script hanya mencetak jawaban fixture sintetis pada hasil yang perlu
review dan tidak pernah mencetak API key.
