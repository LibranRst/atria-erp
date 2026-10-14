import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ChatComposerProps } from "./chat-composer";

const motion = process.argv[2] === "reduced" ? "reduced" : "normal";
const browserWindow = new Window({
  url: "https://atria.test/ai",
  width: 390,
  settings: { device: { prefersReducedMotion: motion === "reduced" ? "reduce" : "no-preference" } },
});
// Happy DOM's partial WAAPI rejects canceled promises unlike the browser path
// expected by Motion. Exercise Motion's real JavaScript fallback instead.
Reflect.deleteProperty(browserWindow.Element.prototype, "animate");
Reflect.deleteProperty(browserWindow.HTMLElement.prototype, "animate");
const defaults = browserWindow.document.createElement("style");
defaults.textContent = "* { opacity: 1; }";
browserWindow.document.head.append(defaults);
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "HTMLTextAreaElement",
  "HTMLAnchorElement",
  "Element",
  "Node",
  "NodeFilter",
  "DocumentFragment",
  "ShadowRoot",
  "CSS",
  "Event",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
  "IntersectionObserver",
  "ResizeObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  const value: unknown = key === "window" ? browserWindow : Reflect.get(browserWindow, key);
  Reflect.set(
    globalThis,
    key,
    typeof value === "function" &&
      ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key)
      ? value.bind(browserWindow)
      : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

let externalCalls = 0;
function unexpectedExternalCall(): never {
  externalCalls++;
  throw new Error("Presentation must not call a model, save a proposal, or fetch business data.");
}
// Only boundaries requiring a real Next router or authenticated session are replaced.
// ChatTurn, ChatMessage, shared bubbles/disclosure, hooks and Framer Motion remain real.
const nextNavigation = await import("next/navigation");
mock.module("next/navigation", () => ({
  ...nextNavigation,
  useRouter: () => ({
    push: unexpectedExternalCall,
    replace: unexpectedExternalCall,
    prefetch: unexpectedExternalCall,
    refresh: unexpectedExternalCall,
    back: unexpectedExternalCall,
  }),
}));
mock.module("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ refetch: unexpectedExternalCall }) },
}));
mock.module("@/app/actions/ai/own-profile", () => ({
  getAiOwnProfileProposal: unexpectedExternalCall,
  confirmAiOwnProfileProposal: unexpectedExternalCall,
}));

mock.module("@/components/layout/top-bar-slots", () => ({
  useProvideTopBarSlots: (): void => undefined,
}));
mock.module("@/app/actions/ai/chat-history", () => ({
  getLatestAiConversation: async () => ({
    success: true,
    data: { conversationId: null, title: null, messages: [], confirmedProposals: {} },
  }),
  getAiConversation: unexpectedExternalCall,
  listAiConversations: async () => ({ success: true, data: { items: [], nextCursor: null } }),
  renameAiConversation: unexpectedExternalCall,
  deleteAiConversation: unexpectedExternalCall,
  startAiConversation: unexpectedExternalCall,
}));
mock.module("@/app/actions/ai/preferences", () => ({
  getAiCapabilities: async () => ({ success: true, data: [] }),
  saveAiPreference: unexpectedExternalCall,
  getAiPreference: async () => ({
    success: false,
    error: { code: "NOT_FOUND", message: "Fixture" },
  }),
  resetAiPreference: unexpectedExternalCall,
}));
let composer: ChatComposerProps | null = null;
mock.module("./chat-composer-dock", () => ({
  ChatComposerDock: (props: ChatComposerProps): React.JSX.Element => {
    composer = props;
    return <div>Fixture composer</div>;
  },
}));
const chunks: readonly Record<string, unknown>[] = [
  {
    type: "data-conversation",
    data: { conversationId: "00000000-0000-4000-8000-000000000123" },
    transient: true,
  },
  { type: "start", messageId: "qa-final-assistant" },
  { type: "start-step" },
  {
    type: "tool-input-available",
    toolCallId: "qa-follow-ups",
    toolName: "suggestFollowUps",
    input: { questions: ["Lihat rincian?"] },
  },
  {
    type: "tool-output-available",
    toolCallId: "qa-follow-ups",
    output: { questions: ["Lihat rincian?"] },
  },
  { type: "finish-step" },
];
const answer = "Jawaban QA harus tampil setelah stream selesai.";
const tail: readonly Record<string, unknown>[] = [
  { type: "start-step" },
  { type: "text-start", id: "qa-final-text" },
  { type: "text-delta", id: "qa-final-text", delta: answer },
  { type: "text-end", id: "qa-final-text" },
  {
    type: "data-grounded-facts",
    data: { status: "error", sources: [], coveredDomains: [], missingDomains: ["budget"] },
  },
  { type: "finish-step" },
  { type: "finish", finishReason: "stop" },
];
function encode(parts: readonly Record<string, unknown>[]): Uint8Array {
  return new TextEncoder().encode(
    parts.map((part) => "data: " + JSON.stringify(part) + "\n\n").join(""),
  );
}
let requests = 0;
let finished: (() => void) | null = null;
const completed = new Promise<void>((resolve) => {
  finished = resolve;
});
const fetchFixture: typeof fetch = Object.assign(
  async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    if (String(input) !== "/api/ai/chat") return unexpectedExternalCall();
    requests++;
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encode(chunks));
          setTimeout(() => {
            controller.enqueue(encode(tail));
            controller.close();
            finished?.();
          }, 200);
        },
      }),
      { headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" } },
    );
  },
  { preconnect: unexpectedExternalCall },
);
Reflect.set(globalThis, "fetch", fetchFixture);
const { createRoot } = await import("react-dom/client");
const { AiChatView } = await import("./ai-chat-view");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
await act(async () => {
  root.render(
    <WorkspacePresentationProvider presentation="mobile">
      <PermissionsProvider
        permissions={["use:ai_chat"]}
        user={{ id: "qa-owner", name: "QA Owner", image: null }}
      >
        <AiChatView />
      </PermissionsProvider>
    </WorkspacePresentationProvider>,
  );
});
assert.ok(composer, "composer mounted");
await act(async () => {
  composer?.onChange("Cek budget terbaru");
});
await act(async () => {
  composer?.onSubmit();
  await new Promise((resolve) => setTimeout(resolve, 50));
});
assert.equal(requests, 1, "exactly one chat request starts");
await act(async () => {
  await completed;
  await new Promise((resolve) => setTimeout(resolve, 50));
});
assert.equal(requests, 1);
assert.ok(
  host.textContent?.includes(answer),
  "final assistant text must appear without reloading history",
);
assert.equal(externalCalls, 0);
await act(async () => root.unmount());
await browserWindow.happyDOM.abort();
console.log("chat stream final response DOM passed");
