import "server-only";

import { actorHasPermission } from "@atria/core/auth/permissions";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { appConfig, inventoryOpeningBatch } from "@/db/schema";
import type { Actor } from "@/server/actor";
import {
  OWNER_ONBOARDING_V2_CONFIG_KEY,
  parseOwnerQuickStartState,
  type QuickStartStepId,
} from "@atria/core/onboarding/organization-setup";
import {
  OWNER_ONBOARDING_CONFIG_KEY,
  parseOwnerOnboardingState,
} from "@atria/core/onboarding/owner-onboarding";

export type HomeDestination = {
  readonly route: "/ledger" | "/materials" | "/onboarding" | "/onboarding/review" | "/projects";
  readonly onboardingStep: QuickStartStepId | null;
  readonly path: string;
};

/**
 * Menyelesaikan rute tujuan beranda / post-login untuk pengguna secara cepat dan andal.
 *
 * Menggantikan tangga 13 query `getOrganizationSetupOverviewUseCase` dengan
 * pemeriksaan terindeks ke `app_config` dan tabel `project` bila belum ada konfigurasi.
 */
export async function resolveHomeDestinationInfo(actor: Actor): Promise<HomeDestination> {
  if (actorHasPermission(actor.roleName, "manage:onboarding")) {
    const configRows = await db.query.appConfig.findMany({
      where: inArray(appConfig.key, [
        OWNER_ONBOARDING_V2_CONFIG_KEY,
        OWNER_ONBOARDING_CONFIG_KEY,
      ]),
      columns: { key: true, value: true },
    });

    const v2Row = configRows.find((row) => row.key === OWNER_ONBOARDING_V2_CONFIG_KEY);
    const legacyRow = configRows.find((row) => row.key === OWNER_ONBOARDING_CONFIG_KEY);

    const v2 = parseOwnerQuickStartState(v2Row?.value);
    if (v2) {
      if (v2.status === "IN_PROGRESS") {
        return {
          route: "/onboarding",
          onboardingStep: v2.currentStep,
          path: `/onboarding?step=${v2.currentStep}`,
        };
      }
      return { route: "/ledger", onboardingStep: null, path: "/ledger" };
    }

    const legacy = parseOwnerOnboardingState(legacyRow?.value);
    if (legacy?.status === "COMPLETED" || legacy?.status === "PAUSED") {
      return { route: "/ledger", onboardingStep: null, path: "/ledger" };
    }

    // Jika belum ada config onboarding v2 atau legacy belum selesai,
    // periksa apakah sudah ada proyek (instalasi lama yang sudah berjalan).
    const existingProject = await db.query.project.findFirst({
      columns: { id: true },
    });

    if (existingProject) {
      return { route: "/ledger", onboardingStep: null, path: "/ledger" };
    }

    // Instalasi baru / setup pertama kali: buka quick start dari welcome.
    return {
      route: "/onboarding",
      onboardingStep: "welcome",
      path: "/onboarding?step=welcome",
    };
  }

  if (actorHasPermission(actor.roleName, "review:onboarding")) {
    const pending = await db.query.inventoryOpeningBatch.findFirst({
      where: eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"),
      columns: { id: true },
    });

    if (pending) {
      return { route: "/onboarding/review", onboardingStep: null, path: "/onboarding/review" };
    }
    return { route: "/ledger", onboardingStep: null, path: "/ledger" };
  }

  /*
   * Tangga tujuan: buku kas dulu, lalu proyek, lalu gudang. Peran tanpa
   * ketiganya mendarat di daftar proyek — halaman paling tidak berbahaya.
   */
  if (actorHasPermission(actor.roleName, "view:ledger")) {
    return { route: "/ledger", onboardingStep: null, path: "/ledger" };
  }
  if (actorHasPermission(actor.roleName, "view:project")) {
    return { route: "/projects", onboardingStep: null, path: "/projects" };
  }
  if (actorHasPermission(actor.roleName, "view:inventory")) {
    return { route: "/materials", onboardingStep: null, path: "/materials" };
  }
  return { route: "/projects", onboardingStep: null, path: "/projects" };
}

export async function resolveHomeDestination(actor: Actor): Promise<string> {
  const info = await resolveHomeDestinationInfo(actor);
  return info.path;
}
