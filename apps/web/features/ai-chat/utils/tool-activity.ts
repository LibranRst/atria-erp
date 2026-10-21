import type { UIMessage } from "ai";
import { z } from "zod";
import { requestUserInputSchema, type RequestUserInputPayload } from "@atria/core/ai/input-request";
import type { ActiveInputRequest } from "./input-request-reader";
import type { ActivityTrace } from "./activity-summary";
import {
  collapseTraces,
  toolActivityKind,
  toolLabel,
  toolNameFromPartType,
  toolTraceState,
  type ToolTraceState,
} from "./tool-labels";

const record = z.record(z.string(), z.unknown());
const partSchema = z.object({
  type: z.string(),
  state: z.string().optional(),
  toolCallId: z.string().optional(),
  input: z.unknown().optional(),
  rawInput: z.unknown().optional(),
  output: z.unknown().optional(),
  errorText: z.string().optional(),
});
type Part = z.infer<typeof partSchema>;
function object(value: unknown): Record<string, unknown> | null {
  const parsed = record.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function outputFailure(output: unknown): boolean {
  const value = object(output);
  return Boolean(
    value &&
    (value.success === false ||
      (typeof value.error === "string" && value.error.length > 0) ||
      object(value.error)),
  );
}
export function activityToolState(part: unknown, isStreaming: boolean): ToolTraceState {
  const parsed = partSchema.safeParse(part);
  if (!parsed.success) return isStreaming ? "running" : "interrupted";
  return parsed.data.state === "output-available" && outputFailure(parsed.data.output)
    ? "failed"
    : toolTraceState(parsed.data.state, !isStreaming);
}
function failureText(part: Part): string {
  const output = object(part.output),
    error = object(output?.error);
  return [part.errorText, output?.error, error?.code, error?.message]
    .filter((v): v is string => typeof v === "string")
    .join(" ");
}
function accessFailure(part: Part): boolean {
  return /forbidden|unauthorized|access_denied|permission_denied|izin|akses.*(?:ditolak|tidak|luar|belum)|tidak (?:memiliki|punya|dapat|bisa).*akses|tidak ditugaskan/i.test(
    failureText(part),
  );
}
function projectField(
  payload: RequestUserInputPayload,
): RequestUserInputPayload["fields"][number] | undefined {
  return payload.fields.find(
    (f) =>
      f.type === "select" &&
      f.required &&
      (/^(?:project(?:_?(?:id|name))?|proyek(?:_?(?:id|name))?)$/i.test(f.key) ||
        /^(?:nama )?proyek$/i.test(f.label.trim())) &&
      Boolean(f.options?.length),
  );
}
function genuineResult(part: Part): boolean {
  return (
    part.state === "output-available" &&
    typeof part.output === "object" &&
    part.output !== null &&
    !outputFailure(part.output)
  );
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = object(value);
  if (obj)
    return `{${Object.keys(obj)
      .filter((key) => obj[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(obj[key])}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
function sameReadInput(failed: Part, success: Part): boolean {
  // Missing input cannot establish a retry relationship. Pagination and filters remain significant.
  return (
    failed.input !== undefined &&
    success.input !== undefined &&
    canonical(failed.input) === canonical(success.input)
  );
}
/** A preview-size correction does not change an authoritative unfiltered count. */
function projectCountRetry(failed: Part, success: Part): boolean {
  if (failed.type !== "tool-listProjects" || failed.input !== undefined) return false;
  const raw = z
    .object({
      limit: z.number().int().gt(20),
      _introduction: z.string().optional(),
    })
    .strict()
    .safeParse(failed.rawInput);
  const input = z
    .object({ limit: z.number().int().min(1).max(20).optional() })
    .strict()
    .safeParse(success.input);
  const output = z
    .object({
      matchedCount: z.number().int().nonnegative(),
      hasMore: z.boolean(),
      projects: z.array(z.object({ projectId: z.string().min(1), name: z.string().min(1) })),
    })
    .safeParse(success.output);
  return (
    raw.success &&
    input.success &&
    output.success &&
    output.data.matchedCount >= output.data.projects.length &&
    output.data.hasMore === output.data.matchedCount > output.data.projects.length &&
    new Set(output.data.projects.map((project) => project.projectId)).size ===
      output.data.projects.length
  );
}
const shortLegacySearch = z
  .object({
    query: z.string().trim().length(1),
    status: z.enum(["ACTIVE", "DRAFT", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();
function projectChoiceHandoff(failed: Part, success: Part, later: readonly Part[]): boolean {
  if (
    failed.input !== undefined ||
    failed.type !== "tool-listProjects" ||
    success.type !== failed.type
  )
    return false;
  const raw = shortLegacySearch.safeParse(failed.rawInput),
    input = object(success.input),
    output = object(success.output);
  if (
    !raw.success ||
    !input ||
    input.query !== undefined ||
    input.status !== raw.data.status ||
    !output
  )
    return false;
  const projects = z
    .array(z.object({ projectId: z.string().min(1), name: z.string().min(1) }))
    .min(1)
    .safeParse(output.projects);
  if (!projects.success) return false;
  const values = new Set(projects.data.flatMap((p) => [p.projectId, p.name]));
  return later.some((request) => {
    if (request.type !== "tool-requestUserInput" || !genuineResult(request)) return false;
    const payload = requestUserInputSchema.safeParse(request.output);
    const field = payload.success ? projectField(payload.data) : undefined;
    return Boolean(
      field?.options?.length && field.options.every((option) => values.has(option.value)),
    );
  });
}
function failureDetail(part: Part): string {
  if (accessFailure(part)) return "Akses data ditolak. Periksa izin akun untuk melanjutkan.";
  if (part.input === undefined && part.rawInput !== undefined)
    return part.type === "tool-proposeBankCash"
      ? "Isian rekening atau kas belum valid. Periksa data lalu minta preview baru."
      : "Isian pencarian belum valid. Perjelas permintaan lalu coba lagi.";
  return "Data belum dapat diperiksa. Coba ulangi permintaan.";
}
/** Evidence belongs to one assistant message. Never recover a mutation, access denial or unrelated read. */
export function deriveToolActivity(
  message: UIMessage,
  isStreaming: boolean,
  pendingInput: ActiveInputRequest | null = null,
): readonly ActivityTrace[] {
  const parts = message.parts.flatMap((part) => {
    const parsed = partSchema.safeParse(part);
    return parsed.success && toolNameFromPartType(parsed.data.type) ? [parsed.data] : [];
  });
  const traces = parts.map((part, index) => {
    const name = toolNameFromPartType(part.type) ?? "",
      kind = toolActivityKind(name),
      state = activityToolState(part, isStreaming);
    const later = parts.slice(index + 1);
    const recovered =
      state === "failed" &&
      kind === "read" &&
      !accessFailure(part) &&
      later.some(
        (success, next) =>
          success.type === part.type &&
          genuineResult(success) &&
          (sameReadInput(part, success) ||
            projectCountRetry(part, success) ||
            projectChoiceHandoff(part, success, later.slice(next + 1))),
      );
    const payload =
      name === "requestUserInput" &&
      state === "done" &&
      (part.toolCallId ?? `${message.id}:input`) === pendingInput?.toolCallId
        ? requestUserInputSchema.safeParse(part.output)
        : null;
    const field = payload?.success ? projectField(payload.data) : undefined;
    const selected = field?.options?.some(
      (option) => option.value === (pendingInput?.values?.[field.key] ?? field.defaultValue ?? ""),
    );
    const waitingForInput: ActivityTrace["waitingForInput"] = payload?.success
      ? field && !selected
        ? "project"
        : "form"
      : undefined;
    const trace: Omit<ActivityTrace, "count"> = {
      key: `${message.id}-tool-${index}`,
      label: recovered
        ? name === "listProjects"
          ? "Pencarian awal diulang"
          : "Pemeriksaan awal diulang"
        : toolLabel(name, state),
      kind,
      state: recovered ? "recovered" : state,
      ...(state === "failed" && !recovered ? { detail: failureDetail(part) } : {}),
      ...(waitingForInput ? { waitingForInput } : {}),
    };
    return trace;
  });
  return collapseTraces(traces);
}
