"use client";

import React from "react";

import { saveVendorBillDraft, type VendorBillDraftRecord } from "@/app/actions/finance/vendor-bill-drafts";
import { serializeLocalFormRecovery } from "@/lib/forms/local-form-recovery";
import { vendorBillDraftPayloadSchema, type VendorBillDraftPayload } from "@/lib/validations/vendor-bill-draft";

const KEY_PREFIX = "atria:vendor-bill-draft";
const SCHEMA_VERSION = 1;
const SAVE_DELAY_MS = 1_200;

export type VendorBillDraftStatus = "idle" | "dirty" | "saving" | "saved" | "offline" | "conflict" | "error";
type SaveResult =
  | { readonly success: true; readonly record: VendorBillDraftRecord }
  | { readonly success: false; readonly reason: "offline" | "conflict" | "error"; readonly message: string };

type LocalPayload = {
  readonly draftId: string | null;
  readonly revision: number | null;
  readonly form: VendorBillDraftPayload;
};

function storageKey(): string { return `${KEY_PREFIX}:active`; }

function readLocal(): LocalPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return null;
    const wrapper: unknown = JSON.parse(raw);
    if (!wrapper || typeof wrapper !== "object") return null;
    const candidate = wrapper as { readonly schemaVersion?: unknown; readonly payload?: unknown };
    if (candidate.schemaVersion !== SCHEMA_VERSION || !candidate.payload || typeof candidate.payload !== "object") return null;
    const payload = candidate.payload as { readonly draftId?: unknown; readonly revision?: unknown; readonly form?: unknown };
    const parsed = vendorBillDraftPayloadSchema.safeParse(payload.form);
    if (!parsed.success) return null;
    return {
      draftId: typeof payload.draftId === "string" ? payload.draftId : null,
      revision: typeof payload.revision === "number" ? payload.revision : null,
      form: parsed.data,
    };
  } catch { return null; }
}

export function useHybridVendorBillDraft(initialPayload: VendorBillDraftPayload): {
  readonly payload: VendorBillDraftPayload;
  readonly draftId: string | null;
  readonly revision: number | null;
  readonly status: VendorBillDraftStatus;
  readonly statusLabel: string;
  readonly errorMessage: string | null;
  readonly isDirty: boolean;
  readonly updatePayload: React.Dispatch<React.SetStateAction<VendorBillDraftPayload>>;
  readonly hydrate: (record: VendorBillDraftRecord) => void;
  readonly saveNow: () => Promise<SaveResult>;
  readonly saveAsCopy: () => Promise<SaveResult>;
  readonly reset: (payload: VendorBillDraftPayload) => void;
  readonly clear: () => void;
} {
  const recovered = React.useMemo(() => readLocal(), []);
  const [payload, setPayload] = React.useState(recovered?.form ?? initialPayload);
  const [draftId, setDraftId] = React.useState<string | null>(recovered?.draftId ?? null);
  const [revision, setRevision] = React.useState<number | null>(recovered?.revision ?? null);
  const [status, setStatus] = React.useState<VendorBillDraftStatus>(recovered ? "dirty" : "idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(Boolean(recovered));
  const payloadRef = React.useRef(payload);
  const draftIdRef = React.useRef(draftId);
  const revisionRef = React.useRef(revision);
  const versionRef = React.useRef(recovered ? 1 : 0);
  const savedVersionRef = React.useRef(0);
  const inFlightRef = React.useRef<Promise<SaveResult> | null>(null);

  const persist = React.useCallback((form: VendorBillDraftPayload, id: string | null, rev: number | null): void => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey(), serializeLocalFormRecovery({ payload: { form, draftId: id, revision: rev }, schemaVersion: SCHEMA_VERSION }));
  }, []);

  const updatePayload = React.useCallback<React.Dispatch<React.SetStateAction<VendorBillDraftPayload>>>((update) => {
    const next = typeof update === "function" ? update(payloadRef.current) : update;
    payloadRef.current = next;
    setPayload(next);
    versionRef.current += 1;
    setDirty(true);
    setErrorMessage(null);
    setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "dirty");
    persist(next, draftIdRef.current, revisionRef.current);
  }, [persist]);

  const performSave = React.useCallback(async (asCopy: boolean): Promise<SaveResult> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return { success: false, reason: "offline", message: "Offline. Data tetap aman di perangkat ini." };
    }
    if (inFlightRef.current) return inFlightRef.current;
    const capturedVersion = versionRef.current;
    setStatus("saving");
    const request = saveVendorBillDraft({
      draftId: asCopy ? undefined : draftIdRef.current ?? undefined,
      expectedRevision: asCopy ? undefined : revisionRef.current ?? undefined,
      payload: payloadRef.current,
    }).then<SaveResult>((response) => {
      if (!response.success) {
        const conflict = response.error.code === "CONFLICT";
        setStatus(conflict ? "conflict" : "error");
        setErrorMessage(response.error.message);
        return { success: false, reason: conflict ? "conflict" : "error", message: response.error.message };
      }
      draftIdRef.current = response.data.id;
      revisionRef.current = response.data.revision;
      setDraftId(response.data.id);
      setRevision(response.data.revision);
      savedVersionRef.current = capturedVersion;
      const newer = versionRef.current !== capturedVersion;
      setDirty(newer);
      setStatus(newer ? "dirty" : "saved");
      persist(payloadRef.current, response.data.id, response.data.revision);
      return { success: true, record: response.data };
    });
    inFlightRef.current = request;
    const result = await request;
    inFlightRef.current = null;
    return result;
  }, [persist]);

  const hydrate = React.useCallback((record: VendorBillDraftRecord): void => {
    payloadRef.current = record.payload;
    draftIdRef.current = record.id;
    revisionRef.current = record.revision;
    versionRef.current = 0;
    savedVersionRef.current = 0;
    setPayload(record.payload);
    setDraftId(record.id);
    setRevision(record.revision);
    setStatus("saved");
    setDirty(false);
    setErrorMessage(null);
    persist(record.payload, record.id, record.revision);
  }, [persist]);

  const clear = React.useCallback((): void => {
    if (typeof window !== "undefined") window.localStorage.removeItem(storageKey());
    setDirty(false);
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const reset = React.useCallback((next: VendorBillDraftPayload): void => {
    clear();
    payloadRef.current = next;
    draftIdRef.current = null;
    revisionRef.current = null;
    versionRef.current = 0;
    savedVersionRef.current = 0;
    setPayload(next);
    setDraftId(null);
    setRevision(null);
  }, [clear]);

  React.useEffect(() => {
    if (status !== "dirty") return undefined;
    const timer = window.setTimeout(() => { void performSave(false); }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [payload, performSave, status]);

  React.useEffect(() => {
    function offline(): void { if (versionRef.current !== savedVersionRef.current) setStatus("offline"); }
    function online(): void { if (versionRef.current !== savedVersionRef.current) setStatus("dirty"); }
    window.addEventListener("offline", offline); window.addEventListener("online", online);
    return () => { window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, []);

  React.useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent): void {
      if (!dirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  return {
    payload, draftId, revision, status,
    statusLabel: { idle: "Belum ada perubahan", dirty: "Belum tersinkron", saving: "Menyimpan…", saved: "Draft tersimpan", offline: "Offline · aman di perangkat", conflict: "Ada versi server lebih baru", error: "Draft belum tersimpan" }[status],
    errorMessage, isDirty: dirty, updatePayload, hydrate,
    saveNow: () => performSave(false), saveAsCopy: () => performSave(true), reset, clear,
  };
}
