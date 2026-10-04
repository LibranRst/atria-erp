import type { WorkspacePresentation } from "@/lib/navigation/workspace-routes";

function preferenceKey(userId: string): string {
  return `atria:workspace:${userId}`;
}

export function readWorkspacePreference(userId: string | undefined): WorkspacePresentation | null {
  if (!userId) return null;
  try {
    const value = window.localStorage.getItem(preferenceKey(userId));
    return value === "desktop" || value === "mobile" ? value : null;
  } catch {
    return null;
  }
}

export function saveWorkspacePreference(
  userId: string | undefined,
  value: WorkspacePresentation,
): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(preferenceKey(userId), value);
  } catch {
    /* Storage can be disabled. */
  }
}
