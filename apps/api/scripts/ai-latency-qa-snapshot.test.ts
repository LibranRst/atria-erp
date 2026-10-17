import { expect, test } from "bun:test";
import { assertLatencyQaTarget, snapshotRows } from "./ai-latency-qa-snapshot";

test("the read-only evidence operator rejects every unapproved database target without exposing it", (): void => {
  const target = "postgresql://qa:private-value@127.0.0.1:32768/atria_audit_reconciliation";
  expect(assertLatencyQaTarget(target, "development")).toBe(target);
  for (const wrong of [
    undefined,
    "invalid",
    target.replace("127.0.0.1", "localhost"),
    target.replace("32768", "5432"),
    target.replace("32768", "32774"),
    target.replace("atria_audit_reconciliation", "atria_pilot"),
    target.replace("postgresql:", "https:"),
    `${target}?host=foreign-host`,
  ]) {
    expect(() => assertLatencyQaTarget(wrong, "development")).toThrow(
      "Exact loopback disposable latency QA database required",
    );
  }
  expect(() => assertLatencyQaTarget(target, "production")).toThrow(
    "Exact loopback disposable latency QA database required",
  );
});

test("snapshots protect exact values and row count while exposing only stable digests", (): void => {
  const rows = [
    { id: "a", amount: "125000000.25", credential: "must-not-appear" },
    { id: "b", amount: "0.00" },
  ];
  const baseline = snapshotRows(rows);
  expect(snapshotRows([...rows].reverse())).toEqual(baseline);
  expect(snapshotRows([{ ...rows[0], amount: "125000000.26" }, rows[1]])).not.toEqual(baseline);
  expect(snapshotRows([...rows, rows[1]])).not.toEqual(baseline);
  expect(baseline.count).toBe(2);
  expect(baseline.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(baseline)).not.toContain("must-not-appear");
  expect(JSON.stringify(baseline)).not.toContain("125000000.25");
});
