export const PROJECT_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft", description: "Belum aktif untuk eksekusi." },
  { value: "ACTIVE", label: "Aktif", description: "Proyek sedang berjalan." },
  { value: "ON_HOLD", label: "Ditahan", description: "Operasional dihentikan sementara." },
  {
    value: "COMPLETED",
    label: "Selesai",
    description: "Hanya melalui checklist penutupan proyek.",
  },
  { value: "CANCELLED", label: "Dibatalkan", description: "Proyek tidak dilanjutkan." },
] as const;

export const FINANCIAL_HEALTH_OPTIONS = [
  { value: "HEALTHY", label: "Sehat", description: "Budget dan margin aman." },
  { value: "WARNING", label: "Perlu Perhatian", description: "Perlu ditinjau Finance." },
  { value: "CRITICAL", label: "Kritis", description: "Risiko budget atau margin tinggi." },
] as const;

export { PROJECT_TYPE_OPTIONS } from "@atria/core/presentation/project-input-options";

export type ProjectStatusOption = (typeof PROJECT_STATUS_OPTIONS)[number]["value"];
export type ProjectFinancialHealthOption = (typeof FINANCIAL_HEALTH_OPTIONS)[number]["value"];
