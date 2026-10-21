"use client";

import React from "react";

import { saveExpenseDraft, type ExpenseDraftRecord } from "@/app/actions/finance/expense-drafts";
import type { ExpenseDraftPayload } from "@/features/expenses/types/expense-form-types";
import { expenseDraftPayloadSchema } from "@atria/core/validations/expense-draft";

const LOCAL_KEY_PREFIX = "atria:expense-draft";
const AUTOSAVE_DELAY_MS = 1_200;

export type ExpenseDraftSyncStatus =
  "idle" | "dirty" | "saving" | "saved" | "offline" | "conflict" | "error";

type LocalExpenseRecovery = {
  readonly payload: ExpenseDraftPayload;
  readonly draftId: string | null;
  readonly revision: number | null;
  readonly changedAt: string;
};

type SaveResult =
  | { readonly success: true; readonly record: ExpenseDraftRecord }
  | {
      readonly success: false;
      readonly reason: "offline" | "conflict" | "error";
      readonly message: string;
    };

function storageKey(draftId: string | null): string {
  return `${LOCAL_KEY_PREFIX}:${draftId ?? "new"}`;
}

export function parseLocalExpenseRecovery(raw: string): LocalExpenseRecovery | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<LocalExpenseRecovery>;
    const payload = expenseDraftPayloadSchema.safeParse(candidate.payload);
    if (!payload.success) return null;
    return {
      payload: payload.data,
      draftId: typeof candidate.draftId === "string" ? candidate.draftId : null,
      revision: typeof candidate.revision === "number" ? candidate.revision : null,
      changedAt:
        typeof candidate.changedAt === "string" ? candidate.changedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function readRecoveryFromKey(key: string): LocalExpenseRecovery | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  return parseLocalExpenseRecovery(raw);
}

export function readLocalExpenseRecovery(
  draftId: string | null = null,
): LocalExpenseRecovery | null {
  return readRecoveryFromKey(storageKey(draftId));
}

export function clearAllExpenseRecoveries(): void {
  if (typeof window === "undefined") return;
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(`${LOCAL_KEY_PREFIX}:`)) {
      window.localStorage.removeItem(key);
    }
  }
}

export function useHybridExpenseDraft(
  initialPayload: ExpenseDraftPayload,
  recoverLocal = true,
  projectScope?: string,
): {
  readonly payload: ExpenseDraftPayload;
  readonly draftId: string | null;
  readonly revision: number | null;
  readonly status: ExpenseDraftSyncStatus;
  readonly statusLabel: string;
  readonly errorMessage: string | null;
  readonly isDirty: boolean;
  readonly updatePayload: (
    update: ExpenseDraftPayload | ((current: ExpenseDraftPayload) => ExpenseDraftPayload),
  ) => void;
  readonly hydrate: (record: ExpenseDraftRecord) => void;
  readonly reset: (payload: ExpenseDraftPayload) => void;
  readonly saveNow: () => Promise<SaveResult>;
  readonly saveAsCopy: () => Promise<SaveResult>;
  readonly clearRecovery: () => void;
} {
  const recovered = React.useMemo(
    () => (recoverLocal ? readLocalExpenseRecovery(null) : null),
    [recoverLocal],
  );
  const [payload, setPayload] = React.useState<ExpenseDraftPayload>(
    () => recovered?.payload ?? initialPayload,
  );
  const [draftId, setDraftId] = React.useState<string | null>(recovered?.draftId ?? null);
  const [revision, setRevision] = React.useState<number | null>(recovered?.revision ?? null);
  const [status, setStatus] = React.useState<ExpenseDraftSyncStatus>(recovered ? "dirty" : "idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(Boolean(recovered));
  const payloadRef = React.useRef(payload);
  const draftIdRef = React.useRef(draftId);
  const revisionRef = React.useRef(revision);
  const changeVersionRef = React.useRef(recovered ? 1 : 0);
  const savedVersionRef = React.useRef(0);
  const inFlightRef = React.useRef<Promise<SaveResult> | null>(null);

  const persistLocal = React.useCallback(
    (
      nextPayload: ExpenseDraftPayload,
      nextDraftId: string | null,
      nextRevision: number | null,
    ): void => {
      if (typeof window === "undefined") return;
      const recovery: LocalExpenseRecovery = {
        payload: nextPayload,
        draftId: nextDraftId,
        revision: nextRevision,
        changedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(storageKey(nextDraftId), JSON.stringify(recovery));
      if (nextDraftId) window.localStorage.removeItem(storageKey(null));
    },
    [],
  );

  const updatePayload = React.useCallback(
    (
      update: ExpenseDraftPayload | ((current: ExpenseDraftPayload) => ExpenseDraftPayload),
    ): void => {
      const nextPayload = typeof update === "function" ? update(payloadRef.current) : update;
      payloadRef.current = nextPayload;
      setPayload(nextPayload);
      changeVersionRef.current += 1;
      setDirty(true);
      setErrorMessage(null);
      const online = typeof navigator === "undefined" || navigator.onLine;
      setStatus(online ? "dirty" : "offline");
      persistLocal(nextPayload, draftIdRef.current, revisionRef.current);
    },
    [persistLocal],
  );

  const performSave = React.useCallback(
    async (asCopy: boolean): Promise<SaveResult> => {
      if (projectScope && payloadRef.current.projectId !== projectScope)
        return {
          success: false,
          reason: "error",
          message: "Draft berasal dari proyek lain. Lanjutkan melalui halaman Pengeluaran.",
        };
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus("offline");
        return {
          success: false,
          reason: "offline",
          message: "Tidak ada koneksi. Perubahan tetap aman di perangkat ini.",
        };
      }

      if (inFlightRef.current) return inFlightRef.current;
      const capturedVersion = changeVersionRef.current;
      const currentPayload = payloadRef.current;
      const currentDraftId = asCopy ? null : draftIdRef.current;
      const currentRevision = asCopy ? null : revisionRef.current;
      setStatus("saving");
      setErrorMessage(null);

      const request = saveExpenseDraft({
        draftId: currentDraftId ?? undefined,
        expectedRevision: currentRevision ?? undefined,
        payload: currentPayload,
      }).then<SaveResult>((response) => {
        if (!response.success) {
          const isConflict = response.error.code === "CONFLICT";
          setStatus(isConflict ? "conflict" : "error");
          setDirty(true);
          setErrorMessage(response.error.message);
          return {
            success: false,
            reason: isConflict ? "conflict" : "error",
            message: response.error.message,
          };
        }

        const previousId = draftIdRef.current;
        draftIdRef.current = response.data.id;
        revisionRef.current = response.data.revision;
        setDraftId(response.data.id);
        setRevision(response.data.revision);
        savedVersionRef.current = capturedVersion;
        persistLocal(currentPayload, response.data.id, response.data.revision);
        if (previousId && previousId !== response.data.id && typeof window !== "undefined") {
          window.localStorage.removeItem(storageKey(previousId));
        }
        const hasNewerChanges = changeVersionRef.current !== capturedVersion;
        setDirty(hasNewerChanges);
        setStatus(hasNewerChanges ? "dirty" : "saved");
        return { success: true, record: response.data };
      });

      inFlightRef.current = request;
      const result = await request;
      inFlightRef.current = null;
      return result;
    },
    [persistLocal, projectScope],
  );

  const saveNow = React.useCallback((): Promise<SaveResult> => performSave(false), [performSave]);
  const saveAsCopy = React.useCallback((): Promise<SaveResult> => performSave(true), [performSave]);

  const hydrate = React.useCallback(
    (record: ExpenseDraftRecord): void => {
      payloadRef.current = record.payload;
      draftIdRef.current = record.id;
      revisionRef.current = record.revision;
      changeVersionRef.current = 0;
      savedVersionRef.current = 0;
      setPayload(record.payload);
      setDraftId(record.id);
      setRevision(record.revision);
      setStatus("saved");
      setDirty(false);
      setErrorMessage(null);
      persistLocal(record.payload, record.id, record.revision);
    },
    [persistLocal],
  );

  const clearRecovery = React.useCallback((): void => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey(draftIdRef.current));
      window.localStorage.removeItem(storageKey(null));
    }
    changeVersionRef.current = 0;
    savedVersionRef.current = 0;
    setStatus("idle");
    setDirty(false);
    setErrorMessage(null);
  }, []);

  const reset = React.useCallback((nextPayload: ExpenseDraftPayload): void => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey(draftIdRef.current));
      window.localStorage.removeItem(storageKey(null));
    }
    payloadRef.current = nextPayload;
    draftIdRef.current = null;
    revisionRef.current = null;
    changeVersionRef.current = 0;
    savedVersionRef.current = 0;
    setPayload(nextPayload);
    setDraftId(null);
    setRevision(null);
    setStatus("idle");
    setDirty(false);
    setErrorMessage(null);
  }, []);

  React.useEffect(() => {
    if (status !== "dirty" || (projectScope && payload.projectId !== projectScope))
      return undefined;
    const timeout = window.setTimeout(() => {
      void saveNow();
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [payload, projectScope, saveNow, status]);

  React.useEffect(() => {
    function handleOffline(): void {
      if (changeVersionRef.current !== savedVersionRef.current) setStatus("offline");
    }
    function handleOnline(): void {
      if (changeVersionRef.current !== savedVersionRef.current) setStatus("dirty");
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const statusLabel: Record<ExpenseDraftSyncStatus, string> = {
    idle: "Belum ada perubahan",
    dirty: "Belum tersinkron",
    saving: "Menyimpan…",
    saved: "Draft tersimpan",
    offline: "Offline · aman di perangkat",
    conflict: "Ada versi lebih baru",
    error: "Draft belum tersimpan",
  };

  return {
    payload,
    draftId,
    revision,
    status,
    statusLabel: statusLabel[status],
    errorMessage,
    isDirty: dirty,
    updatePayload,
    hydrate,
    reset,
    saveNow,
    saveAsCopy,
    clearRecovery,
  };
}
