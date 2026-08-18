import Constants from "expo-constants";

function getDevelopmentServerURL(): string | null {
  if (!__DEV__) return null;

  const hostUri = Constants.expoConfig?.hostUri;
  const hostname = hostUri?.split(":")[0];
  return hostname ? `http://${hostname}:3000` : null;
}

export function getApiBaseURL(): string {
  const configuredURL = process.env.EXPO_PUBLIC_API_URL?.trim();
  const baseURL = configuredURL || getDevelopmentServerURL();

  if (!baseURL) {
    throw new Error("EXPO_PUBLIC_API_URL wajib diisi untuk build non-development.");
  }

  return baseURL.replace(/\/$/, "");
}
