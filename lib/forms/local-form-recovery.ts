import { z } from "zod";

export type LocalFormRecovery<TPayload> = {
  readonly schemaVersion: number;
  readonly changedAt: string;
  readonly payload: TPayload;
};

export function parseLocalFormRecovery<TPayload>({
  raw,
  schema,
  schemaVersion,
}: {
  readonly raw: string | null;
  readonly schema: z.ZodType<TPayload>;
  readonly schemaVersion: number;
}): LocalFormRecovery<TPayload> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as {
      readonly schemaVersion?: unknown;
      readonly changedAt?: unknown;
      readonly payload?: unknown;
    };
    if (candidate.schemaVersion !== schemaVersion) return null;
    const parsed = schema.safeParse(candidate.payload);
    if (!parsed.success) return null;
    return {
      schemaVersion,
      changedAt:
        typeof candidate.changedAt === "string"
          ? candidate.changedAt
          : new Date(0).toISOString(),
      payload: parsed.data,
    };
  } catch {
    return null;
  }
}

export function serializeLocalFormRecovery<TPayload>({
  payload,
  schemaVersion,
  changedAt = new Date(),
}: {
  readonly payload: TPayload;
  readonly schemaVersion: number;
  readonly changedAt?: Date;
}): string {
  return JSON.stringify({
    schemaVersion,
    changedAt: changedAt.toISOString(),
    payload,
  } satisfies LocalFormRecovery<TPayload>);
}
