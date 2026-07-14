import { createAuthClient } from "better-auth/react";

const appBaseURL = process.env.NEXT_PUBLIC_APP_URL?.trim();
const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);

function getClientBaseURL(): string | undefined {
  if (!appBaseURL) return undefined;

  try {
    const configuredURL = new URL(appBaseURL);

    if (
      typeof window !== "undefined" &&
      localHostnames.has(configuredURL.hostname) &&
      !localHostnames.has(window.location.hostname)
    ) {
      return undefined;
    }

    return appBaseURL;
  } catch {
    return undefined;
  }
}

const clientBaseURL = getClientBaseURL();

export const authClient = createAuthClient(
  clientBaseURL ? { baseURL: clientBaseURL } : undefined,
);
