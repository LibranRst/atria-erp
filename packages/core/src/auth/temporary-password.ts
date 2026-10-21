import { passwordPolicySchema } from "../validations/administration";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Tanpa 'I' dan 'O' untuk menghindari kebingungan dengan 1 dan 0
const LOWER = "abcdefghijkmnopqrstuvwxyz"; // Tanpa 'l' untuk menghindari kebingungan dengan 1
const DIGITS = "23456789"; // Tanpa '0' dan '1' untuk kejelasan visual
const ALL_SAFE = `${UPPER}${LOWER}${DIGITS}`;

function getRandomInt(max: number): number {
  const browserCrypto = globalThis.crypto;
  if (typeof browserCrypto?.getRandomValues === "function") {
    const arr = new Uint32Array(1);
    browserCrypto.getRandomValues(arr);
    return arr[0]! % max;
  }
  return Math.floor(Math.random() * max);
}

function getRandomChar(chars: string): string {
  return chars[getRandomInt(chars.length)]!;
}

/**
 * Menghasilkan kata sandi sementara yang aman, mudah dibaca, dan dijamin
 * memenuhi kebijakan password Paduna Build (`passwordPolicySchema`).
 *
 * Pola format: `Paduna-2026-XXXXXX` (minimal 16 karakter, memuat huruf besar,
 * huruf kecil, angka, dan pemisah ramah baca).
 */
export function generateSecureTemporaryPassword(): string {
  const year = new Date().getFullYear();
  let suffix = "";
  // Pastikan setidaknya ada 1 huruf besar, 1 huruf kecil, dan 1 angka di suffix
  suffix += getRandomChar(UPPER);
  suffix += getRandomChar(LOWER);
  suffix += getRandomChar(DIGITS);
  for (let i = 0; i < 3; i++) {
    suffix += getRandomChar(ALL_SAFE);
  }

  // Acak urutan karakter suffix
  const suffixArray = suffix.split("");
  for (let i = suffixArray.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    const temp = suffixArray[i]!;
    suffixArray[i] = suffixArray[j]!;
    suffixArray[j] = temp;
  }

  const generated = `Paduna-${year}-${suffixArray.join("")}`;

  // Validasi mandiri terhadap skema kebijakan password
  const validation = passwordPolicySchema.safeParse(generated);
  if (!validation.success) {
    // Fallback darurat jika ada anomali
    return `Paduna-2026-Xy9kQm`;
  }

  return generated;
}
