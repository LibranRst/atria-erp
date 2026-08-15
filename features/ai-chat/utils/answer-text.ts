/**
 * Membersihkan sisa penanda Markdown dari jawaban model.
 *
 * System prompt sudah meminta teks biasa, tetapi model bahasa tetap sesekali
 * menebalkan dengan tanda bintang. Karena permukaan chat sengaja tidak memakai
 * pemroses Markdown — jawaban dibaca sebagai prosa tenang, bukan dokumen —
 * penanda yang lolos dibersihkan di sini supaya tidak terbaca sebagai simbol asing.
 *
 * Hanya penanda penekanan dan judul yang dibuang. Tanda hubung di awal baris
 * dipertahankan karena memang dipakai sebagai penanda daftar.
 */
export function cleanAnswerText(text: string): string {
  return text
    .replace(/\*\*\*(?=\S)(.+?)(?<=\S)\*\*\*/g, "$1")
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "$1")
    .replace(/(?<![\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?![\w*])/g, "$1")
    .replace(/(?<![\w`])`(?=\S)([^`\n]+?)(?<=\S)`(?![\w`])/g, "$1")
    .replace(/^#{1,6}[ \t]+/gm, "");
}
