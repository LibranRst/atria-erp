import { describe, expect, test } from "bun:test";
import { resolveAppDestination } from "./app-destination";

describe("ketersediaan native dan konteks web", () => {
  test("read-only detail is native and rejects unknown or credential parameters", () => {
    const id = "66666666-6666-6666-6666-666666666661";
    expect(resolveAppDestination(`/modal/activity?kind=CASH_TRANSACTION&id=${id}`)).toEqual({
      kind: "native",
      href: { pathname: "/modal/activity", params: { kind: "CASH_TRANSACTION", id } },
    });
    expect(resolveAppDestination("/modal/approval?approval=project_cost-demo")?.kind).toBe(
      "native",
    );
    expect(resolveAppDestination(`/modal/activity?kind=PROJECT_COST&id=${id}`)).toBeNull();
    expect(
      resolveAppDestination(`/modal/activity?kind=CASH_TRANSACTION&id=${id}&token=secret`),
    ).toBeNull();
    expect(resolveAppDestination("/modal/approval?approval=demo", true)).toBeNull();
    expect(resolveAppDestination("/modal/approval?approval=demo&extra=1")).toBeNull();
  });
  test("ordinary Dashboard revisit preserves subtab; only explicit deep links choose a tab", () => {
    expect(resolveAppDestination("/ledger")).toEqual({
      kind: "native",
      href: { pathname: "/ledger" },
    });
    expect(resolveAppDestination("/ledger?tab=overview")).toEqual({
      kind: "native",
      href: { pathname: "/ledger", params: { tab: "overview" } },
    });
  });
  test("dashboard mempertahankan tab dan membuka detail rekening native", () => {
    expect(resolveAppDestination("/ledger?tab=budget")).toEqual({
      kind: "native",
      href: { pathname: "/ledger", params: { tab: "budget" } },
    });
    expect(resolveAppDestination("/ledger?tab=accounts&account=bank-1")).toEqual({
      kind: "native",
      href: { pathname: "/modal/account", params: { account: "bank-1" } },
    });
    expect(resolveAppDestination("/ledger?tab=accounts&account=bank-1", true)).toEqual({
      kind: "web",
      path: "/ledger?tab=accounts&account=bank-1",
    });
    expect(resolveAppDestination("/ledger?tab=accounts&account=bank-1&unknown=true")?.kind).toBe(
      "web",
    );
  });
  test("RAP dan vendor bill belum ditandai native", () => {
    expect(resolveAppDestination("/projects/p1?tab=rap")).toEqual({
      kind: "web",
      path: "/projects/p1?tab=rap",
    });
    expect(resolveAppDestination("/expenses?new-vendor-bill=true")).toEqual({
      kind: "web",
      path: "/expenses?new-vendor-bill=true",
    });
    expect(resolveAppDestination("/projects/p1")).toEqual({
      kind: "native",
      href: { pathname: "/projects/[projectId]", params: { projectId: "p1" } },
    });
  });
  test("create native hanya ketika konteksnya didukung", () => {
    expect(resolveAppDestination("/projects?new-project=true")?.kind).toBe("native");
    expect(resolveAppDestination("/expenses?new-expense=true")?.kind).toBe("native");
    expect(resolveAppDestination("/projects/p1?new-expense=true")?.kind).toBe("web");
  });
  test("menolak origin asing, route tidak dikenal dan credential dalam URL", () => {
    for (const path of [
      "https://evil.invalid/projects",
      "//evil.invalid/projects",
      "/api/trpc",
      "/settings?token=secret",
      "/projects\\evil",
      "/projects\n",
      "/projects/%E0%A4%A",
      "/projects/%2Fabc",
    ]) {
      expect(resolveAppDestination(path)).toBeNull();
    }
  });
});
