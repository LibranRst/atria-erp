import { eq, inArray } from "drizzle-orm";

import { db } from "@backend/db";
import { appConfig, inventoryOpeningBatch } from "@backend/db/schema";
import {
  OWNER_ONBOARDING_V2_CONFIG_KEY,
  parseOwnerQuickStartState,
} from "@atria/core/onboarding/organization-setup";
import {
  OWNER_ONBOARDING_CONFIG_KEY,
  parseOwnerOnboardingState,
} from "@atria/core/onboarding/owner-onboarding";

/** Operational stock mutations stay locked until the opening position is final. */
export async function assertOperationalStockReadiness(
  reader: Pick<typeof db, "query"> = db,
): Promise<void> {
  const [configRows, postedOpening, existingMovement, existingProject] = await Promise.all([
    reader.query.appConfig.findMany({
      where: inArray(appConfig.key, [OWNER_ONBOARDING_V2_CONFIG_KEY, OWNER_ONBOARDING_CONFIG_KEY]),
      columns: { key: true, value: true },
    }),
    reader.query.inventoryOpeningBatch.findFirst({
      where: eq(inventoryOpeningBatch.status, "POSTED"),
      columns: { id: true },
    }),
    reader.query.stockMovement.findFirst({ columns: { id: true } }),
    reader.query.project.findFirst({ columns: { id: true } }),
  ]);
  if (postedOpening) return;

  const v2 = parseOwnerQuickStartState(
    configRows.find((row) => row.key === OWNER_ONBOARDING_V2_CONFIG_KEY)?.value,
  );
  const legacy = parseOwnerOnboardingState(
    configRows.find((row) => row.key === OWNER_ONBOARDING_CONFIG_KEY)?.value,
  );
  if (v2?.initialStockDecision === "NO_LEGACY_STOCK") return;
  if (!v2 && legacy?.initialStockDecision === "NO_LEGACY_STOCK") return;
  // Existing installations with operational history are never retroactively gated.
  if (!v2 && !legacy && (existingMovement || existingProject)) return;

  throw new Error(
    "SETUP_REQUIRED: Finalkan keputusan saldo awal stok di Pengaturan > Kesiapan sebelum mencatat pergerakan stok operasional.",
  );
}
