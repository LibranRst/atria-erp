"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/chat-history";

export async function getLatestAiConversation(
  ...args: WebRpcArgs<"app/actions/ai/chat-history.getLatestAiConversation">
): Promise<WebRpcResult<"app/actions/ai/chat-history.getLatestAiConversation">> {
  return callBackendAction("app/actions/ai/chat-history.getLatestAiConversation", args, {
    allowCookieWrites: true,
  });
}

export async function getAiConversation(
  ...args: WebRpcArgs<"app/actions/ai/chat-history.getAiConversation">
): Promise<WebRpcResult<"app/actions/ai/chat-history.getAiConversation">> {
  return callBackendAction("app/actions/ai/chat-history.getAiConversation", args, {
    allowCookieWrites: true,
  });
}

export async function listAiConversations(
  ...args: WebRpcArgs<"app/actions/ai/chat-history.listAiConversations">
): Promise<WebRpcResult<"app/actions/ai/chat-history.listAiConversations">> {
  return callBackendAction("app/actions/ai/chat-history.listAiConversations", args, {
    allowCookieWrites: true,
  });
}

export async function renameAiConversation(
  ...args: WebRpcArgs<"app/actions/ai/chat-history.renameAiConversation">
): Promise<WebRpcResult<"app/actions/ai/chat-history.renameAiConversation">> {
  return callBackendAction("app/actions/ai/chat-history.renameAiConversation", args, {
    allowCookieWrites: true,
  });
}

export async function deleteAiConversation(
  ...args: WebRpcArgs<"app/actions/ai/chat-history.deleteAiConversation">
): Promise<WebRpcResult<"app/actions/ai/chat-history.deleteAiConversation">> {
  return callBackendAction("app/actions/ai/chat-history.deleteAiConversation", args, {
    allowCookieWrites: true,
  });
}

export async function startAiConversation(
  ...args: WebRpcArgs<"app/actions/ai/chat-history.startAiConversation">
): Promise<WebRpcResult<"app/actions/ai/chat-history.startAiConversation">> {
  return callBackendAction("app/actions/ai/chat-history.startAiConversation", args, {
    allowCookieWrites: true,
  });
}
