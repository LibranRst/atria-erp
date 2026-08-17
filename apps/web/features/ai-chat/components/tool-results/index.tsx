"use client";

import type { ToolResultRenderer } from "./types";

import { BankBalancesResult } from "./bank-balances-result";
import {
  ExpenseCategoriesResult,
  MaterialShortageResult,
  PendingApprovalsResult,
  RecentExpensesResult,
} from "./operations-result";
import { ProjectBudgetResult } from "./project-budget-result";
import { ProjectsAtRiskResult } from "./projects-at-risk-result";
import { ProjectHealthResult, ProjectsResult } from "./projects-result";
import { UpcomingBillsResult } from "./upcoming-bills-result";

/**
 * Pemetaan nama tool ke komponen yang merender hasilnya.
 *
 * Tool tanpa entri di sini tetap aman: hasilnya hanya menyumbang baris jejak,
 * persis seperti sebelum kartu ada. Renderer juga boleh mengembalikan `null`
 * ketika bentuk keluarannya tidak cocok — misalnya pesan lama yang tersimpan
 * sebelum bentuknya berubah, atau hasil berupa penolakan akses. Dalam kedua
 * kasus itu jawaban tetap utuh karena teks model berdiri sendiri.
 */

const TOOL_RESULT_RENDERERS: Readonly<Record<string, ToolResultRenderer>> = {
  listProjects: ProjectsResult,
  getProjectsAtRisk: ProjectsAtRiskResult,
  getProjectBudget: ProjectBudgetResult,
  getProjectHealth: ProjectHealthResult,
  getBankBalances: BankBalancesResult,
  getPendingApprovals: PendingApprovalsResult,
  getUpcomingBills: UpcomingBillsResult,
  getMaterialShortage: MaterialShortageResult,
  getRecentExpenses: RecentExpensesResult,
  getExpenseCategories: ExpenseCategoriesResult,
};

/**
 * Tool yang biasanya dipanggil sebagai langkah pencarian, bukan sebagai jawaban.
 *
 * `listProjects` dipakai model untuk menerjemahkan nama proyek menjadi id, dan
 * `getExpenseCategories` untuk menerjemahkan sebutan kategori menjadi kode.
 * Ketika pengguna bertanya soal satu proyek, menampilkan daftar tujuh proyek di
 * atas jawabannya bukan sekadar ramai — ia memperlakukan pencarian id sebagai
 * hasil, dan mengubur jawaban yang sebenarnya.
 *
 * Keduanya tetap punya kartu, karena ada pertanyaan yang jawabannya memang
 * daftar itu sendiri ("proyek apa saja yang aktif?"). Kartunya hanya mengalah
 * ketika ada kartu lain yang lebih spesifik di balasan yang sama.
 */
const SUPPORTING_RESULT_TOOLS = new Set(["listProjects", "getExpenseCategories"]);

export function isSupportingResultTool(toolName: string): boolean {
  return SUPPORTING_RESULT_TOOLS.has(toolName);
}

/**
 * Menyaring kartu yang hanya berperan sebagai langkah pencarian.
 * Bila tidak ada kartu lain, kartu pencarian tetap ditampilkan.
 */
export function selectVisibleCards<T extends { readonly toolName: string }>(
  cards: readonly T[],
): readonly T[] {
  const specific = cards.filter((card) => !isSupportingResultTool(card.toolName));
  return specific.length > 0 ? specific : cards;
}

export function resolveToolResultRenderer(toolName: string): ToolResultRenderer | null {
  return TOOL_RESULT_RENDERERS[toolName] ?? null;
}

/**
 * Nama tool yang punya renderer. Diuji terhadap `TOOLS_WITH_CARDS` di
 * `lib/ai/tool-output.ts`, karena daftar itulah yang disebut system prompt
 * kepada model. Kalau keduanya berbeda, model akan diminta merahasiakan angka
 * yang sebenarnya tidak pernah muncul sebagai kartu — atau sebaliknya.
 */
export function registeredToolNames(): readonly string[] {
  return Object.keys(TOOL_RESULT_RENDERERS);
}

export function hasToolResultRenderer(toolName: string): boolean {
  return toolName in TOOL_RESULT_RENDERERS;
}

export type { ToolResultContext, ToolResultProps, ToolResultRenderer } from "./types";
export { resolveProjectName } from "./types";
