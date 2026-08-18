/**
 * Titik masuk `@atria/core`.
 *
 * Paket ini hanya berisi logika domain murni yang dipakai bersama oleh web
 * (Next.js) dan mobile (Expo): schema Zod, helper uang/tanggal, matriks
 * perizinan, dan kalkulasi RAP/RAB/stok. Tidak boleh ada `next/*`, React,
 * Drizzle, Better Auth, `server-only`, atau modul `node:*` di sini — batas itu
 * ditegakkan oleh `src/purity.test.ts`.
 *
 * Konsumen mengimpor lewat subpath spesifik (`@atria/core/utils/money`,
 * `@atria/core/validations/finance`) supaya graf impor tetap sempit.
 */
export type { ActionResponse } from "./types/action-response";
