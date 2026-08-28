import { unavailableTopicsForRole } from "@/lib/ai/tools/context";
import { aiToolContextForRole as contextFor } from "@/lib/testing/ai-tool-context";
import { describe, expect, it } from "bun:test";

describe("unavailableTopicsForRole", () => {
  it("tidak membatasi topik finansial untuk peran berlingkup global", () => {
    const topics = unavailableTopicsForRole(contextFor("FINANCE_ADMIN"));
    expect(topics).not.toContain("saldo dan mutasi rekening bank perusahaan");
    expect(topics).not.toContain("antrean persetujuan lintas seluruh proyek perusahaan");
  });

  it("membatasi saldo bank dan antrean persetujuan lintas proyek untuk Project Manager", () => {
    // Ini persis tool yang akan menolak PM: getBankBalances (view:bank_account)
    // dan getPendingApprovals (hasGlobalScope), keduanya di finance-tools.ts.
    // Kalau suggestFollowUps tidak tahu ini, ia bisa menyarankan pertanyaan yang
    // tool-nya sendiri pasti akan menolak.
    const topics = unavailableTopicsForRole(contextFor("PROJECT_MANAGER"));
    expect(topics).toContain("saldo dan mutasi rekening bank perusahaan");
    expect(topics).toContain("antrean persetujuan lintas seluruh proyek perusahaan");
    expect(topics).toContain("daftar pemegang izin dan simulasi perubahan peran");
    expect(topics).toHaveLength(3);
  });

  it("membuka topik peran hanya untuk pemegang manage:roles", () => {
    // Owner memegang `manage:roles`; Finance Admin tidak, meski lingkupnya global.
    expect(unavailableTopicsForRole(contextFor("OWNER"))).toEqual([]);
    expect(unavailableTopicsForRole(contextFor("FINANCE_ADMIN"))).toEqual([
      "daftar pemegang izin dan simulasi perubahan peran",
    ]);
  });

  it("membatasi peran tanpa izin sama sekali juga", () => {
    expect(unavailableTopicsForRole(contextFor("UNKNOWN_ROLE")).length).toBeGreaterThan(0);
  });
});
