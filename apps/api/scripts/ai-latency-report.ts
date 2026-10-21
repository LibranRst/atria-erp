import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

const label = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/i);
export const latencySampleSchema = z
  .object({
    case: label,
    variant: label,
    completionMs: z.number().finite().nonnegative(),
    correct: z.boolean(),
    outcome: z.enum(["success", "error", "timeout", "cancelled"]),
  })
  .strict();
export type LatencySample = z.infer<typeof latencySampleSchema>;
export const MIN_QUALIFIED_LATENCY_SAMPLES = 20;

export type LatencyGroupReport = {
  readonly case: string;
  readonly variant: string;
  readonly sampleCount: number;
  readonly outcomeCounts: Readonly<Record<LatencySample["outcome"], number>>;
  readonly correctCount: number;
  readonly correctFraction: number;
  readonly medianCompletionMs: number;
  readonly nearestRankP95CompletionMs: number;
  readonly completedWithin10sCount: number;
  readonly completedWithin10sFraction: number;
  readonly successfulCorrectWithin10sCount: number;
  readonly successfulCorrectWithin10sFraction: number;
  readonly adequateSampleCount: boolean;
  readonly qualification: "insufficient-samples" | "target-met-in-samples" | "target-not-met";
  readonly median5sMetInSamples: boolean;
};

function summarizeGroup(samples: readonly LatencySample[]): LatencyGroupReport {
  const durations = samples
    .map((sample) => sample.completionMs)
    .sort((left, right) => left - right);
  const count = samples.length;
  const middle = Math.floor(count / 2);
  const median = count % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
  const correct = samples.filter((sample) => sample.correct && sample.outcome === "success").length;
  const within10s = samples.filter((sample) => sample.completionMs <= 10000).length;
  const successfulCorrectWithin10s = samples.filter(
    (sample) => sample.outcome === "success" && sample.correct && sample.completionMs <= 10000,
  ).length;
  const adequate = count >= MIN_QUALIFIED_LATENCY_SAMPLES;
  const targetMet = correct === count && successfulCorrectWithin10s / count >= 0.95;
  return {
    case: samples[0].case,
    variant: samples[0].variant,
    sampleCount: count,
    outcomeCounts: {
      success: samples.filter((sample) => sample.outcome === "success").length,
      error: samples.filter((sample) => sample.outcome === "error").length,
      timeout: samples.filter((sample) => sample.outcome === "timeout").length,
      cancelled: samples.filter((sample) => sample.outcome === "cancelled").length,
    },
    correctCount: correct,
    correctFraction: correct / count,
    medianCompletionMs: median,
    nearestRankP95CompletionMs: durations[Math.ceil(count * 0.95) - 1],
    completedWithin10sCount: within10s,
    completedWithin10sFraction: within10s / count,
    successfulCorrectWithin10sCount: successfulCorrectWithin10s,
    successfulCorrectWithin10sFraction: successfulCorrectWithin10s / count,
    adequateSampleCount: adequate,
    qualification: !adequate
      ? "insufficient-samples"
      : targetMet
        ? "target-met-in-samples"
        : "target-not-met",
    median5sMetInSamples: adequate && correct === count && median <= 5000,
  };
}

export function buildLatencyReport(samples: readonly unknown[]): {
  readonly minimumQualifiedSamplesPerGroup: number;
  readonly sampleCount: number;
  readonly groups: readonly LatencyGroupReport[];
  readonly interpretation: string;
} {
  const validated = z.array(latencySampleSchema).min(1).parse(samples);
  const groups = new Map<string, LatencySample[]>();
  for (const sample of validated) {
    const key = `${sample.case}\0${sample.variant}`;
    const existing = groups.get(key) ?? [];
    existing.push(sample);
    groups.set(key, existing);
  }
  return {
    minimumQualifiedSamplesPerGroup: MIN_QUALIFIED_LATENCY_SAMPLES,
    sampleCount: validated.length,
    groups: [...groups.values()]
      .map(summarizeGroup)
      .sort(
        (left, right) =>
          left.case.localeCompare(right.case) || left.variant.localeCompare(right.variant),
      ),
    interpretation:
      "All attempts remain in their own case/variant denominator, including errors, timeouts and cancellations. P95 uses nearest rank and is descriptive only below 20 samples; meeting the target in samples is not a population guarantee. Completion within 10s is also reported separately from a correct successful completion. Target qualification requires every attempt correct and at least 95% correct successful completions within 10s.",
  };
}

if (import.meta.main) {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath)
    throw new Error("Usage: bun scripts/ai-latency-report.ts samples.json [report.json]");
  let samples: LatencySample[];
  try {
    const input: unknown = JSON.parse(readFileSync(inputPath, "utf8"));
    samples = z
      .union([
        z.array(latencySampleSchema).min(1),
        z.object({ samples: z.array(latencySampleSchema).min(1) }).strict(),
      ])
      .transform((value) => (Array.isArray(value) ? value : value.samples))
      .parse(input);
  } catch {
    throw new Error(
      "Invalid latency samples; expected case/variant labels, completionMs, correct and outcome only",
    );
  }
  const output = JSON.stringify(buildLatencyReport(samples), null, 2);
  if (outputPath) writeFileSync(outputPath, output, { mode: 0o600 });
  else console.log(output);
}
