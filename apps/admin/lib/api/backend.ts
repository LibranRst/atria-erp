import "server-only";

import type { WebRpcArgs, WebRpcOperation, WebRpcResult } from "@atria/api/contract";
import type { ActionResponse } from "@atria/core/types/action-response";
import { BackendTransportError, requestTypedBackendOperation } from "@atria/api-client";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { parseSetCookie } from "next/dist/compiled/@edge-runtime/cookies";

import { getBackendConnection } from "./config";
import { adminBackendHeaders, adminSetCookie } from "./admin-cookies";
import { adminInvalidations, safeAdminReturnTo } from "../navigation/paths";

export interface BackendCallOptions {
  readonly allowCookieWrites?: boolean;
  readonly signal?: AbortSignal;
}

function successfulAction(data: unknown): boolean {
  return !(
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    data.success === false
  );
}

export async function callBackendData<K extends WebRpcOperation>(
  operation: K,
  args: WebRpcArgs<K>,
  options: BackendCallOptions = {},
): Promise<WebRpcResult<K>> {
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("cookie", (await cookies()).toString());
  const { envelope, headers: responseHeaders } = await requestTypedBackendOperation({
    connection: getBackendConnection(),
    operation,
    args,
    headers: adminBackendHeaders(requestHeaders),
    signal: options.signal,
  });
  if (options.allowCookieWrites) {
    const cookieStore = await cookies();
    for (const rawCookie of responseHeaders.getSetCookie()) {
      const value = adminSetCookie(rawCookie);
      const cookie = parseSetCookie(value);
      if (!cookie) continue;
      const maxAge = value.match(/(?:^|;)\s*max-age\s*=\s*(-?\d+)\s*(?:;|$)/i)?.[1];
      cookieStore.set({
        ...cookie,
        value: cookie.value ?? "",
        ...(maxAge === undefined ? {} : { maxAge: Number(maxAge) }),
      });
    }
  }
  if (!envelope.ok) {
    if (envelope.control?.type === "redirect") {
      const destination =
        envelope.control.location === "/login"
          ? "/login"
          : safeAdminReturnTo(envelope.control.location);
      if (envelope.control.permanent) permanentRedirect(destination);
      redirect(destination);
    }
    if (envelope.control?.type === "notFound") notFound();
    throw new BackendTransportError(envelope.error.message, envelope.error.code ?? "BACKEND_ERROR");
  }
  if (successfulAction(envelope.data) && options.allowCookieWrites) {
    const invalidations =
      envelope.invalidations ?? envelope.revalidatePaths.map((path) => ({ path }));
    const seen = new Set<string>();
    for (const invalidation of invalidations) {
      for (const target of adminInvalidations(invalidation)) {
        const key = `${target.type ?? ""}:${target.path}`;
        if (!seen.has(key)) {
          seen.add(key);
          revalidatePath(target.path, target.type);
        }
      }
    }
  }
  return envelope.data;
}

/** The same API action response reaches forms; transport failures never trigger retries. */
export async function callBackendAction<K extends WebRpcOperation>(
  operation: K,
  args: WebRpcArgs<K>,
  options: BackendCallOptions = {},
): Promise<WebRpcResult<K>> {
  try {
    return await callBackendData(operation, args, {
      ...options,
      allowCookieWrites: options.allowCookieWrites ?? true,
    });
  } catch (error: unknown) {
    if (!(error instanceof BackendTransportError)) throw error;
    const response: ActionResponse<never> = {
      success: false,
      error: {
        code:
          error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN"
            ? error.code
            : "INTERNAL_SERVER_ERROR",
        message: error.message,
      },
    };
    // An HTTP failure has no operation result; ActionResponse operations share this error contract.
    return response as WebRpcResult<K>;
  }
}
