function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Refetch yang ditolak server tidak boleh tetap menawarkan akses cached. */
export function isAccessRevoked(error: unknown): boolean {
  if (!isRecord(error) || !isRecord(error.data)) return false;
  return error.data.code === "UNAUTHORIZED" || error.data.code === "FORBIDDEN";
}
