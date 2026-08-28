"use server";

import { revalidatePath } from "next/cache";

import { resolveActor } from "@/server/actor";
import {
  createRoleUseCase,
  deleteRoleUseCase,
  listManagedRolesUseCase,
  updateRoleDetailsUseCase,
  updateRolePermissionsUseCase,
  type ManagedRole,
} from "@/server/usecases/administration/roles";
import type { ActionResponse } from "@atria/core/types/action-response";
import type {
  CreateRoleInput,
  DeleteRoleInput,
  UpdateRoleDetailsInput,
  UpdateRolePermissionsInput,
} from "@atria/core/validations/roles";

/**
 * Pembungkus tipis di atas use-case peran. Identitas selalu diselesaikan di
 * sini dari sesi — modul `"use server"` adalah endpoint HTTP, jadi aktor yang
 * datang sebagai argumen bisa dipalsukan klien.
 */
export async function listManagedRoles(): Promise<ActionResponse<readonly ManagedRole[]>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  return listManagedRolesUseCase(actor);
}

export async function createRole(
  input: CreateRoleInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const result = await createRoleUseCase(actor, input);
  if (result.success) revalidatePath("/settings");
  return result;
}

export async function updateRolePermissions(
  input: UpdateRolePermissionsInput,
): Promise<ActionResponse<{ readonly updated: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const result = await updateRolePermissionsUseCase(actor, input);
  // Izin menyentuh setiap halaman, bukan satu — termasuk milik pengguna lain
  // pada request mereka berikutnya.
  if (result.success && result.data.updated) revalidatePath("/", "layout");
  return result;
}

export async function updateRoleDetails(
  input: UpdateRoleDetailsInput,
): Promise<ActionResponse<{ readonly updated: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const result = await updateRoleDetailsUseCase(actor, input);
  if (result.success && result.data.updated) revalidatePath("/", "layout");
  return result;
}

export async function deleteRole(
  input: DeleteRoleInput,
): Promise<ActionResponse<{ readonly deleted: true }>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const result = await deleteRoleUseCase(actor, input);
  if (result.success) revalidatePath("/settings");
  return result;
}
