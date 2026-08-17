import type { OnboardingStepId, OnboardingStepStatus } from "@/lib/onboarding/owner-onboarding";
import type { StatusBadgeTone } from "@/components/ui";
export type OnboardingStepCopy = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
};

export const ONBOARDING_STEP_COPY: Record<OnboardingStepId, OnboardingStepCopy> = {
  welcome: {
    eyebrow: "Setup organisasi",
    title: "Mulai dari fondasi yang jelas",
    description: "Siapkan default, orang, kas, dan master data tanpa membuat transaksi proyek.",
  },
  financial_defaults: {
    eyebrow: "Langkah 1",
    title: "Review default finansial",
    description: "Tinjau formula budget dan lima kategori biaya utama langsung dari halaman ini.",
  },
  team_vendors: {
    eyebrow: "Langkah 2",
    title: "Siapkan tim dan vendor",
    description:
      "Tambahkan Finance, Project Manager, Purchasing, dan vendor tanpa meninggalkan onboarding.",
  },
  bank_accounts: {
    eyebrow: "Langkah 3",
    title: "Tambahkan rekening perusahaan",
    description:
      "Hanya identitas rekening dan saldo awal tersedia di setup. Operasi kas tetap berada di Ledger.",
  },
  material_foundation: {
    eyebrow: "Langkah 4",
    title: "Siapkan lokasi dan Material Master",
    description: "Lokasi dibuat lebih dahulu. Material baru mendapat inventory bersaldo nol.",
  },
  item_library: {
    eyebrow: "Langkah 5 · Opsional",
    title: "Siapkan Library Item & Harga",
    description: "Buat template berulang untuk RAP dan RAB, atau lewati untuk dilengkapi nanti.",
  },
  initial_stock: {
    eyebrow: "Langkah 6",
    title: "Tentukan saldo awal stok",
    description: "Pilih keputusan yang sesuai dan catat stok fisik lama bila memang ada.",
  },
  summary: {
    eyebrow: "Ringkasan",
    title: "Periksa kesiapan operasional",
    description: "Buka kembali langkah yang belum lengkap sebelum mulai menjalankan proyek.",
  },
};

export const ONBOARDING_STATUS_LABEL: Record<OnboardingStepStatus, string> = {
  READY: "Siap",
  INCOMPLETE: "Belum lengkap",
  SKIPPED: "Dilanjutkan nanti",
  REVIEWED: "Sudah ditinjau",
  PENDING_APPROVAL: "Menunggu approval",
  NOT_APPLICABLE: "Tidak ada stok lama",
};

export const onboardingStatusBadgeTone: Record<OnboardingStepStatus, StatusBadgeTone> = {
  READY: "healthy",
  INCOMPLETE: "warning",
  PENDING_APPROVAL: "pending",
  NOT_APPLICABLE: "inactive",
  SKIPPED: "inactive",
  REVIEWED: "completed",
};

export function onboardingStatusClass(status: OnboardingStepStatus): string {
  if (status === "READY" || status === "NOT_APPLICABLE") {
    return "bg-success-container text-success";
  }
  if (status === "PENDING_APPROVAL") return "bg-accent-container text-accent";
  if (status === "SKIPPED" || status === "INCOMPLETE") {
    return "bg-warning-container text-warning";
  }
  return "bg-surface-container-low text-on-surface-variant";
}
