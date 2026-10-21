import { describe, expect, test } from "bun:test";
import { buildLatencyReport, type LatencySample } from "./ai-latency-report";

function sample(completionMs: number, changes: Partial<LatencySample> = {}): LatencySample {
  return {
    case: "settings-short",
    variant: "adaptive",
    completionMs,
    correct: true,
    outcome: "success",
    ...changes,
  };
}

describe("repeatable complete-response latency evidence", () => {
  test("one fast response never qualifies a p95 or target claim", (): void => {
    const report = buildLatencyReport([sample(1000)]).groups[0];
    expect(report.nearestRankP95CompletionMs).toBe(1000);
    expect(report.qualification).toBe("insufficient-samples");
    expect(report.adequateSampleCount).toBe(false);
    expect(report.median5sMetInSamples).toBe(false);
  });

  test("median and nearest-rank p95 use all attempts, with an inclusive ten-second limit", (): void => {
    const durations = Array.from({ length: 20 }, (_, index) => (index + 1) * 500);
    const report = buildLatencyReport(durations.map((duration) => sample(duration))).groups[0];
    expect(report.medianCompletionMs).toBe(5250);
    expect(report.nearestRankP95CompletionMs).toBe(9500);
    expect(report.completedWithin10sCount).toBe(20);
    expect(report.qualification).toBe("target-met-in-samples");
    expect(report.median5sMetInSamples).toBe(false);
    const oneSlow = buildLatencyReport([
      ...Array.from({ length: 19 }, () => sample(5000)),
      sample(15000),
    ]).groups[0];
    expect(oneSlow.nearestRankP95CompletionMs).toBe(5000);
    expect(oneSlow.successfulCorrectWithin10sFraction).toBe(0.95);
    expect(oneSlow.qualification).toBe("target-met-in-samples");
  });

  test("fast errors and failed correctness cannot be hidden or qualify the target", (): void => {
    const attempts = [
      ...Array.from({ length: 17 }, () => sample(4000)),
      sample(100, { outcome: "error", correct: false }),
      sample(45000, { outcome: "timeout", correct: false }),
      sample(200, { outcome: "cancelled", correct: false }),
    ];
    const report = buildLatencyReport(attempts).groups[0];
    expect(report.outcomeCounts).toEqual({ success: 17, error: 1, timeout: 1, cancelled: 1 });
    expect(report.sampleCount).toBe(20);
    expect(report.completedWithin10sFraction).toBe(0.95);
    expect(report.successfulCorrectWithin10sFraction).toBe(0.85);
    expect(report.correctFraction).toBe(0.85);
    expect(report.qualification).toBe("target-not-met");
    expect(report.median5sMetInSamples).toBe(false);
    expect(
      buildLatencyReport([
        ...Array.from({ length: 19 }, () => sample(1000)),
        sample(1000, { correct: false }),
      ]).groups[0].qualification,
    ).toBe("target-not-met");
  });

  test("does not pool cases or model variants to manufacture adequate samples", (): void => {
    const attempts = [
      ...Array.from({ length: 10 }, () => sample(1000)),
      ...Array.from({ length: 10 }, () => sample(1000, { variant: "high" })),
      ...Array.from({ length: 10 }, () => sample(1000, { case: "document-short" })),
    ];
    const report = buildLatencyReport(attempts);
    expect(report.sampleCount).toBe(30);
    expect(report.groups).toHaveLength(3);
    expect(
      report.groups.every(
        (group) => group.sampleCount === 10 && group.qualification === "insufficient-samples",
      ),
    ).toBe(true);
  });

  test("rejects nonfinite/negative timings and extra raw payload fields", (): void => {
    for (const duration of [NaN, Infinity, -1])
      expect(() => buildLatencyReport([sample(duration)])).toThrow();
    expect(() => buildLatencyReport([])).toThrow();
    expect(() => buildLatencyReport([{ ...sample(1), prompt: "private business text" }])).toThrow();
  });
});
