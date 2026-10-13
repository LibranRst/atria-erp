import { db } from "@backend/db";
import { onboardingEvent } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import {
  advanceQuickStartSchema,
  createFirstProjectQuickStartSchema,
  pauseQuickStartSchema,
  recordQuickStartInteractionSchema,
  setInitialStockDecisionSchema,
  type CreateFirstProjectQuickStartInput,
  type OwnerQuickStartState,
} from "@atria/core/onboarding/organization-setup";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  advanceQuickStartTx,
  pauseQuickStartTx,
  createFirstProjectQuickStartTx,
  setInitialStockDecisionTx,
  recordQuickStartRetryTx,
  QuickStartError,
} from "./quick-start-writer";
function hasPermission(actor: Actor, permission: Actor["permissions"][number]): boolean {
  return actor.permissions.includes(permission);
}
async function recordFailure(actor: Actor, eventType: string, errorCode: string): Promise<void> {
  try {
    await db.insert(onboardingEvent).values({
      actorUserId: actor.userId,
      eventType,
      outcome: "ERROR",
      errorCode,
    });
  } catch {
    // Telemetry is best-effort and must never replace the real workflow error.
  }
}

export async function advanceQuickStartUseCase(
  actor: Actor,
  input: unknown,
): Promise<ActionResponse<OwnerQuickStartState>> {
  const parsed = advanceQuickStartSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Tahap tidak valid." } };
  }
  if (!hasPermission(actor, "manage:onboarding")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Hanya Owner yang dapat menjalankan quick start." },
    };
  }

  try {
    const next = await db.transaction((tx) => advanceQuickStartTx(tx, actor, parsed.data));
    return { success: true, data: next };
  } catch (error) {
    if (error instanceof QuickStartError)
      return { success: false, error: { code: error.code, message: error.message } };
    const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    await recordFailure(actor, "QUICK_START_ADVANCE_ERROR", code);
    if (code === "QUICK_START_COMPLETED" || code === "STALE_QUICK_START_STEP") {
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: "Progress quick start sudah berubah. Muat ulang halaman.",
        },
      };
    }
    if (code === "FINANCE_DEFAULTS_INCOMPLETE") {
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: "Lengkapi default budget dan lima kategori utama terlebih dahulu.",
        },
      };
    }
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Progress quick start gagal disimpan." },
    };
  }
}

export async function pauseQuickStartUseCase(
  actor: Actor,
  input: unknown,
): Promise<ActionResponse<OwnerQuickStartState>> {
  const parsed = pauseQuickStartSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Tahap tidak valid." } };
  }
  if (!hasPermission(actor, "manage:onboarding")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Hanya Owner yang dapat menjeda quick start." },
    };
  }

  try {
    const next = await db.transaction((tx) => pauseQuickStartTx(tx, actor, parsed.data));
    return { success: true, data: next };
  } catch (error) {
    if (error instanceof QuickStartError)
      return { success: false, error: { code: error.code, message: error.message } };
    const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    await recordFailure(actor, "QUICK_START_PAUSE_ERROR", code);
    return {
      success: false,
      error: {
        code:
          code === "QUICK_START_COMPLETED" || code === "STALE_QUICK_START_STEP"
            ? "CONFLICT"
            : "INTERNAL_SERVER_ERROR",
        message: "Quick start tidak dapat dijeda. Muat ulang lalu coba lagi.",
      },
    };
  }
}

export async function createFirstProjectQuickStartUseCase(
  actor: Actor,
  input: CreateFirstProjectQuickStartInput,
): Promise<ActionResponse<{ readonly projectId: string; readonly alreadyCompleted: boolean }>> {
  const parsed = createFirstProjectQuickStartSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Data project tidak valid.",
      },
    };
  }
  if (!hasPermission(actor, "manage:onboarding") || !hasPermission(actor, "create:project")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Hanya Owner yang dapat membuat project pertama." },
    };
  }

  try {
    const result = await db.transaction((tx) =>
      createFirstProjectQuickStartTx(tx, actor, parsed.data),
    );
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof QuickStartError)
      return { success: false, error: { code: error.code, message: error.message } };
    const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    await recordFailure(actor, "FIRST_PROJECT_CREATE_ERROR", code);
    if (code === "QUICK_START_COMPLETED" || code === "STALE_QUICK_START_STEP") {
      return {
        success: false,
        error: { code: "CONFLICT", message: "Quick start sudah berubah. Muat ulang halaman." },
      };
    }
    if (code === "FINANCE_DEFAULTS_INCOMPLETE") {
      return {
        success: false,
        error: { code: "CONFLICT", message: "Default finansial belum siap digunakan." },
      };
    }
    if (code === "PROJECT_MANAGER_INVALID") {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Project Manager harus merupakan akun aktif dengan scope project.",
        },
      };
    }
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Project pertama gagal dibuat." },
    };
  }
}

export async function setInitialStockDecisionUseCase(
  actor: Actor,
  input: unknown,
): Promise<ActionResponse<OwnerQuickStartState>> {
  const parsed = setInitialStockDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Keputusan stok tidak valid." },
    };
  }
  if (
    !hasPermission(actor, "manage:onboarding") &&
    !hasPermission(actor, "create:opening_inventory")
  ) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin mengubah keputusan stok awal.",
      },
    };
  }

  try {
    const next = await db.transaction((tx) => setInitialStockDecisionTx(tx, actor, parsed.data));
    return { success: true, data: next };
  } catch (error: unknown) {
    if (error instanceof QuickStartError)
      return { success: false, error: { code: error.code, message: error.message } };
    await recordFailure(actor, "INITIAL_STOCK_DECISION_ERROR", "INTERNAL_SERVER_ERROR");
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Keputusan stok awal gagal disimpan." },
    };
  }
}

export async function recordQuickStartInteractionUseCase(
  actor: Actor,
  input: unknown,
): Promise<ActionResponse<{ readonly recorded: true }>> {
  const parsed = recordQuickStartInteractionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Event quick start tidak valid." },
    };
  }
  if (!hasPermission(actor, "manage:onboarding")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Event quick start tidak diizinkan." },
    };
  }
  try {
    await db.transaction((tx) => recordQuickStartRetryTx(tx, actor, parsed.data.stepId));
    return { success: true, data: { recorded: true } };
  } catch {
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Event quick start gagal dicatat." },
    };
  }
}
