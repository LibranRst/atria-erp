import {
  acknowledgeRoleGuideSchema,
  buildRoleGuide,
  type OwnRoleGuide,
} from "@atria/core/onboarding/role-guide";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { Actor } from "@backend/server/actor";
import { roleGuideContextKey } from "./role-guide-context";

export type RoleGuideAcknowledgment = { readonly acknowledged: boolean };
export type RoleGuideRepository = {
  readonly readAcknowledgedContext: (userId: string) => Promise<string | null>;
  readonly needsOwnerQuickStart: (actor: Actor) => Promise<boolean>;
  readonly acknowledgeCurrentContext: (
    actor: Actor,
    contextKey: string,
  ) => Promise<"acknowledged" | "stale" | "unavailable">;
};

export async function getOwnRoleGuideUseCase(
  actor: Actor,
  repository: RoleGuideRepository,
): Promise<ActionResponse<OwnRoleGuide>> {
  if (actor.mustChangePassword && !actor.developerActorUserId) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Ganti kata sandi sementara terlebih dahulu." },
    };
  }
  try {
    const contextKey = roleGuideContextKey(actor);
    const simulation = Boolean(actor.developerActorUserId);
    const [acknowledged, needsQuickStart] = simulation
      ? [null, false]
      : await Promise.all([
          repository.readAcknowledgedContext(actor.userId),
          repository.needsOwnerQuickStart(actor),
        ]);
    return {
      success: true,
      data: {
        ...buildRoleGuide(actor),
        contextKey,
        shouldAutoShow: !simulation && !needsQuickStart && acknowledged !== contextKey,
        canAcknowledge: !simulation,
      },
    };
  } catch {
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Panduan belum dapat dimuat. Coba lagi." },
    };
  }
}

export async function acknowledgeOwnRoleGuideUseCase(
  actor: Actor,
  input: unknown,
  repository: RoleGuideRepository,
): Promise<ActionResponse<RoleGuideAcknowledgment>> {
  const parsed = acknowledgeRoleGuideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Status panduan tidak valid." },
    };
  }
  if (actor.mustChangePassword && !actor.developerActorUserId) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Ganti kata sandi sementara terlebih dahulu." },
    };
  }
  // Simulation may read an effective user's guide, but never consume their acknowledgment.
  if (actor.developerActorUserId) return { success: true, data: { acknowledged: false } };
  if (parsed.data.contextKey !== roleGuideContextKey(actor)) {
    return {
      success: false,
      error: { code: "CONFLICT", message: "Akses akun sudah berubah. Buka panduan kembali." },
    };
  }
  try {
    const outcome = await repository.acknowledgeCurrentContext(actor, parsed.data.contextKey);
    if (outcome === "stale") {
      return {
        success: false,
        error: { code: "CONFLICT", message: "Akses akun sudah berubah. Buka panduan kembali." },
      };
    }
    if (outcome === "unavailable") {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Akun tidak dapat menyimpan status panduan." },
      };
    }
    return { success: true, data: { acknowledged: true } };
  } catch {
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Status panduan belum tersimpan." },
    };
  }
}
