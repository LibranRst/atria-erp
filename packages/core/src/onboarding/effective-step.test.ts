import { describe, expect, test } from "bun:test";

import {
  ONBOARDING_STEP_IDS,
  resolveEffectiveOnboardingStep,
  type OnboardingStepId,
} from "./owner-onboarding";

/**
 * Layar sambutan pernah tidak bisa dilihat sama sekali di instance baru.
 *
 * Aturan lamanya berbunyi "kalau sedang di welcome dan masih ada setup yang
 * belum beres, lompat ke setup itu" — dan di instance yang baru dibuat, seluruh
 * setup memang belum beres. Syaratnya selalu benar, jadi welcome selalu
 * dilewati. Setiap pelanggan baru akan mendarat di tengah alur tanpa pernah
 * diberi tahu alurnya tentang apa.
 */

/** Belum ada satu pun langkah yang selesai — kondisi instance yang baru jadi. */
function nothingReady(): Record<OnboardingStepId, boolean> {
  return Object.fromEntries(ONBOARDING_STEP_IDS.map((id) => [id, false])) as Record<
    OnboardingStepId,
    boolean
  >;
}

describe("langkah onboarding yang sebenarnya dibuka", () => {
  test("instance baru membuka welcome, bukan melompatinya", () => {
    expect(
      resolveEffectiveOnboardingStep({
        status: "IN_PROGRESS",
        currentStep: "welcome",
        readiness: nothingReady(),
      }),
    ).toBe("welcome");
  });

  test("welcome tetap dibuka walau setelan keuangan sudah terisi otomatis", () => {
    // Bootstrap menanam kategori biaya dan alokasi budget, jadi langkah pertama
    // sudah "siap" sebelum Owner menyentuh apa pun. Itu bukan alasan melewati
    // sambutan — ini persis kasus yang dilaporkan: mendarat di langkah 2.
    expect(
      resolveEffectiveOnboardingStep({
        status: "IN_PROGRESS",
        currentStep: "welcome",
        readiness: { ...nothingReady(), financial_defaults: true },
      }),
    ).toBe("welcome");
  });

  test("setelah welcome dilewati, lompat ke pekerjaan pertama yang tersisa", () => {
    expect(
      resolveEffectiveOnboardingStep({
        status: "IN_PROGRESS",
        currentStep: "welcome",
        readiness: { ...nothingReady(), welcome: true, financial_defaults: true },
      }),
    ).toBe("team_vendors");
  });

  test("langkah yang datanya belum lengkap tidak ditinggalkan", () => {
    expect(
      resolveEffectiveOnboardingStep({
        status: "IN_PROGRESS",
        currentStep: "bank_accounts",
        readiness: { ...nothingReady(), welcome: true, financial_defaults: true },
      }),
    ).toBe("bank_accounts");
  });

  test("langkah yang sudah beres tidak diminta diklik ulang", () => {
    const readiness = nothingReady();
    for (const id of ["welcome", "financial_defaults", "team_vendors", "bank_accounts"] as const) {
      readiness[id] = true;
    }
    expect(
      resolveEffectiveOnboardingStep({
        status: "IN_PROGRESS",
        currentStep: "financial_defaults",
        readiness,
      }),
    ).toBe("material_foundation");
  });

  test("semua langkah siap berarti ringkasan", () => {
    const readiness = Object.fromEntries(ONBOARDING_STEP_IDS.map((id) => [id, true])) as Record<
      OnboardingStepId,
      boolean
    >;
    expect(
      resolveEffectiveOnboardingStep({
        status: "IN_PROGRESS",
        currentStep: "welcome",
        readiness,
      }),
    ).toBe("summary");
  });

  test("status COMPLETED selalu ringkasan, apa pun kesiapannya", () => {
    expect(
      resolveEffectiveOnboardingStep({
        status: "COMPLETED",
        currentStep: "welcome",
        readiness: nothingReady(),
      }),
    ).toBe("summary");
  });
});
