"use client";

import { workspaceHistoryHref } from "@/lib/navigation/workspace-routes";
import { useCallback, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

const URL_CHANGE_EVENT = "atria:urlchange";
let historyEventsPatched = false;
let pendingUrlChange = false;

function emitUrlChange(): void {
  if (pendingUrlChange) return;
  pendingUrlChange = true;
  window.setTimeout(() => {
    pendingUrlChange = false;
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
  }, 0);
}

function patchHistoryMethod(method: "pushState" | "replaceState"): void {
  const original = window.history[method];
  window.history[method] = function patchedHistoryMethod(
    this: History,
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ): void {
    original.call(this, data, unused, url);
    emitUrlChange();
  } as History[typeof method];
}

function ensureHistoryEventsPatched(): void {
  if (typeof window === "undefined" || historyEventsPatched) return;
  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");
  historyEventsPatched = true;
}

export function subscribeToUrl(onStoreChange: () => void): () => void {
  ensureHistoryEventsPatched();
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(URL_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(URL_CHANGE_EVENT, onStoreChange);
  };
}

function getUrlSnapshot(): string {
  return window.location.search;
}

/**
 * A custom hook to listen to URL search parameters.
 * It combines Next.js useSearchParams for initial load and SSR
 * with browser history listeners for Link, pushState, replaceState, and back/forward changes.
 */
export function useUrlSearchParam(key: string): string | null {
  const nextSearchParams = useSearchParams();
  const serverSearch = `?${nextSearchParams.toString()}`;
  const getServerSnapshot = useCallback(() => serverSearch, [serverSearch]);
  const search = useSyncExternalStore(subscribeToUrl, getUrlSnapshot, getServerSnapshot);

  return new URLSearchParams(search).get(key);
}

export function useBrowserUrlSearchParam(
  key: string,
  initialValue: string | null = null,
): string | null {
  const getServerSnapshot = useCallback(() => {
    return initialValue === null ? "" : `?${new URLSearchParams([[key, initialValue]]).toString()}`;
  }, [initialValue, key]);
  const search = useSyncExternalStore(subscribeToUrl, getUrlSnapshot, getServerSnapshot);

  return new URLSearchParams(search).get(key);
}

export function updateUrlSearchParam(
  key: string,
  value: string | null,
  mode: "push" | "replace" = "push",
): string {
  const params = new URLSearchParams(window.location.search);
  if (value === null) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  if (mode === "replace") {
    window.history.replaceState({}, "", nextUrl);
  } else {
    window.history.pushState({}, "", nextUrl);
  }
  return nextUrl;
}

export function updateBrowserUrl(nextUrl: string, mode: "push" | "replace" = "push"): void {
  const href = workspaceHistoryHref(nextUrl, window.location.href);
  if (mode === "replace") {
    window.history.replaceState({}, "", href);
  } else {
    window.history.pushState({}, "", href);
  }
}
