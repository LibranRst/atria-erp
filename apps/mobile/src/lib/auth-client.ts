import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { getApiBaseURL } from "@/lib/runtime-config";

export const authClient = createAuthClient({
  baseURL: getApiBaseURL(),
  plugins: [
    expoClient({
      scheme: "atria",
      storagePrefix: "atria",
      storage: SecureStore,
    }),
  ],
});

export function getSessionBearerToken(): string | null {
  const sessionCookie = authClient.getCookie();

  for (const cookie of sessionCookie.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    const name = rawName.replace(/^__Secure-/, "");
    if (name !== "better-auth.session_token") continue;

    const value = rawValue.join("=");
    return value ? decodeURIComponent(value) : null;
  }

  return null;
}
