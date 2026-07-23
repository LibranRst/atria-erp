import type { SelectOption } from "@/components/ui";
import type { CashMovementCategory, TextTone } from "@/features/finance-dashboard/types/bank-account-types";

export const CARD_PRESETS: readonly {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly text: TextTone;
}[] = [
  { name: "BCA Night", from: "#0F2B5C", to: "#1E40AF", text: "light" },
  { name: "Cash Mint", from: "#0B4F43", to: "#0D9488", text: "light" },
  { name: "Graphite", from: "#1C2025", to: "#4B5563", text: "light" },
  { name: "Champagne", from: "#F5D7A1", to: "#E8A95B", text: "dark" },
  { name: "Studio Rose", from: "#7F1D1D", to: "#E11D48", text: "light" },
  { name: "Cloud", from: "#E0F2FE", to: "#BAE6FD", text: "dark" },
];

export const movementCategoryOptions: readonly (SelectOption & {
  readonly value: CashMovementCategory;
})[] = [
  {
    value: "owner_capital",
    label: "Modal owner",
    description: "Tambahan kas dari owner.",
  },
  {
    value: "bank_fee",
    label: "Biaya bank",
    description: "Admin bank atau biaya layanan.",
  },
  {
    value: "correction",
    label: "Koreksi saldo",
    description: "Penyesuaian hasil review finance.",
  },
  {
    value: "cash_adjustment",
    label: "Adjustment kas",
    description: "Mutasi operasional non-project.",
  },
  {
    value: "other",
    label: "Lainnya",
    description: "Gunakan catatan yang jelas.",
  },
];
