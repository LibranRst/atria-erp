import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appConfig, auditLog } from "@/db/schema";
import type { Actor } from "@/server/actor";
import { actorHasPermission } from "@atria/core/auth/permissions";
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

const THRESHOLD_DESCRIPTIONS: Record<string, string> = {
  [APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost]:
    "Ambang persetujuan Owner untuk pengeluaran lapangan, dalam sen.",
  [APPROVAL_THRESHOLD_CONFIG_KEYS.vendorPayment]:
    "Ambang persetujuan Owner untuk pembayaran vendor, dalam sen.",
};

/**
 * Ambang dikembalikan sebagai `number` sen, bukan `bigint`.
 *
 * Nilainya lewat batas Server Action menuju formulir, dan `bigint` tidak
 * menyeberang JSON. Batas atas skema (Rp1 triliun) jauh di bawah
 * `Number.MAX_SAFE_INTEGER`, jadi tidak ada presisi yang hilang.
 */
export async function getApprovalThresholdSettingsUseCase(
  actor: Actor,
): Promise<ActionResponse<ApprovalThresholdSettings>> {
  if (!actorHasPermission(actor.roleName, "view:settings")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Peran Anda tidak berhak membuka pengaturan." },
    };
  }

  const rows = await db
    .select({ key: appConfig.key, value: appConfig.value })
    .from(appConfig);
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

  if (!actorHasPermission(actor.roleName, "manage:approval_settings")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Peran Anda tidak berhak mengubah ambang persetujuan." },
    };
  }

  const current = await getApprovalThresholdSettingsUseCase(actor);
  if (!current.success) return current;

  const next = validation.data;
  if (
    current.data.fieldCostCents === next.fieldCostCents &&
    current.data.vendorPaymentCents === next.vendorPaymentCents
  ) {
    return { success: true, data: { updated: false } };
  }

  await db.transaction(async (tx) => {
    for (const [key, value] of [
      [APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost, next.fieldCostCents],
      [APPROVAL_THRESHOLD_CONFIG_KEYS.vendorPayment, next.vendorPaymentCents],
    ] as const) {
      const existing = await tx.query.appConfig.findFirst({ where: eq(appConfig.key, key) });
      if (existing) {
        await tx
          .update(appConfig)
          .set({ value: String(value), updatedAt: new Date(), updatedById: actor.userId })
          .where(eq(appConfig.id, existing.id));
        continue;
      }
      await tx.insert(appConfig).values({
        key,
        value: String(value),
        description: THRESHOLD_DESCRIPTIONS[key],
        updatedById: actor.userId,
      });
    }

    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "UPDATE_APPROVAL_THRESHOLDS",
      targetTable: "app_config",
      targetId: actor.userId,
      originalState: JSON.stringify(current.data),
      newState: JSON.stringify(next),
    });
  });

  return { success: true, data: { updated: true } };
}
