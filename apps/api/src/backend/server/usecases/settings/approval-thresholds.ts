import { actorCan } from "@backend/lib/auth/permissions";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@backend/db";
import { appConfig, INSTANCE_TENANT_ID } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { OperationalSettingsError, writeApprovalThresholdsTx } from "./operational-settings-writer";

import {
  APPROVAL_THRESHOLD_CONFIG_KEYS,
  DEFAULT_APPROVAL_THRESHOLDS,
  parseThresholdCents,
} from "@atria/core/finance/approval-thresholds";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  updateApprovalThresholdsSchema,
  type UpdateApprovalThresholdsInput,
} from "@atria/core/validations/settings";

export type ApprovalThresholdSettings = {
  readonly fieldCostCents: number;
  readonly vendorPaymentCents: number;
};

/**
 * Ambang dikembalikan sebagai `number` sen, bukan `bigint`.
 *
 * Nilainya lewat batas Server Action menuju formulir, dan `bigint` tidak
 * menyeberang JSON. Batas atas skema (Rp1 miliar) jauh di bawah
 * `Number.MAX_SAFE_INTEGER`, jadi tidak ada presisi yang hilang.
 */
export async function getApprovalThresholdSettingsUseCase(
  actor: Actor,
): Promise<ActionResponse<ApprovalThresholdSettings>> {
  if (!actorCan(actor, "view:settings")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Peran Anda tidak berhak membuka pengaturan." },
    };
  }

  const rows = await db
    .select({ key: appConfig.key, value: appConfig.value })
    .from(appConfig)
    .where(
      and(
        eq(appConfig.tenantId, INSTANCE_TENANT_ID),
        inArray(appConfig.key, Object.values(APPROVAL_THRESHOLD_CONFIG_KEYS)),
      ),
    );
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const fieldCost =
    parseThresholdCents(byKey.get(APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost)) ??
    DEFAULT_APPROVAL_THRESHOLDS.fieldCostCents;
  const vendorPayment =
    parseThresholdCents(byKey.get(APPROVAL_THRESHOLD_CONFIG_KEYS.vendorPayment)) ??
    DEFAULT_APPROVAL_THRESHOLDS.vendorPaymentCents;

  return {
    success: true,
    data: { fieldCostCents: Number(fieldCost), vendorPaymentCents: Number(vendorPayment) },
  };
}

/**
 * Menyimpan ambang persetujuan.
 *
 * Perubahan **tidak** menyentuh pengajuan yang sudah berjalan: keputusannya
 * sudah dibekukan ke kolom `requires_owner_approval` saat pengajuan dibuat.
 * Yang berubah hanya penilaian pengajuan berikutnya.
 */
export async function updateApprovalThresholdsUseCase(
  actor: Actor,
  input: UpdateApprovalThresholdsInput,
): Promise<ActionResponse<{ readonly updated: boolean }>> {
  const validation = updateApprovalThresholdsSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Ambang tidak valid.",
      },
    };

  if (!actorCan(actor, "manage:approval_settings")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Peran Anda tidak berhak mengubah ambang persetujuan." },
    };
  }

  try {
    const result = await db.transaction((tx) =>
      writeApprovalThresholdsTx(tx, actor, {
        fieldCostAmount: validation.data.fieldCostCents / 100,
        vendorPaymentAmount: validation.data.vendorPaymentCents / 100,
      }),
    );
    return { success: true, data: { updated: result.updated } };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: error instanceof OperationalSettingsError ? error.code : "TRANSACTION_FAILED",
        message:
          error instanceof OperationalSettingsError
            ? error.message
            : "Ambang belum tersimpan. Periksa pengaturan lalu coba lagi.",
      },
    };
  }
}
