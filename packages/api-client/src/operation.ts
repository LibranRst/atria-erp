import type { WebRpcArgs, WebRpcOperation, WebRpcResult } from "@atria/api/contract";
import type { BackendConnection } from "./config";
import { requestBackendOperation, type BackendFetch, type RpcEnvelope } from "./http";

export type OperationEnvelope<K extends WebRpcOperation> =
  | (Omit<Extract<RpcEnvelope, { ok: true }>, "data"> & { data: WebRpcResult<K> })
  | Extract<RpcEnvelope, { ok: false }>;

/** The API's allowlist owns each operation; no backend runtime enters this client. */
export async function requestTypedBackendOperation<K extends WebRpcOperation>(input: {
  readonly connection: BackendConnection;
  readonly operation: K;
  readonly args: WebRpcArgs<K>;
  readonly headers: Headers;
  readonly signal?: AbortSignal;
  readonly fetcher?: BackendFetch;
}): Promise<{ readonly envelope: OperationEnvelope<K>; readonly headers: Headers }> {
  const result = await requestBackendOperation(input);
  // The envelope is runtime-validated at the untyped HTTP boundary. Its data type
  // comes from the declaration-only contract of the explicitly selected operation.
  return { envelope: result.envelope as OperationEnvelope<K>, headers: result.headers };
}
