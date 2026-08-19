import { unavailableTopicsForRole, type AiToolContext } from "@/lib/ai/tools/context";
import { describe, expect, it } from "bun:test";

function contextFor(roleName: string): AiToolContext {
  return { userId: "00000000-0000-0000-0000-000000000001", roleName };
}

describe("unavailableTopicsForRole", () => {
  it("tidak membatasi apa pun untuk peran berlingkup global", () => {
    expect(unavailableTopicsForRole(contextFor("OWNER"))).toEqual([]);
    expect(unavailableTopicsForRole(contextFor("FINANCE_ADMIN"))).toEqual([]);
  });

  it("membatasi saldo bank dan antrean persetujuan lintas proyek untuk Project Manager", () => {
    // Ini persis tool yang akan menolak PM: getBankBalances (view:bank_account)
    // dan getPendingApprovals (hasGlobalScope), keduanya di finance-tools.ts.
    // Kalau suggestFollowUps tidak tahu ini, ia bisa menyarankan pertanyaan yang
    // tool-nya sendiri pasti akan menolak.
    const topics = unavailableTopicsForRole(contextFor("PROJECT_MANAGER"));
    expect(topics).toContain("saldo dan mutasi rekening bank perusahaan");
    expect(topics).toContain("antrean persetujuan lintas seluruh proyek perusahaan");
    expect(topics).toHaveLength(2);
  });

  it("membatasi peran tanpa izin sama sekali juga", () => {
    expect(unavailableTopicsForRole(contextFor("UNKNOWN_ROLE")).length).toBeGreaterThan(0);
  });
});
