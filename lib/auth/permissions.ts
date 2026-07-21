import { db } from "@/db";
import { role } from "@/db/schema";
import { eq } from "drizzle-orm";

// 1. Kunci Izin Finansial (Permission Keys)
export type PermissionKey =
  | "view:bank_account"
  | "create:bank_account"
  | "update:bank_account"
  | "delete:bank_account"
  | "view:ledger"
  | "create:ledger"
  | "reconcile:ledger"
  | "view:budget"
  | "create:budget"
  | "update:budget"
  | "approve:budget"
  | "view:cost"
  | "create:cost"
  | "update:cost"
  | "approve:cost"
  | "pay:cost"
  | "view:vendor_bill"
  | "create:vendor_bill"
  | "update:vendor_bill"
  | "pay:vendor_bill"
  | "view:client_invoice"
  | "create:client_invoice"
  | "update:client_invoice"
  | "reconcile:client_invoice"
  | "view:profitability"
  | "view:ai_brief"
  | "view:material"
  | "create:material"
  | "update:material"
  | "view:inventory"
  | "create:stock_movement"
  | "reserve:stock"
  | "use:stock"
  | "adjust:stock"
  | "waste:stock"
  | "transfer:stock"
  | "create:stock_count"
  | "approve:stock_count"
  | "request:goods_receipt_reversal"
  | "approve:goods_receipt_reversal"
  | "view:rap"
  | "create:rap"
  | "update:rap"
  | "lock:rap"
  | "view:rab"
  | "create:rab"
  | "update:rab"
  | "approve:rab"
  | "view:settings"
  | "manage:budget_settings"
  | "manage:expense_categories"
  | "manage:item_library"
  | "manage:material_settings"
  | "manage:users"
  | "manage:vendors"
  | "create:opening_inventory"
  | "approve:opening_inventory"
  | "reverse:opening_inventory";

// 2. Matriks Otorisasi Berdasarkan Peran (Role Permission Matrix)
export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  OWNER: [
    "view:bank_account",
    "create:bank_account",
    "update:bank_account",
    "delete:bank_account",
    "view:ledger",
    "create:ledger",
    "reconcile:ledger",
    "view:budget",
    "create:budget",
    "update:budget",
    "approve:budget",
    "view:cost",
    "create:cost",
    "update:cost",
    "approve:cost",
    "pay:cost",
    "view:vendor_bill",
    "create:vendor_bill",
    "update:vendor_bill",
    "pay:vendor_bill",
    "view:client_invoice",
    "create:client_invoice",
    "update:client_invoice",
    "reconcile:client_invoice",
    "view:profitability",
    "view:ai_brief",
    "view:material",
    "create:material",
    "update:material",
    "view:inventory",
    "create:stock_movement",
    "reserve:stock",
    "use:stock",
    "adjust:stock",
    "waste:stock",
    "transfer:stock",
    "create:stock_count",
    "approve:stock_count",
    "request:goods_receipt_reversal",
    "approve:goods_receipt_reversal",
    "view:rap",
    "create:rap",
    "update:rap",
    "lock:rap",
    "view:rab",
    "create:rab",
    "update:rab",
    "approve:rab",
    "view:settings",
    "manage:budget_settings",
    "manage:expense_categories",
    "manage:item_library",
    "manage:material_settings",
    "manage:users",
    "manage:vendors",
    "create:opening_inventory",
    "approve:opening_inventory",
    "reverse:opening_inventory",
  ],
  FINANCE_ADMIN: [
    "view:bank_account",
    "update:bank_account", // No Create or Delete for bank accounts
    "view:ledger",
    "create:ledger",
    "reconcile:ledger",
    "view:budget",
    "create:budget",
    "update:budget",
    "approve:budget",
    "view:cost",
    "update:cost",
    "pay:cost",
    "view:vendor_bill",
    "create:vendor_bill",
    "update:vendor_bill",
    "pay:vendor_bill",
    "view:client_invoice",
    "create:client_invoice",
    "update:client_invoice",
    "reconcile:client_invoice",
    "view:profitability",
    "view:material",
    "create:material",
    "update:material",
    "view:inventory",
    "create:stock_movement",
    "reserve:stock",
    "use:stock",
    "approve:stock_count",
    "approve:goods_receipt_reversal",
    "view:rap",
    "create:rap",
    "update:rap",
    "lock:rap",
    "view:rab",
    "create:rab",
    "update:rab",
    "approve:rab",
    "view:settings",
    "manage:budget_settings",
    "manage:expense_categories",
    "manage:item_library",
    "manage:material_settings",
    "manage:vendors",
    "create:opening_inventory",
    "approve:opening_inventory",
  ],
  PROJECT_MANAGER: [
    "view:budget",
    "create:budget",
    "update:budget",
    "view:cost",
    "create:cost",
    "update:cost",
    "view:vendor_bill",
    "create:vendor_bill",
    "view:client_invoice",
    "view:material",
    "view:inventory",
    "view:rap",
    "create:rap",
    "update:rap",
    "view:rab",
  ],
  PURCHASING: [
    "view:budget",
    "view:vendor_bill",
    "create:vendor_bill",
    "update:vendor_bill",
    "view:material",
    "create:material",
    "update:material",
    "view:inventory",
    "create:stock_movement",
    "reserve:stock",
    "use:stock",
    "waste:stock",
    "transfer:stock",
    "create:stock_count",
    "request:goods_receipt_reversal",
    "view:rap",
    "update:rap",
    "view:settings",
    "manage:material_settings",
    "create:opening_inventory",
  ],
  SALES: ["view:budget", "view:client_invoice", "create:client_invoice", "update:client_invoice"],
  DESIGNER: ["view:budget", "view:rap", "view:rab"],
  MARKETING: [],
};

// 3. Pemetaan Cepat UUID Peran ke Nama Peran (Static Mapping)
export const ROLE_ID_TO_NAME: Record<string, string> = {
  "00000000-0000-0000-0000-000000000001": "OWNER",
  "00000000-0000-0000-0000-000000000002": "FINANCE_ADMIN",
  "00000000-0000-0000-0000-000000000003": "PROJECT_MANAGER",
  "00000000-0000-0000-0000-000000000004": "PURCHASING",
  "00000000-0000-0000-0000-000000000005": "SALES",
  "00000000-0000-0000-0000-000000000006": "DESIGNER",
  "00000000-0000-0000-0000-000000000007": "MARKETING",
};

/**
 * Menyelesaikan UUID role menjadi nama peran (string uppercase).
 * Menggunakan pencocokan statis terlebih dahulu sebelum melakukan fallback ke database.
 *
 * @param roleId UUID peran dari database/session
 * @returns Nama peran dalam format string huruf besar (misal: "PROJECT_MANAGER")
 */
export async function resolveRoleName(roleId: string): Promise<string> {
  const staticName = ROLE_ID_TO_NAME[roleId];
  if (staticName) {
    return staticName;
  }

  try {
    const dbRole = await db.query.role.findFirst({
      where: eq(role.id, roleId),
    });
    return dbRole?.name ? dbRole.name.toUpperCase() : "UNKNOWN";
  } catch (error) {
    console.error("Gagal mendeteksi nama peran dari database:", error);
    return "UNKNOWN";
  }
}

interface UserSessionAuth {
  id: string;
  roleId?: string;
  role?: string;
}

/**
 * Memverifikasi apakah pengguna memiliki izin yang diperlukan untuk melakukan aksi tertentu.
 * Jika tidak memiliki izin, fungsi ini akan melempar kesalahan (error) "FORBIDDEN".
 *
 * @param user Objek user dari sesi (minimal harus memiliki id dan salah satu dari roleId atau role)
 * @param permission Kunci izin finansial yang ingin diverifikasi
 */
export async function assertPermission(
  user: UserSessionAuth,
  permission: PermissionKey,
): Promise<void> {
  let roleName = user.role?.toUpperCase();

  if (!roleName && user.roleId) {
    roleName = await resolveRoleName(user.roleId);
  }

  if (!roleName) {
    throw new Error("FORBIDDEN: Pengguna tidak memiliki peran yang valid.");
  }

  const permissions = ROLE_PERMISSIONS[roleName] || [];
  if (!permissions.includes(permission)) {
    throw new Error(`FORBIDDEN: Peran ${roleName} tidak memiliki izin ${permission}`);
  }
}
