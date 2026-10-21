import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ChatComposerProps } from "./chat-composer";

const motion = process.argv[2] === "reduced" ? "reduced" : "normal";
const introductionOnly = process.argv[3] === "intro-only";
const partialReadEof = process.argv[3] === "read-card-eof";
const scrolling = process.argv[3] === "scroll-mobile" || process.argv[3] === "scroll-desktop";
const width = process.argv[3] === "scroll-desktop" ? 1280 : 390;
const browserWindow = new Window({
  url: "https://atria.test/ai",
  width,
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
  "sessionStorage",
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

// SDK integration owns browser geometry/timing, while AiChatView and its actual
// scroll hook remain intact. Other scenarios keep Happy DOM's normal scheduling.
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
class ManualResizeObserver implements ResizeObserver {
  static readonly instances = new Set<ManualResizeObserver>();
  readonly targets = new Set<Element>();
  readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ManualResizeObserver.instances.add(this);
  }
  observe(target: Element): void {
    this.targets.add(target);
  }
  unobserve(target: Element): void {
    this.targets.delete(target);
  }
  disconnect(): void {
    this.targets.clear();
    ManualResizeObserver.instances.delete(this);
  }
}
if (scrolling) {
  Reflect.set(globalThis, "ResizeObserver", ManualResizeObserver);
  Reflect.set(globalThis, "requestAnimationFrame", (callback: FrameRequestCallback): number => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  });
  Reflect.set(globalThis, "cancelAnimationFrame", (id: number): void => {
    frames.delete(id);
  });
}

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
const opening: readonly Record<string, unknown>[] = [
  {
    type: "data-conversation",
    data: { conversationId: "00000000-0000-4000-8000-000000000123" },
    transient: true,
  },
  { type: "start", messageId: "qa-final-assistant" },
  {
    type: "data-assistant-introduction",
    id: "qa-model-intro",
    data: { text: "Aku akan meninjau permintaan QA, lalu menyiapkan jawabannya." },
  },
];
const chunks: readonly Record<string, unknown>[] = introductionOnly
  ? opening
  : partialReadEof
    ? [
        ...opening,
        { type: "start-step" },
        {
          type: "tool-input-available",
          toolCallId: "qa-bank-read",
          toolName: "getBankBalances",
          input: {},
        },
        {
          type: "tool-output-available",
          toolCallId: "qa-bank-read",
          output: {
            totalAvailable: { amount: 10000, formatted: "Rp 10.000" },
            accounts: [
              {
                accountName: "Rekening QA",
                bankName: "Bank QA",
                balance: { amount: 10000, formatted: "Rp 10.000" },
              },
            ],
          },
        },
        { type: "finish-step" },
      ]
    : [
        ...opening,
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
const tail: readonly Record<string, unknown>[] = partialReadEof
  ? []
  : introductionOnly
    ? [{ type: "finish", finishReason: "stop" }]
    : [
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
let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
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
          if (scrolling) {
            streamController = controller;
            return;
          }
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
const { readWorkspaceSession } = await import("../utils/workspace-session");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
await act(async () => {
  root.render(
    <WorkspacePresentationProvider presentation={width >= 1024 ? "desktop" : "mobile"}>
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

let position = 0;
let contentHeight = 0;
const clientHeight = width >= 1024 ? 800 : 600;
const anchorOffset = clientHeight - 100;
const writes: number[] = [];
const viewport = host.querySelector<HTMLDivElement>(
  "div.no-scrollbar.overflow-y-auto.overscroll-contain",
);
const content = viewport?.firstElementChild;
if (scrolling) {
  assert.ok(viewport);
  assert.ok(content);
  contentHeight = clientHeight;
  Object.defineProperties(viewport, {
    scrollHeight: { get: (): number => contentHeight },
    clientHeight: { get: (): number => clientHeight },
    scrollTop: {
      get: (): number => position,
      set: (value: number): void => {
        const next = Math.min(Math.max(0, contentHeight - clientHeight), Math.max(0, value));
        const changed = next !== position;
        position = next;
        writes.push(position);
        if (changed) viewport.dispatchEvent(new Event("scroll"));
      },
    },
  });
  viewport.getBoundingClientRect = (): DOMRect =>
    new browserWindow.DOMRect(0, 0, width, clientHeight);
  viewport.scrollTo = (options?: ScrollToOptions | number, y?: number): void => {
    viewport.scrollTop = typeof options === "number" ? (y ?? 0) : (options?.top ?? 0);
  };
}
async function flushFrames(): Promise<void> {
  for (let pass = 0; pass < 3; pass++) {
    await act(async (): Promise<void> => {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(performance.now());
    });
  }
}
async function resizeContent(): Promise<void> {
  await act(async (): Promise<void> => {
    for (const observer of [...ManualResizeObserver.instances])
      if (content && observer.targets.has(content)) observer.callback([], observer);
  });
  await flushFrames();
}
async function deliver(parts: readonly Record<string, unknown>[], finish = false): Promise<void> {
  assert.ok(streamController, "the real SDK transport must have opened the stream");
  await act(async (): Promise<void> => {
    streamController?.enqueue(encode(parts));
    if (finish) {
      streamController?.close();
      finished?.();
    }
    await new Promise<void>((resolve): void => {
      setTimeout(resolve, 25);
    });
  });
  await flushFrames();
}
await act(async () => {
  composer?.onChange("Cek budget terbaru");
});
await act(async () => {
  composer?.onSubmit();
  await new Promise((resolve) => setTimeout(resolve, 50));
});
assert.equal(requests, 1, "exactly one chat request starts");
if (scrolling) {
  assert.ok(viewport);
  const anchor = viewport.querySelector<HTMLElement>("[data-chat-user-message]");
  assert.ok(anchor);
  anchor.getBoundingClientRect = (): DOMRect =>
    new browserWindow.DOMRect(0, anchorOffset - position, width, 48);
  await flushFrames();
  const inset = Number.parseFloat(getComputedStyle(viewport).paddingTop) || 0;
  const readingCap = Math.max(0, anchorOffset - inset);

  // The server id arrives only after the new question is present. Its promotion
  // must not reuse initial/history bottom alignment as an implicit reader action.
  contentHeight = clientHeight + 900;
  await deliver([
    ...opening,
    { type: "start-step" },
    { type: "text-start", id: "qa-final-text" },
    {
      type: "text-delta",
      id: "qa-final-text",
      delta: answer + "\n\n" + "Rincian QA. ".repeat(100),
    },
  ]);
  await resizeContent();
  assert.ok(
    [...ManualResizeObserver.instances].some(
      (observer): boolean =>
        content !== null && content !== undefined && observer.targets.has(content),
    ),
    "the real streaming hook observes the actual transcript content",
  );
  assert.equal(
    position,
    readingCap,
    "server conversation id promotion preserves question-capped following",
  );
  assert.ok(
    writes.every((write): boolean => write <= readingCap),
    "no intermediate promotion write jumps below the new question",
  );

  contentHeight += 1200;
  await deliver([
    {
      type: "text-delta",
      id: "qa-final-text",
      delta: "\n\n" + "Analisis lanjutan QA. ".repeat(150),
    },
  ]);
  await resizeContent();
  assert.equal(position, readingCap, "long streamed content stops at the question reading inset");
  assert.equal(
    anchor.getBoundingClientRect().top,
    inset,
    "the latest question stays at the reading top",
  );

  await deliver([
    { type: "text-end", id: "qa-final-text" },
    {
      type: "tool-input-available",
      toolCallId: "qa-balance",
      toolName: "getBankBalances",
      input: {},
    },
    {
      type: "tool-output-available",
      toolCallId: "qa-balance",
      output: {
        totalAvailable: { amount: 10000, formatted: "Rp 10.000" },
        accounts: [
          {
            accountName: "Rekening QA",
            bankName: "Bank QA",
            balance: { amount: 10000, formatted: "Rp 10.000" },
          },
        ],
      },
    },
    { type: "finish-step" },
  ]);
  assert.equal(
    host.textContent?.includes("Saldo rekening"),
    false,
    "the actual result card waits for completion",
  );
  contentHeight += 700;
  await deliver([{ type: "finish", finishReason: "stop" }], true);
  await resizeContent();
  assert.ok(
    host.textContent?.includes("Saldo rekening"),
    "the final card is inserted by the actual SDK completion",
  );
  assert.equal(position, readingCap, "final card insertion does not select bottom following");

  const disclosure = host.querySelector<HTMLButtonElement>(
    "[data-reply-activity] button[aria-expanded]",
  );
  assert.ok(disclosure);
  const writesBeforeIdleGrowth = writes.length;
  await act(async (): Promise<void> => {
    disclosure.click();
  });
  assert.equal(disclosure.getAttribute("aria-expanded"), "true");
  contentHeight += 400;
  await resizeContent();
  assert.equal(position, readingCap, "idle disclosure growth does not move the reader");
  assert.equal(
    writes.length,
    writesBeforeIdleGrowth,
    "idle growth performs no automatic scroll write",
  );
  assert.ok(
    writes.every((write): boolean => write <= readingCap),
    "no automatic update briefly scrolls beyond the latest question",
  );
  assert.equal(requests, 1);
  assert.equal(externalCalls, 0);
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browserWindow.happyDOM.abort();
  console.log(`chat stream scroll stability DOM passed (${width})`);
} else {
  await act(async () => {
    await completed;
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  assert.equal(requests, 1);
  const introNode = host.querySelector("[data-reply-introduction]");
  assert.ok(introNode);
  assert.ok(introNode.textContent?.includes("Aku akan meninjau permintaan QA"));
  assert.equal(host.querySelectorAll("[data-reply-introduction]").length, 1);
  assert.equal(host.querySelectorAll("[data-chat-user-message]").length, 1);
  const activityNode = host.querySelector("[data-reply-activity]");
  assert.ok(activityNode);
  assert.ok(introNode.compareDocumentPosition(activityNode) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (introductionOnly || partialReadEof) {
    assert.equal(host.textContent?.includes(answer), false, "commentary is not the final answer");
    if (!partialReadEof)
      assert.ok(
        activityNode.classList.contains("hidden"),
        "clean finish stops the activity indicator",
      );
    const alert = host.querySelector('[role="alert"]');
    assert.ok(
      alert,
      "an introduction or read card without a terminal answer still exposes pending recovery",
    );
    assert.ok(alert.textContent?.includes("Jawaban belum selesai. Pertanyaan tetap tersedia"));
    const retry = alert.querySelector<HTMLButtonElement>("button");
    assert.ok(retry);
    assert.equal(retry.textContent?.trim(), "Coba lagi");
    assert.equal(retry.disabled, false, "retry is usable after the stream finishes");
    const saved = readWorkspaceSession("qa-owner");
    const pending = saved.drafts["00000000-0000-4000-8000-000000000123"]?.pending;
    assert.ok(
      pending,
      "onFinish does not clear the pending question for commentary or an interrupted read card",
    );
    assert.equal(pending.text, "Cek budget terbaru");
    assert.equal(requests, 1, "pending recovery does not start a duplicate request automatically");
  } else {
    assert.ok(
      host.textContent?.includes(answer),
      "final assistant text must appear without reloading history",
    );
  }
  assert.equal(externalCalls, 0);
  await act(async () => root.unmount());
  await browserWindow.happyDOM.abort();
  console.log(
    partialReadEof
      ? "chat stream partial-read EOF recovery DOM passed"
      : introductionOnly
        ? "chat stream introduction-only recovery DOM passed"
        : "chat stream final response DOM passed",
  );
}
