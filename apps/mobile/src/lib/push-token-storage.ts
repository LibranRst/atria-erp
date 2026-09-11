import AsyncStorage from "@react-native-async-storage/async-storage";

const PUSH_TOKEN_KEY = "atria:expo-push-registration";

export type StoredPushToken = {
  readonly platform: "EXPO_IOS" | "EXPO_ANDROID";
  readonly token: string;
};

export async function readStoredPushToken(): Promise<StoredPushToken | null> {
  const raw = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "platform" in parsed &&
      (parsed.platform === "EXPO_IOS" || parsed.platform === "EXPO_ANDROID") &&
      "token" in parsed &&
      typeof parsed.token === "string"
    ) {
      return { platform: parsed.platform, token: parsed.token };
    }
  } catch {
    // Invalid local registration is discarded below.
  }
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  return null;
}

export async function writeStoredPushToken(value: StoredPushToken): Promise<void> {
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, JSON.stringify(value));
}

export async function clearStoredPushToken(): Promise<void> {
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}
