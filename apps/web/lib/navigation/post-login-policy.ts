import { isWorkspacePath, workspaceHref } from "./workspace-routes";

export function postLoginDestination(
  home: string,
  requested: string | undefined,
  nativeBridge: boolean,
): string {
  let destination = home;
  // Mandatory account/setup gates precede a requested deep link.
  const homePath = new URL(home, "https://atria.invalid").pathname;
  if (
    !homePath.startsWith("/onboarding") &&
    homePath !== "/profile/password" &&
    requested?.startsWith("/") &&
    !requested.startsWith("//") &&
    !/[\\\r\n]/.test(requested)
  ) {
    const url = new URL(requested, "https://atria.invalid");
    if (isWorkspacePath(url.pathname) || url.pathname === "/admin") destination = requested;
  }
  return workspaceHref(destination, "mobile", nativeBridge);
}
