import Constants from "expo-constants";
import { resolveRuntimeURL } from "./runtime-url";

export function getApiBaseURL(): string {
  return resolveRuntimeURL(
    "api",
    process.env.EXPO_PUBLIC_API_URL,
    Constants.expoConfig?.hostUri,
    __DEV__,
  );
}

export function getWebBaseURL(): string {
  return resolveRuntimeURL(
    "web",
    process.env.EXPO_PUBLIC_WEB_URL,
    Constants.expoConfig?.hostUri,
    __DEV__,
  );
}
