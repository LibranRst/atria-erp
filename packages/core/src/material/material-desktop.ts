import { z } from "zod";

// PostgreSQL accepts historical IDs without RFC version/variant bits.
const databaseIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const materialDesktopActivityInputSchema = z.object({
  kind: z.enum(["movements", "receipts", "transfers", "counts"]),
  search: z.string().trim().max(120).default(""),
  projectId: databaseIdSchema.optional(),
  locationId: databaseIdSchema.optional(),
  period: z.enum(["all", "7", "30"]).default("all"),
  status: z.string().trim().max(60).default("all"),
  sort: z.enum(["date", "name", "quantity", "value", "status"]).default("date"),
  direction: z.enum(["ascending", "descending"]).default("descending"),
  page: z.number().int().min(1).default(1),
  pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(10),
});
export type MaterialDesktopActivityRequest = z.input<typeof materialDesktopActivityInputSchema>;
export type MaterialDesktopActivityInput = z.output<typeof materialDesktopActivityInputSchema>;

export type MaterialDesktopMovementRow = {
  readonly id: string;
  readonly movementType: string;
  readonly movementDirection: string;
  readonly quantity: number;
  readonly unitCost: number;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly materialId: string;
  readonly materialName: string;
  readonly unit: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly createdByName: string;
};
export type MaterialDesktopReceiptRow = {
  readonly id: string;
  readonly receiptNumber: string;
  readonly status: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly vendorBillNumber: string | null;
  readonly receivedAt: Date;
  readonly receivedByName: string;
  readonly reversalReason: string | null;
  readonly total: number;
  readonly items: readonly {
    readonly materialName: string;
    readonly quantity: number;
    readonly unitCost: number;
    readonly unit?: string;
  }[];
};
export type MaterialDesktopCountRow = {
  readonly id: string;
  readonly countNumber: string;
  readonly status: string;
  readonly canEdit: boolean;
  readonly locationId: string;
  readonly locationName: string;
  readonly countedAt: Date;
  readonly createdByName: string;
  readonly note: string | null;
  readonly items: readonly {
    readonly materialId: string;
    readonly materialName: string;
    readonly systemQuantity: number;
    readonly countedQuantity: number;
    readonly varianceQuantity: number;
    readonly unit?: string;
  }[];
};
export type MaterialDesktopTransferRow = {
  readonly id: string;
  readonly transferNumber: string;
  readonly fromLocationName: string;
  readonly toLocationName: string;
  readonly transferredAt: Date;
  readonly note: string;
  readonly items: readonly {
    readonly materialName: string;
    readonly quantity: number;
    readonly unitCost: number;
    readonly unit?: string;
  }[];
};
type MaterialDesktopPage<Row> = {
  readonly rows: readonly Row[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: 10 | 25 | 50;
  readonly updatedAt: Date;
};
export type MaterialDesktopActivityData =
  | (MaterialDesktopPage<MaterialDesktopMovementRow> & { readonly kind: "movements" })
  | (MaterialDesktopPage<MaterialDesktopReceiptRow> & { readonly kind: "receipts" })
  | (MaterialDesktopPage<MaterialDesktopTransferRow> & { readonly kind: "transfers" })
  | (MaterialDesktopPage<MaterialDesktopCountRow> & { readonly kind: "counts" });
