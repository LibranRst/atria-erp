import { describe, expect, test } from "bun:test";

import { parseBankStatementCsv } from "@atria/core/finance/bank-statement-csv";

import {
  createDemoClock,
  createDemoCsvFixtures,
  formatMinorMoney,
  parseMoneyToMinor,
} from "./demo-contract";

describe("demo seed contract", () => {
  test("shifts the baseline while preserving relative dates", () => {
    const clock = createDemoClock({ anchorDate: "2027-01-10" });

    expect(clock.anchorDate).toBe("2027-01-10");
    expect(clock.fromBaseline("2026-07-15T05:00:00Z").toISOString()).toBe(
      "2027-01-03T05:00:00.000Z",
    );
    expect(clock.day(14).toISOString()).toBe("2027-01-24T05:00:00.000Z");
  });

  test("parses money exactly in minor units", () => {
    expect(parseMoneyToMinor("1200000000.00")).toBe(120000000000n);
    expect(parseMoneyToMinor("850000.5")).toBe(85000050n);
    expect(formatMinorMoney(85000050n)).toBe("850000.50");
    expect(() => parseMoneyToMinor("1.000.000")).toThrow("Nominal demo tidak valid");
  });

  test("generates canonical reconciliation fixtures for each target account", () => {
    const fixtures = createDemoCsvFixtures(createDemoClock({ anchorDate: "2027-01-10" }));

    expect(fixtures).toHaveLength(3);
    expect(fixtures[0]?.content).toContain("tanggal,deskripsi,dana_masuk,dana_keluar");
    expect(fixtures[0]?.content).toContain("2027-01-10");
    expect(
      fixtures
        .flatMap((fixture) => fixture.content.split("\n"))
        .some((row) => row.includes("6200000")),
    ).toBe(true);
    expect(fixtures.every((fixture) => parseBankStatementCsv(fixture.content).length > 0)).toBe(
      true,
    );
  });
});
