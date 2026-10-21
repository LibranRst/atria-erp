const localHostnames = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Local Next may select another port; browser auth must use that same origin. */
export function resolveAuthClientBaseURL(
  configured: string | undefined,
  browserOrigin?: string,
): string | undefined {
  if (!configured?.trim()) return undefined;
  try {
    const target = new URL(configured.trim());
    if (
      browserOrigin &&
      localHostnames.has(target.hostname) &&
      new URL(browserOrigin).origin !== target.origin
    )
      return undefined;
    return target.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}
