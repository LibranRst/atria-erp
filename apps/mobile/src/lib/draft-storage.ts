import type { ExpenseDraftPayloadInput } from "@atria/core/validations/expense-draft";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { MMKV } from "react-native-mmkv";

let nativeStoragePromise: Promise<MMKV> | null = null;

async function getNativeStorage(): Promise<MMKV> {
  nativeStoragePromise ??= import("react-native-mmkv").then(({ createMMKV }) =>
    createMMKV({ id: "atria-drafts" }),
  );
  return nativeStoragePromise;
}

function usesExpoGoFallback(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export type LocalExpenseDraft = {
  readonly draftId: string | null;
  readonly revision: number | null;
  readonly payload: ExpenseDraftPayloadInput;
  readonly savedAt: string;
};

function expenseDraftKey(userId: string): string {
  return `expense:${userId}`;
}

export async function readLocalExpenseDraft(userId: string): Promise<LocalExpenseDraft | null> {
  const key = expenseDraftKey(userId);
  const raw = usesExpoGoFallback()
    ? await AsyncStorage.getItem(key)
    : (await getNativeStorage()).getString(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !("payload" in parsed)) return null;
    return parsed as LocalExpenseDraft;
  } catch {
    return null;
  }
}

export async function writeLocalExpenseDraft(
  userId: string,
  draft: LocalExpenseDraft,
): Promise<void> {
  const key = expenseDraftKey(userId);
  const value = JSON.stringify(draft);
  if (usesExpoGoFallback()) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  (await getNativeStorage()).set(key, value);
}

export async function clearLocalExpenseDraft(userId: string): Promise<void> {
  const key = expenseDraftKey(userId);
  if (usesExpoGoFallback()) {
    await AsyncStorage.removeItem(key);
    return;
  }
  (await getNativeStorage()).remove(key);
}
