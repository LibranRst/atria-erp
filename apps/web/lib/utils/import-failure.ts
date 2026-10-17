/** Preserve validation detail while translating generic browser/Next transport errors. */
export function importFailureMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  return !message ||
    /unexpected response.*server|failed to fetch|fetch failed|networkerror|load failed|network request failed/i.test(
      message,
    )
    ? fallback
    : message;
}
