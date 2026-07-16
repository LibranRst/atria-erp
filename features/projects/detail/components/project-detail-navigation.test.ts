import { describe, expect, it } from "bun:test";

import {
  defaultTabForDomain,
  projectDomainForTab,
} from "./project-detail-navigation";

describe("project detail domain navigation", () => {
  it("maps every legacy tab query to its visible domain", () => {
    expect(projectDomainForTab("overview")).toBe("overview");
    expect(projectDomainForTab("rap")).toBe("planning");
    expect(projectDomainForTab("rab")).toBe("planning");
    expect(projectDomainForTab("stok")).toBe("operations");
    expect(projectDomainForTab("expenses")).toBe("operations");
    expect(projectDomainForTab("payments")).toBe("finance");
    expect(projectDomainForTab("profitability")).toBe("finance");
  });

  it("uses workflow-first defaults for approved projects", () => {
    expect(defaultTabForDomain("overview", false)).toBe("overview");
    expect(defaultTabForDomain("planning", false)).toBe("rap");
    expect(defaultTabForDomain("operations", false)).toBe("stok");
    expect(defaultTabForDomain("finance", false)).toBe("payments");
  });

  it("keeps locked projects inside RAP setup", () => {
    expect(defaultTabForDomain("planning", true)).toBe("rap");
    expect(defaultTabForDomain("operations", true)).toBe("rap");
    expect(defaultTabForDomain("finance", true)).toBe("rap");
  });
});
