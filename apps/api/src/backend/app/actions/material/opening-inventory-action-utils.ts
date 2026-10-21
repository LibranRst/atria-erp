import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import type { ActionResponse } from "@atria/core/types/action-response";

export function refreshOpeningInventory(includeOwnerOnboarding = true): void {
  revalidatePath("/materials");
  revalidatePath("/settings");
  revalidatePath("/approvals");
  if (includeOwnerOnboarding) revalidatePath("/onboarding");
  revalidatePath("/onboarding/review");
}

export function openingInventoryFailure<T>(error: unknown, fallback: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallback;
  if (message.startsWith("FORBIDDEN:"))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: message.replace("FORBIDDEN: ", "") },
    };
  if (message === "OPENING_NOT_FOUND")
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Batch saldo awal stok tidak ditemukan.",
      },
    };
  if (message === "MAKER_CHECKER_REQUIRED")
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message:
          "Pembuat pengajuan tidak boleh menyetujui sendiri. Gunakan Finance Admin sebagai pemeriksa terpisah.",
      },
    };
  if (message === "INVENTORY_ALREADY_ACTIVE")
    return {
      success: false,
      error: {
        code: "CONFLICT",
        message:
          "Saldo awal hanya dapat diposting sebelum inventory memiliki saldo atau pergerakan stok.",
      },
    };
  if (message === "OPENING_ALREADY_PENDING")
    return {
      success: false,
      error: {
        code: "CONFLICT",
        message: "Inventory sudah ada dalam pengajuan saldo awal yang menunggu persetujuan.",
      },
    };
  if (message === "REVERSAL_HAS_LATER_MOVEMENT")
    return {
      success: false,
      error: {
        code: "CONFLICT",
        message: "Saldo awal tidak dapat dibalik setelah ada pergerakan stok berikutnya.",
      },
    };
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}
