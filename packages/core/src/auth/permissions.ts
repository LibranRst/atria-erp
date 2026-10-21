/**
 * Matriks perizinan murni — tanpa akses database.
 *
 * Bagian ini dipakai oleh Server Action, Client Component, dan nanti klien
 * native, jadi tidak boleh menarik Drizzle atau koneksi Neon ke dalam graf
 * impor. Resolusi role lewat database dan `assertPermission` yang melempar
 * error hidup di `apps/web/lib/auth/permissions.ts`.
 */

// 1. Kunci Izin Finansial (Permission Keys)
export type PermissionKey =
  | "use:desktop_admin"
  | "view:bank_account"
  | "create:bank_account"
  | "update:bank_account"
  | "delete:bank_account"
  | "view:ledger"
  | "create:ledger"
  | "reconcile:ledger"
  | "view:project"
  | "create:project"
  | "activate:project"
  | "close:project"
  | "view:budget"
  | "create:budget"
  | "update:budget"
  | "approve:budget"
  | "view:cost"
  | "create:cost"
  | "update:cost"
  | "verify:cost"
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
  | "view:approval_queue"
  | "decide:all_approvals"
  | "override:self_approval"
  | "view:profitability"
  | "view:ai_brief"
  | "use:ai_chat"
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
  | "manage:onboarding"
  | "review:onboarding"
  | "view:settings"
  | "manage:approval_settings"
  | "manage:budget_settings"
  | "manage:expense_categories"
  | "manage:item_library"
  | "manage:material_settings"
  | "manage:users"
  | "manage:roles"
  | "manage:vendors"
  | "create:opening_inventory"
  | "approve:opening_inventory"
  | "reverse:opening_inventory";

// 2. Matriks Otorisasi Berdasarkan Peran (Role Permission Matrix)
export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  OWNER: [
    "use:desktop_admin",
    "manage:roles",
    "manage:approval_settings",
    "manage:onboarding",
    "view:project",
    "create:project",
    "activate:project",
    "close:project",
    "verify:cost",
    "view:approval_queue",
    "decide:all_approvals",
    "override:self_approval",
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
    "use:ai_chat",
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
    "use:desktop_admin",
    "review:onboarding",
    "view:project",
    "create:project",
    "activate:project",
    "close:project",
    "verify:cost",
    "view:approval_queue",
    "use:ai_chat",
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
    "view:project",
    "use:ai_chat",
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
    "use:ai_chat",
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
};

/**
 * Cakupan data proyek per peran.
 *
 * `GLOBAL` melihat seluruh proyek; `ASSIGNED` hanya proyek yang ditugaskan
 * kepadanya. Aturan ini sebelumnya ditulis dua kali — sekali untuk kueri
 * halaman (`lib/auth/scoping.ts`) dan sekali lagi untuk tool AI
 * (`lib/ai/tools/context.ts`) — sehingga batas AI bisa menyimpang dari batas
 * halaman tanpa ada yang menyadarinya. Sekarang keduanya membaca dari sini.
 *
 * Pada fase peran dinamis, nilai ini pindah menjadi kolom `role.data_scope`;
 * tabel di bawah menjadi seed-nya, sama seperti `ROLE_PERMISSIONS`.
 */
export type RoleDataScope = "GLOBAL" | "ASSIGNED" | "NONE";

const ROLE_DATA_SCOPE: Record<string, RoleDataScope> = {
  OWNER: "GLOBAL",
  FINANCE_ADMIN: "GLOBAL",
  PROJECT_MANAGER: "ASSIGNED",
  /*
   * `NONE`, bukan `GLOBAL`, dan itu memang perilaku hari ini: Purchasing tidak
   * pernah lolos `scopeProjectQuery`. Yang membuatnya seolah punya akses global
   * adalah domain material — di sana pemeriksaan akses proyek DILEWATI untuk
   * peran yang memindahkan stok, karena gudang memang bukan milik satu proyek.
   * Itu properti pekerjaannya, bukan properti cakupan datanya, jadi ia
   * dinyatakan sebagai izin (`create:stock_movement`) di call site material.
   */
  PURCHASING: "NONE",
};

/**
 * Peran tak dikenal mendapat `NONE`: gagal ke arah tertutup, bukan terbuka.
 */
export function getRoleDataScope(roleName: string | null | undefined): RoleDataScope {
  if (!roleName) return "NONE";
  return ROLE_DATA_SCOPE[roleName.toUpperCase()] ?? "NONE";
}

export function hasGlobalDataScope(roleName: string | null | undefined): boolean {
  return getRoleDataScope(roleName) === "GLOBAL";
}

// 3. Pemetaan Cepat UUID Peran ke Nama Peran (Static Mapping)
export const ROLE_ID_TO_NAME: Record<string, string> = {
  "00000000-0000-0000-0000-000000000001": "OWNER",
  "00000000-0000-0000-0000-000000000002": "FINANCE_ADMIN",
  "00000000-0000-0000-0000-000000000003": "PROJECT_MANAGER",
  "00000000-0000-0000-0000-000000000004": "PURCHASING",
};

/**
 * Mencocokkan UUID peran ke nama peran lewat tabel statis saja.
 *
 * Mengembalikan `undefined` bila UUID tidak dikenal — pemanggil di sisi server
 * yang perlu fallback ke database memakai `resolveRoleName` di
 * `apps/web/lib/auth/permissions.ts`.
 */
export function resolveStaticRoleName(roleId: string): string | undefined {
  return ROLE_ID_TO_NAME[roleId];
}

/**
 * Memeriksa apakah sebuah peran memiliki izin tertentu. Murni dan sinkron,
 * sehingga aman dipakai di Client Component maupun klien native.
 */
export function actorHasPermission(
  roleName: string | null | undefined,
  permission: PermissionKey,
): boolean {
  if (!roleName) return false;
  return (ROLE_PERMISSIONS[roleName] ?? []).includes(permission);
}
