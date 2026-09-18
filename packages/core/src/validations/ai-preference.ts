import { z } from "zod";
import type { PermissionKey } from "../auth/permissions";

export const aiResponseStyleSchema = z.enum(["STANDARD", "VERY_CONCISE", "DETAILED"]);
export const aiPrimaryFocusSchema = z.enum([
  "AUTO",
  "BUDGET_MARGIN",
  "CASH_BILLS",
  "MATERIAL_STOCK",
  "ACTIONS_APPROVALS",
]);

export const aiPreferenceInputSchema = z.object({
  responseStyle: aiResponseStyleSchema,
  primaryFocus: aiPrimaryFocusSchema,
  customNote: z
    .string()
    .trim()
    .max(300, "Catatan preferensi maksimal 300 karakter.")
    .nullish()
    .transform((value) => value || null),
});

export type AiResponseStyle = z.infer<typeof aiResponseStyleSchema>;
export type AiPrimaryFocus = z.infer<typeof aiPrimaryFocusSchema>;
export type AiPreferenceInput = z.infer<typeof aiPreferenceInputSchema>;

export const DEFAULT_AI_PREFERENCE: AiPreferenceInput = {
  responseStyle: "STANDARD",
  primaryFocus: "AUTO",
  customNote: null,
};

export type PrimaryFocusOption = {
  readonly value: AiPrimaryFocus;
  readonly label: string;
  readonly description: string;
  readonly permissions: readonly PermissionKey[];
};

export const AI_PRIMARY_FOCUS_CONFIG: Record<AiPrimaryFocus, PrimaryFocusOption> = {
  AUTO: {
    value: "AUTO",
    label: "Otomatis",
    description: "Deteksi otomatis sesuai konteks pertanyaan dan risiko",
    permissions: [],
  },
  BUDGET_MARGIN: {
    value: "BUDGET_MARGIN",
    label: "Budget & margin",
    description: "Sorot alokasi anggaran, deviasi biaya, dan margin proyek",
    permissions: ["view:profitability"],
  },
  CASH_BILLS: {
    value: "CASH_BILLS",
    label: "Kas & tagihan",
    description: "Pantau saldo kas bank, pencairan, dan jatuh tempo vendor",
    permissions: ["view:bank_account", "view:ledger"],
  },
  MATERIAL_STOCK: {
    value: "MATERIAL_STOCK",
    label: "Material & stok",
    description: "Pantau kekurangan material RAP, ketersediaan stok, dan penerimaan",
    permissions: ["view:material", "view:inventory", "view:rap"],
  },
  ACTIONS_APPROVALS: {
    value: "ACTIONS_APPROVALS",
    label: "Tindakan & approval",
    description: "Sorot antrean persetujuan biaya dan blocker operasional",
    permissions: ["view:approval_queue", "decide:all_approvals"],
  },
};

export const AI_PRIMARY_FOCUS_OPTIONS: readonly PrimaryFocusOption[] = [
  AI_PRIMARY_FOCUS_CONFIG.AUTO,
  AI_PRIMARY_FOCUS_CONFIG.BUDGET_MARGIN,
  AI_PRIMARY_FOCUS_CONFIG.CASH_BILLS,
  AI_PRIMARY_FOCUS_CONFIG.MATERIAL_STOCK,
  AI_PRIMARY_FOCUS_CONFIG.ACTIONS_APPROVALS,
];

export function isPrimaryFocusAllowed(
  focus: AiPrimaryFocus,
  can: (p: PermissionKey) => boolean,
): boolean {
  const config = AI_PRIMARY_FOCUS_CONFIG[focus];
  if (!config) return false;
  if (config.permissions.length === 0) return true;
  return config.permissions.some(can);
}

export function getAvailableFocusOptions(
  can: (p: PermissionKey) => boolean,
): readonly PrimaryFocusOption[] {
  return AI_PRIMARY_FOCUS_OPTIONS.filter((opt) => isPrimaryFocusAllowed(opt.value, can));
}

export function sanitizePrimaryFocus(
  focus: AiPrimaryFocus,
  can: (p: PermissionKey) => boolean,
): AiPrimaryFocus {
  return isPrimaryFocusAllowed(focus, can) ? focus : "AUTO";
}
