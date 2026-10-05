import { eq } from "drizzle-orm";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { db } from "@backend/db";
import { auditLog, vendor } from "@backend/db/schema";
import { assertPermission } from "@backend/lib/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  setVendorActiveSchema,
  vendorAdministrationSchema,
  type VendorAdministrationInput,
} from "@atria/core/validations/administration";
import {
  cleanAdministrationValue as clean,
  getAdministrationActor as currentUser,
} from "./administration-action-utils";
export async function saveVendor(
  input: VendorAdministrationInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = vendorAdministrationSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Vendor tidak valid.",
      },
    };
  const actor = await currentUser();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  await assertPermission(actor, "manage:vendors");
  const values = {
    name: validation.data.name,
    email: clean(validation.data.email),
    phone: validation.data.phone,
    address: clean(validation.data.address),
    bankName: clean(validation.data.bankName),
    bankAccountNumber: clean(validation.data.bankAccountNumber),
    bankAccountHolder: clean(validation.data.bankAccountHolder),
    isActive: validation.data.isActive,
    updatedAt: new Date(),
  };
  try {
    const result = await db.transaction(async (tx) => {
      if (validation.data.vendorId) {
        const existing = await tx.query.vendor.findFirst({
          where: eq(vendor.id, validation.data.vendorId),
        });
        if (!existing) throw new Error("VENDOR_NOT_FOUND");
        const [updated] = await tx
          .update(vendor)
          .set(values)
          .where(eq(vendor.id, existing.id))
          .returning();
        await tx.insert(auditLog).values({
          userId: actor.id,
          action: "UPDATE_VENDOR",
          targetTable: "vendor",
          targetId: updated.id,
          originalState: JSON.stringify(existing),
          newState: JSON.stringify(updated),
        });
        return updated;
      }
      const [created] = await tx.insert(vendor).values(values).returning();
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "CREATE_VENDOR",
        targetTable: "vendor",
        targetId: created.id,
        newState: JSON.stringify(created),
      });
      return created;
    });
    revalidatePath("/settings");
    return { success: true, data: { id: result.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan vendor.";
    return {
      success: false,
      error: {
        code:
          message === "VENDOR_NOT_FOUND"
            ? "NOT_FOUND"
            : message.includes("unique")
              ? "CONFLICT"
              : "INTERNAL_SERVER_ERROR",
        message:
          message === "VENDOR_NOT_FOUND"
            ? "Vendor tidak ditemukan."
            : message.includes("unique")
              ? "Email vendor sudah digunakan."
              : message,
      },
    };
  }
}

export async function setVendorActive(
  input: unknown,
): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = setVendorActiveSchema.safeParse(input);
  if (!validation.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Vendor tidak valid." } };
  const existing = await db.query.vendor.findFirst({
    where: eq(vendor.id, validation.data.vendorId),
  });
  if (!existing)
    return { success: false, error: { code: "NOT_FOUND", message: "Vendor tidak ditemukan." } };
  return saveVendor({ ...existing, vendorId: existing.id, isActive: validation.data.isActive });
}
