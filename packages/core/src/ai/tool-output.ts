import { z } from "zod";

/**
 * Bentuk keluaran tool AI, dipakai bersama oleh server dan klien.
 *
 * Modul ini adalah kontrak murni tanpa marker khusus server. Keluaran tool tersimpan
 * sebagai JSON di `ai_message.parts`, lalu dibaca kembali oleh antarmuka sebagai
 * nilai `unknown` ketika riwayat dimuat. Kalau bentuknya didefinisikan dua kali —
 * sekali di tool, sekali di renderer — keduanya pasti menyimpang begitu ada
 * perubahan kecil, dan kartu akan merender nilai yang salah tanpa ada yang tahu.
 *
 * Karena itu setiap tool membentuk kembaliannya dari skema di sini, dan setiap
 * renderer membacanya lewat `safeParse`. Pesan lama yang bentuknya sudah usang
 * gagal parse dengan rapi, lalu antarmuka jatuh kembali ke baris jejak.
 */

/**
 * Tool yang hasilnya dirender sebagai kartu di antarmuka.
 *
 * Dipakai dua arah, dan itu memang tujuannya: registry renderer memverifikasi
 * dirinya terhadap daftar ini, dan system prompt menyebut nama-nama ini apa
 * adanya kepada model. Memberi tahu model secara abstrak bahwa "antarmuka sudah
 * menampilkan kartu" terbukti tidak cukup — ia tetap menuliskan ulang seluruh
 * isi tabel. Menyebut nama toolnya jauh lebih patuh.
 */
export const TOOLS_WITH_CARDS = [
  "listProjects",
  "getProjectsAtRisk",
  "getProjectBudget",
  "getProjectHealth",
  "getBankBalances",
  "getPendingApprovals",
  "getUpcomingBills",
  "getMaterialShortage",
  "getRecentExpenses",
  "getExpenseCategories",
  "listVendors",
  "listClients",
  "getMaterialCatalog",
  "getUnpaidVendorBills",
  "getUnpaidClientInvoices",
  "getPendingExpenseApprovals",
  "suggestRoleReview",
] as const;

export type ToolWithCard = (typeof TOOLS_WITH_CARDS)[number];

/**
 * Nilai uang selalu dikirim berpasangan: angka untuk perbandingan dan
 * perhitungan tampilan, string terformat untuk dikutip apa adanya oleh model.
 */
export const moneySchema = z.object({
  amount: z.number(),
  formatted: z.string(),
});

/**
 * Label cakupan yang dipakai kartu untuk menyatakan bahwa hasilnya dipersempit.
 *
 * Opsional karena pesan lama tersimpan tanpa bidang ini, dan karena tidak semua
 * tool punya penyempitan yang perlu diumumkan.
 */
export const appliedFiltersSchema = z.array(z.string()).optional();

export type ToolMoney = z.infer<typeof moneySchema>;

/**
 * Bentuk penolakan. Tool mengembalikan penolakan sebagai data, bukan melempar,
 * supaya model bisa menjelaskannya kepada pengguna. Renderer memakai ini untuk
 * membedakan "tidak boleh dilihat" dari "kosong".
 */
export const toolErrorSchema = z.object({
  error: z.string(),
});

export function isToolError(output: unknown): boolean {
  return toolErrorSchema.safeParse(output).success;
}

// ==========================================
// listProjects
// ==========================================
export const listProjectsOutputSchema = z.object({
  appliedFilters: appliedFiltersSchema,
  projects: z.array(
    z.object({
      projectId: z.string(),
      name: z.string(),
      clientName: z.string().nullable(),
      status: z.string(),
      storedHealth: z.string(),
      contractValue: moneySchema,
    }),
  ),
});

// ==========================================
// getProjectBudget
// ==========================================
export const projectBudgetCategorySchema = z.object({
  categoryName: z.string(),
  categoryCode: z.string(),
  allocated: moneySchema,
  actual: moneySchema,
  pending: moneySchema,
  remaining: moneySchema,
  usedPercentage: z.number(),
  status: z.string(),
});

export const getProjectBudgetOutputSchema = z.object({
  // Ditambahkan agar kartu bisa membuka budget proyek yang bersangkutan.
  // Opsional karena pesan lama tersimpan tanpa kolom ini.
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  budgetStatus: z.string(),
  internalBudget: moneySchema,
  contractValue: moneySchema,
  projectProgressPercentage: z.number(),
  categories: z.array(projectBudgetCategorySchema),
});

export type ProjectBudgetOutput = z.infer<typeof getProjectBudgetOutputSchema>;
export type ProjectBudgetCategory = z.infer<typeof projectBudgetCategorySchema>;

// ==========================================
// getBankBalances
// ==========================================
export const getBankBalancesOutputSchema = z.object({
  totalAvailable: moneySchema,
  accounts: z.array(
    z.object({
      accountId: z.guid().optional(),
      accountName: z.string(),
      bankName: z.string(),
      balance: moneySchema,
    }),
  ),
});

export type BankBalancesOutput = z.infer<typeof getBankBalancesOutputSchema>;

// ==========================================
// getUpcomingBills
// ==========================================
export const upcomingBillSchema = z.object({
  billNumber: z.string(),
  vendorName: z.string(),
  projectName: z.string(),
  projectId: z.string().optional(),
  amount: moneySchema,
  status: z.string(),
  dueInDays: z.number(),
  timing: z.enum(["OVERDUE", "DUE_TODAY", "UPCOMING"]),
});

export const getUpcomingBillsOutputSchema = z.object({
  appliedFilters: appliedFiltersSchema,
  horizonDays: z.number(),
  totalOutstanding: moneySchema,
  bills: z.array(upcomingBillSchema),
});

export type UpcomingBillsOutput = z.infer<typeof getUpcomingBillsOutputSchema>;
export type UpcomingBill = z.infer<typeof upcomingBillSchema>;

// ==========================================
// getProjectHealth
// ==========================================
/**
 * Proyek tanpa budget tersusun tetap mengembalikan penilaian, hanya tanpa
 * angka agregat. Karena itu bidang totalnya opsional, bukan bentuk terpisah.
 */
export const getProjectHealthOutputSchema = z.object({
  projectId: z.string().optional(),
  projectName: z.string(),
  health: z.string(),
  reasons: z.array(z.string()),
  note: z.string().optional(),
  totalAllocated: moneySchema.optional(),
  totalActual: moneySchema.optional(),
  totalRemaining: moneySchema.optional(),
  usedPercentage: z.number().optional(),
});

export type ProjectHealthOutput = z.infer<typeof getProjectHealthOutputSchema>;

// ==========================================
// getPendingApprovals
// ==========================================
export const pendingApprovalSchema = z.object({
  projectName: z.string(),
  description: z.string(),
  amount: moneySchema,
  requestedBy: z.string(),
  priority: z.enum(["CRITICAL", "WARNING", "NORMAL"]),
  priorityReason: z.string(),
  waitingDays: z.number(),
});

export const getPendingApprovalsOutputSchema = z.object({
  appliedFilters: appliedFiltersSchema,
  totalWaiting: z.number(),
  approvals: z.array(pendingApprovalSchema),
});

export type PendingApprovalsOutput = z.infer<typeof getPendingApprovalsOutputSchema>;
export type PendingApproval = z.infer<typeof pendingApprovalSchema>;

// ==========================================
// getMaterialShortage
// ==========================================
export const materialShortageSchema = z.object({
  materialName: z.string(),
  unit: z.string(),
  requiredQuantity: z.number(),
  securedQuantity: z.number(),
  needToBuyQuantity: z.number(),
  estimatedPurchaseCost: moneySchema,
});

export const getMaterialShortageOutputSchema = z.object({
  projectId: z.string().optional(),
  rapStatus: z.string(),
  shortageCount: z.number().optional(),
  estimatedTotalPurchaseCost: moneySchema.optional(),
  shortages: z.array(materialShortageSchema),
  note: z.string().optional(),
});

export type MaterialShortageOutput = z.infer<typeof getMaterialShortageOutputSchema>;
export type MaterialShortage = z.infer<typeof materialShortageSchema>;

// ==========================================
// getRecentExpenses
// ==========================================
export const recentExpenseSchema = z.object({
  id: z.string().optional(),
  projectCostId: z.string().nullable().optional(),
  description: z.string(),
  projectId: z.string().optional(),
  projectName: z.string(),
  categoryName: z.string(),
  categoryId: z.string().optional(),
  categoryCode: z.string().optional(),
  amount: moneySchema,
  exactAmount: z.string().optional(),
  status: z.string(),
  paymentStatus: z.string(),
  expenseDate: z.string(),
  sourceType: z.string().optional(),
  isCashImpact: z.boolean().optional(),
  descriptionMatchesInScope: z.number().int().nonnegative().optional(),
});

export const getRecentExpensesOutputSchema = z.object({
  appliedFilters: appliedFiltersSchema,
  expenses: z.array(recentExpenseSchema),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().optional(),
  hasMore: z.boolean().optional(),
  nextOffset: z.number().int().nonnegative().nullable().optional(),
  matchedCount: z.number().int().nonnegative().optional(),
  scope: z.string().optional(),
  dateBasis: z.literal("expenseDate").optional(),
  timeZone: z.literal("Asia/Jakarta").optional(),
  requiresExpenseChoice: z.boolean().optional(),
  project: z.object({ id: z.string(), name: z.string() }).optional(),
  dateRange: z
    .object({
      asOf: z.iso.datetime(),
      label: z.string(),
      start: z.iso.datetime(),
      end: z.iso.datetime(),
      requestedEnd: z.iso.datetime(),
      isPartial: z.boolean(),
    })
    .optional(),
});

export type RecentExpensesOutput = z.infer<typeof getRecentExpensesOutputSchema>;
export type RecentExpense = z.infer<typeof recentExpenseSchema>;

// ==========================================
// getExpenseCategories
// ==========================================
export const getExpenseCategoriesOutputSchema = z.object({
  categories: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    }),
  ),
});

export type ExpenseCategoriesOutput = z.infer<typeof getExpenseCategoriesOutputSchema>;

// ==========================================
// getProjectsAtRisk
// ==========================================
/**
 * Hanya memuat proyek yang benar-benar perlu perhatian, masing-masing dengan
 * kategori terburuknya. Menggantikan pola memanggil budget tiap proyek satu per
 * satu, yang ikut memunculkan kartu proyek sehat dan tidak menjawab apa pun.
 */
export const projectAtRiskSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  health: z.string(),
  reasons: z.array(z.string()),
  usedPercentage: z.number(),
  totalRemaining: moneySchema,
  worstCategory: z
    .object({
      categoryName: z.string(),
      usedPercentage: z.number(),
      remaining: moneySchema,
      status: z.string(),
    })
    .nullable(),
});

export const getProjectsAtRiskOutputSchema = z.object({
  appliedFilters: appliedFiltersSchema,
  assessedCount: z.number().optional(),
  projects: z.array(projectAtRiskSchema),
});

export type ProjectsAtRiskOutput = z.infer<typeof getProjectsAtRiskOutputSchema>;
export type ProjectAtRisk = z.infer<typeof projectAtRiskSchema>;

// ==========================================
// suggestRoleReview
// ==========================================

/**
 * Kartu serah-terima perubahan peran.
 *
 * Ia sengaja TIDAK berbentuk kartu usulan seperti `proposeExpenseDraft`: tidak
 * ada tombol konfirmasi, dan tidak ada Server Action di ujungnya. Yang
 * dibawanya hanyalah tautan ke penyunting peran dengan sakelar yang disarankan
 * tersorot — keputusannya tetap terjadi di layar yang dirancang untuk itu.
 * Alasannya tercatat di `docs/plans/2026-08-25-ai-role-intelligence.md`.
 */
const suggestedPermissionSchema = z.object({
  key: z.string(),
  label: z.string(),
});

export const roleReviewOutputSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  reason: z.string(),
  href: z.string(),
  grant: z.array(suggestedPermissionSchema),
  revoke: z.array(suggestedPermissionSchema),
  affectedUsers: z.number(),
  criticalGaps: z.array(z.object({ permission: z.string(), consequence: z.string() })),
  blockedGrants: z.array(z.string()),
});

export type RoleReviewOutput = z.infer<typeof roleReviewOutputSchema>;
