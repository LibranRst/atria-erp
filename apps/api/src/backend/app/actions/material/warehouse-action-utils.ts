import { cookies } from "@runtime/request-context";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { auth } from "@backend/lib/auth";
import type { ActionResponse } from "@atria/core/types/action-response";

export type WarehouseUser = { readonly id: string; readonly roleId?: string };

export async function getWarehouseUser(): Promise<WarehouseUser | null> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  return session?.user ? (session.user as WarehouseUser) : null;
}

export function warehouseFailure<T>(error: unknown, fallback: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallback;
  if (message.startsWith("SETUP_REQUIRED:")) {
    return {
      success: false,
      error: { code: "CONFLICT", message: message.replace("SETUP_REQUIRED: ", "") },
    };
  }
  return {
    success: false,
    error: {
      code: message.includes("FORBIDDEN") ? "FORBIDDEN" : "TRANSACTION_FAILED",
      message,
    },
  };
}

export function refreshWarehouse(): void {
  revalidatePath("/materials");
}
