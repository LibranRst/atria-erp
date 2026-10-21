import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { listAiConversations } from "@/app/actions/ai/chat-history";
import { DEFAULT_AI_PREFERENCE } from "@atria/core/validations/ai-preference";

const browserWindow = new Window({ url: "https://atria.test/ai", width: 1440 });
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
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
type PageResponse = Awaited<ReturnType<typeof listAiConversations>>;
const requests: { resolve: (response: PageResponse) => void }[] = [];
mock.module("@/app/actions/ai/chat-history", () => ({
  listAiConversations: (): Promise<PageResponse> =>
    new Promise((resolve): void => {
      requests.push({ resolve });
    }),
  renameAiConversation: (): never => {
    throw new Error("Unexpected rename");
  },
  deleteAiConversation: (): never => {
    throw new Error("Unexpected delete");
  },
}));
mock.module("@/app/actions/ai/preferences", () => ({
  getAiPreference: async () => ({ success: true, data: DEFAULT_AI_PREFERENCE }),
  saveAiPreference: (): never => {
    throw new Error("Unexpected preference save");
  },
  resetAiPreference: (): never => {
    throw new Error("Unexpected preference reset");
  },
}));
mock.module("@/components/auth/permissions-provider", () => ({
  useCan: () => (): boolean => true,
}));
const { createRoot } = await import("react-dom/client");
const { ConversationHistoryWorkspace } = await import("./conversation-history-workspace");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function render(activeId: string, refreshKey: string): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(
      <ConversationHistoryWorkspace
        compact
        activeId={activeId}
        refreshKey={refreshKey}
        onSelect={() => undefined}
        onNewConversation={() => undefined}
        onActiveDeleted={() => undefined}
      />,
    );
  });
}
async function debounce(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve): void => {
      setTimeout(resolve, 280);
    });
  });
}
const items = [
  { id: "one", title: "Budget proyek", updatedAt: new Date().toISOString(), messageCount: 4 },
  { id: "two", title: "Material proyek", updatedAt: new Date().toISOString(), messageCount: 6 },
];
await render("one", "one");
assert.ok(host.querySelector('[aria-label="Memuat riwayat"]'), "initial load has skeleton");
await debounce();
await act(async (): Promise<void> => {
  requests[0]?.resolve({ success: true, data: { items, nextCursor: "next" } });
});
const row = [...host.querySelectorAll<HTMLButtonElement>("li button")].find((button) =>
  button.textContent?.includes("Budget proyek"),
);
assert.ok(row, "loaded history row exists");
await render("two", "two");
await debounce();
assert.equal(
  host.querySelector('[aria-label="Memuat riwayat"]') !== null,
  false,
  "switching conversations must not replace loaded history with a skeleton",
);
assert.ok(row.isConnected, "history row stays mounted during refresh");
assert.equal(
  host.querySelector('[aria-current="page"]')?.textContent?.includes("Material proyek"),
  true,
);
await act(async (): Promise<void> => {
  requests[1]?.resolve({
    success: false,
    error: { code: "INTERNAL_SERVER_ERROR", message: "Riwayat belum dapat dimuat." },
  });
});
assert.ok(row.isConnected, "failed background refresh retains loaded rows");
assert.ok(host.querySelector('[role="alert"]'), "background failure offers recovery");
const retry = [...host.querySelectorAll("button")].find((button) =>
  button.textContent?.includes("Coba lagi"),
);
assert.ok(retry);
await act(async (): Promise<void> => {
  retry.click();
});
assert.equal(
  host.querySelector('[aria-label="Memuat riwayat"]') !== null,
  false,
  "retry keeps rows visible",
);
await act(async (): Promise<void> => {
  requests[2]?.resolve({ success: true, data: { items, nextCursor: "next" } });
});
assert.ok(row.isConnected, "successful refresh retains row identity");
const more = [...host.querySelectorAll("button")].find((button) =>
  button.textContent?.includes("Muat lebih banyak"),
);
assert.ok(more);
await act(async (): Promise<void> => {
  more.click();
});
assert.ok(row.isConnected, "pagination retains current rows while loading");
await act(async (): Promise<void> => {
  requests[3]?.resolve({
    success: true,
    data: {
      items: [
        {
          id: "older",
          title: "Percakapan lama",
          updatedAt: "2026-07-01T00:00:00Z",
          messageCount: 2,
        },
      ],
      nextCursor: null,
    },
  });
});
const older = [...host.querySelectorAll("li button")].find((button) =>
  button.textContent?.includes("Percakapan lama"),
);
assert.ok(older, "next page appended");
await act(async (): Promise<void> => {
  row.focus();
});
await render("one", "two");
await debounce();
assert.equal(requests.length, 4, "changing active row alone does not fetch the list");
assert.ok(row.isConnected && older.isConnected, "selection retains pagination and row identity");
assert.equal(document.activeElement === row, true, "selection retains keyboard focus");
await act(async (): Promise<void> => {
  root.unmount();
});
await browserWindow.happyDOM.close();
console.log("history workspace DOM passed");
