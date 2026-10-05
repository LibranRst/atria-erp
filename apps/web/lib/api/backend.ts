import "server-only";

import type { WebRpcArgs, WebRpcOperation, WebRpcResult } from "@atria/api/contract";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { parseSetCookie } from "next/dist/compiled/@edge-runtime/cookies";

import { getBackendConnection } from "./config";
import { BackendTransportError, requestBackendOperation } from "./http";

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

/** Typed HTTP boundary for Server Actions and server-rendered reads. */
export async function callBackend<K extends WebRpcOperation>(
  operation: K,
  args: WebRpcArgs<K>,
  options: BackendCallOptions = {},
): Promise<WebRpcResult<K>> {
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("cookie", (await cookies()).toString());
  const result = await requestBackendOperation({
    connection: getBackendConnection(),
    operation,
    args,
    headers: requestHeaders,
    signal: options.signal,
  });
  if (options.allowCookieWrites) {
    const responseCookies = result.headers.getSetCookie();
    if (responseCookies.length) {
      const cookieStore = await cookies();
      for (const value of responseCookies) {
        const cookie = parseSetCookie(value);
        if (cookie) {
          // Next's bundled parser compacts falsy attributes, including Max-Age=0
          // and an empty value. Retain both so API logout/session clearing survives.
          const maxAge = value.match(/(?:^|;)\s*max-age\s*=\s*(-?\d+)\s*(?:;|$)/i)?.[1];
          cookieStore.set({
            ...cookie,
            value: cookie.value ?? "",
            ...(maxAge === undefined ? {} : { maxAge: Number(maxAge) }),
          });
        }
      }
    }
  }
  const { envelope } = result;
  if (!envelope.ok) {
    if (envelope.control?.type === "redirect") {
      if (envelope.control.permanent) permanentRedirect(envelope.control.location);
      redirect(envelope.control.location);
    }
    if (envelope.control?.type === "notFound") notFound();
    throw new BackendTransportError(envelope.error.message, envelope.error.code ?? "BACKEND_ERROR");
  }
  if (successfulAction(envelope.data)) {
    if (envelope.invalidations) {
      const seen = new Set<string>();
      for (const invalidation of envelope.invalidations) {
        const key = `${invalidation.path}:${invalidation.type ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        revalidatePath(invalidation.path, invalidation.type);
      }
    } else {
      for (const path of new Set(envelope.revalidatePaths)) revalidatePath(path);
    }
  }
  // The allowlisted operation's external response was validated above. Its data
  // type is the declaration emitted by the API, without importing its runtime.
  return envelope.data as WebRpcResult<K>;
}

/** Preserve the existing form contract when a request cannot reach or pass the bridge. */
export async function callBackendAction<K extends WebRpcOperation>(
  operation: K,
  args: WebRpcArgs<K>,
  options: BackendCallOptions = {},
): Promise<WebRpcResult<K>> {
  try {
    return await callBackend(operation, args, options);
  } catch (error: unknown) {
    // Navigation throws belong to Next. Only a transport/backend error becomes
    // a form failure; the generated facade selects this adapter for ActionResponse.
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
    return response as WebRpcResult<K>;
  }
}
