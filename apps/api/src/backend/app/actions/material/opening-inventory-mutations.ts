import { db } from "@backend/db";
import { resolveActor } from "@backend/server/actor";
import {
  createInventoryOpeningTx,
  decideInventoryOpeningTx,
  reverseInventoryOpeningTx,
} from "@backend/server/usecases/material/opening-inventory-writer";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  createInventoryOpeningSchema,
  decideInventoryOpeningSchema,
  reverseInventoryOpeningSchema,
  type CreateInventoryOpeningInput,
  type DecideInventoryOpeningInput,
  type ReverseInventoryOpeningInput,
} from "@atria/core/validations/material";
import {
  openingInventoryFailure as failure,
  refreshOpeningInventory as refresh,
} from "./opening-inventory-action-utils";
import type { OpeningBatch } from "./opening-inventory-types";

export async function createInventoryOpening(
  input: CreateInventoryOpeningInput,
): Promise<ActionResponse<OpeningBatch>> {
  const validation = createInventoryOpeningSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Saldo awal stok tidak valid.",
      },
    };
  }
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const created = await db.transaction((tx) =>
      createInventoryOpeningTx(tx, actor, validation.data),
    );
    refresh();
    return { success: true, data: created };
  } catch (error) {
    return failure(error, "Gagal mengajukan saldo awal stok.");
  }
}

export async function decideInventoryOpening(
  input: DecideInventoryOpeningInput,
): Promise<ActionResponse<OpeningBatch>> {
  const validation = decideInventoryOpeningSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Keputusan tidak valid.",
      },
    };
  }
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const decided = await db.transaction((tx) =>
      decideInventoryOpeningTx(tx, actor, validation.data),
    );
    refresh(false);
    return { success: true, data: decided };
  } catch (error) {
    return failure(error, "Gagal memutus saldo awal stok.");
  }
}

export async function reverseInventoryOpening(
  input: ReverseInventoryOpeningInput,
): Promise<ActionResponse<OpeningBatch>> {
  const validation = reverseInventoryOpeningSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Reversal tidak valid.",
      },
    };
  }
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const reversed = await db.transaction((tx) =>
      reverseInventoryOpeningTx(tx, actor, validation.data),
    );
    refresh();
    return { success: true, data: reversed };
  } catch (error) {
    return failure(error, "Gagal membalik saldo awal stok.");
  }
}
