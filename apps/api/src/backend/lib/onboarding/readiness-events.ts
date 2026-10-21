import { eq, inArray } from "drizzle-orm";

import { db } from "@backend/db";
import {
  appConfig,
  bankAccount,
  inventoryLocation,
  inventoryOpeningBatch,
  materialMaster,
  onboardingEvent,
  user,
} from "@backend/db/schema";
import { SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import {
  OWNER_ONBOARDING_V2_CONFIG_KEY,
  parseOwnerQuickStartState,
  type OperationalReadinessId,
} from "@atria/core/onboarding/organization-setup";
import {
  OWNER_ONBOARDING_CONFIG_KEY,
  parseOwnerOnboardingState,
} from "@atria/core/onboarding/owner-onboarding";

type ReadinessEventTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type RequiredReadinessId = Exclude<OperationalReadinessId, "vendor" | "item_library">;

async function readinessState(tx: ReadinessEventTx): Promise<{
  readonly coreTeam: boolean;
  readonly bankAccount: boolean;
  readonly materialFoundation: boolean;
  readonly initialStock: boolean;
}> {
  const [users, account, location, material, posted, configs] = await Promise.all([
    tx.query.user.findMany({ where: eq(user.isActive, true), columns: { roleId: true } }),
    tx.query.bankAccount.findFirst({
      where: eq(bankAccount.isActive, true),
      columns: { id: true },
    }),
    tx.query.inventoryLocation.findFirst({
      where: eq(inventoryLocation.isActive, true),
      columns: { id: true },
    }),
    tx.query.materialMaster.findFirst({
      where: eq(materialMaster.isActive, true),
      columns: { id: true },
    }),
    tx.query.inventoryOpeningBatch.findFirst({
      where: eq(inventoryOpeningBatch.status, "POSTED"),
      columns: { id: true },
    }),
    tx.query.appConfig.findMany({
      where: inArray(appConfig.key, [OWNER_ONBOARDING_V2_CONFIG_KEY, OWNER_ONBOARDING_CONFIG_KEY]),
      columns: { key: true, value: true },
    }),
  ]);
  const roleIds = new Set(users.map((row) => row.roleId));
  const v2 = parseOwnerQuickStartState(
    configs.find((row) => row.key === OWNER_ONBOARDING_V2_CONFIG_KEY)?.value,
  );
  const legacy = parseOwnerOnboardingState(
    configs.find((row) => row.key === OWNER_ONBOARDING_CONFIG_KEY)?.value,
  );
  return {
    coreTeam: SYSTEM_ROLES.slice(1, 4).every((role) => roleIds.has(role.id)),
    bankAccount: Boolean(account),
    materialFoundation: Boolean(location && material),
    initialStock:
      Boolean(posted) ||
      v2?.initialStockDecision === "NO_LEGACY_STOCK" ||
      (!v2 && legacy?.initialStockDecision === "NO_LEGACY_STOCK"),
  };
}

export async function recordReadinessMilestonesTx(args: {
  readonly tx: ReadinessEventTx;
  readonly actorUserId: string;
  readonly changedItem: RequiredReadinessId;
}): Promise<void> {
  const state = await readinessState(args.tx);
  const itemReady =
    args.changedItem === "core_team"
      ? state.coreTeam
      : args.changedItem === "bank_account"
        ? state.bankAccount
        : args.changedItem === "material_foundation"
          ? state.materialFoundation
          : state.initialStock;
  if (itemReady) {
    await args.tx
      .insert(onboardingEvent)
      .values({
        actorUserId: args.actorUserId,
        eventType: "READINESS_ITEM_READY",
        readinessItemId: args.changedItem,
        idempotencyKey: `readiness:${args.changedItem}:ready`,
      })
      .onConflictDoNothing();
  }
  if (state.coreTeam && state.bankAccount && state.materialFoundation && state.initialStock) {
    await args.tx
      .insert(onboardingEvent)
      .values({
        actorUserId: args.actorUserId,
        eventType: "OPERATIONAL_READINESS_COMPLETED",
        idempotencyKey: "readiness:operational:completed",
      })
      .onConflictDoNothing();
  }
}
