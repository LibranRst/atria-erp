import { createAuthClient } from "better-auth/react";
import { resolveAuthClientBaseURL } from "./auth-client-url";

const clientBaseURL = resolveAuthClientBaseURL(
  process.env.NEXT_PUBLIC_APP_URL,
  typeof window === "undefined" ? undefined : window.location.origin,
);

export const authClient = createAuthClient(clientBaseURL ? { baseURL: clientBaseURL } : undefined);
