import { cache } from "@runtime/react-cache";
import { inArray, and, eq } from "drizzle-orm";

import { db } from "@backend/db";
import { appConfig, INSTANCE_TENANT_ID } from "@backend/db/schema";
import {
  APPROVAL_THRESHOLD_CONFIG_KEYS,
  DEFAULT_APPROVAL_THRESHOLDS,
  parseThresholdCents,
  thresholdCentsToRupiah,
  type ApprovalThresholds,
} from "@atria/core/finance/approval-thresholds";

/**
 * Pembacaan ambang persetujuan dari `app_config`.
 *
 * `cache()` membatasi biayanya pada satu kueri per request, bukan per pemanggil
 * — dan sengaja **tidak** lebih lama dari itu. Ambang yang di-cache lintas
 * request akan basi tepat ketika ketepatannya paling penting: sesaat setelah
 * Owner memperketatnya.
 *
 * Konfigurasi yang hilang atau rusak jatuh ke nilai seed, bukan ke nol.
 * Ambang nol berarti "semua butuh persetujuan Owner" dan itu keputusan yang sah
 * — jadi ia tidak boleh bisa muncul dari sebuah baris yang salah ketik.
 */
export const getApprovalThresholds = cache(async (): Promise<ApprovalThresholds> =>
  readApprovalThresholds(db),
);

export async function readApprovalThresholds(
  reader: Pick<typeof db, "select">,
): Promise<ApprovalThresholds> {
  try {
    const rows = await reader
      .select({ key: appConfig.key, value: appConfig.value })
      .from(appConfig)
      .where(
        and(
          eq(appConfig.tenantId, INSTANCE_TENANT_ID),
          inArray(appConfig.key, [
            APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost,
            APPROVAL_THRESHOLD_CONFIG_KEYS.vendorPayment,
          ]),
        ),
      );

    const byKey = new Map(rows.map((row) => [row.key, row.value]));

    return {
      fieldCostCents:
        parseThresholdCents(byKey.get(APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost)) ??
        DEFAULT_APPROVAL_THRESHOLDS.fieldCostCents,
      vendorPaymentCents:
        parseThresholdCents(byKey.get(APPROVAL_THRESHOLD_CONFIG_KEYS.vendorPayment)) ??
        DEFAULT_APPROVAL_THRESHOLDS.vendorPaymentCents,
    };
  } catch (error) {
    console.error("Gagal membaca ambang persetujuan; memakai nilai bawaan:", error);
    return DEFAULT_APPROVAL_THRESHOLDS;
  }
}

/** Ambang biaya lapangan dalam rupiah — aturannya masih bekerja dalam rupiah. */
export async function getFieldCostApprovalThresholdRupiah(): Promise<number> {
  const thresholds = await getApprovalThresholds();
  return thresholdCentsToRupiah(thresholds.fieldCostCents);
}

export async function getVendorPaymentApprovalThresholdCents(): Promise<bigint> {
  const thresholds = await getApprovalThresholds();
  return thresholds.vendorPaymentCents;
}
