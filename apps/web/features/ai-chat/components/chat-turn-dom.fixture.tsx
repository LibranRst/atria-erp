import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ComponentProps } from "react";
import type { UIMessage } from "ai";
import { ownProfileProposalSchema } from "@atria/core/ai/own-profile";
import { requestUserInputSchema } from "@atria/core/ai/input-request";
import type { ActiveInputRequest } from "../utils/input-request-reader";

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

const { createRoot } = await import("react-dom/client");
const { ChatTurn } = await import("./chat-turn");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { unansweredTurn } = await import("../utils/chat-recovery");
type Props = ComponentProps<typeof ChatTurn>;
type Part = UIMessage["parts"][number];
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
let presentation: "mobile" | "desktop" = "mobile";
const user: UIMessage = {
  id: "qa-user",
  role: "user",
  parts: [{ type: "text", text: "Cek saldo rekening terbaru. Jangan simpan perubahan." }],
};
const introText = "Aku akan membaca saldo dan budget proyek QA, lalu menyiapkan ringkasannya.";
const introPart: Part = {
  type: "data-assistant-introduction",
  id: "qa-intro",
  data: { text: introText },
};
const base: Props = {
  user,
  assistant: null,
  conversationId: null,
  confirmedProposals: {},
  showFollowUps: false,
  onFollowUp: unexpectedExternalCall,
  isCurrent: true,
  isBusy: true,
  statusSuppressed: false,
  replyCycle: 1,
};
let props = base;
const submittedSnapshot = JSON.stringify(user);
function assistant(parts: Part[]): UIMessage {
  return { id: "qa-assistant", role: "assistant", parts };
}
function running(name: string, callId: string): Part {
  return { type: `tool-${name}`, toolCallId: callId, state: "input-available", input: {} };
}
function done(name: string, callId: string, output: unknown): Part {
  return { type: `tool-${name}`, toolCallId: callId, state: "output-available", input: {}, output };
}
async function render(next: Partial<Props> = {}): Promise<void> {
  props = { ...props, ...next };
  await act(async (): Promise<void> => {
    root.render(
      <WorkspacePresentationProvider presentation={presentation}>
        <PermissionsProvider permissions={["use:ai_chat"]}>
          <ChatTurn {...props} />
        </PermissionsProvider>
      </WorkspacePresentationProvider>,
    );
  });
}
async function wait(ms: number): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve): void => {
      setTimeout(resolve, ms);
    });
  });
}
function introduction(): HTMLElement {
  const nodes = host.querySelectorAll<HTMLElement>("[data-reply-introduction]");
  assert.equal(nodes.length, 1, "active reply owns exactly one local introduction slot");
  const node = nodes[0];
  assert.ok(node, "one local introduction slot exists");
  return node;
}
function introVisible(): boolean {
  return host.querySelector("[data-reply-introduction]") !== null;
}
function activity(): HTMLElement {
  const nodes = host.querySelectorAll<HTMLElement>("[data-reply-activity]");
  assert.equal(nodes.length, 1, "there is exactly one real activity bubble");
  assert.ok(nodes[0]);
  return nodes[0];
}
function disclosure(): HTMLButtonElement {
  const button = activity().querySelector<HTMLButtonElement>("button[aria-expanded]");
  assert.ok(button);
  return button;
}

await render();
assert.equal(introVisible(), false, "no fabricated introduction before model output");
await wait(220);
assert.equal(introVisible(), false, "waiting does not create a deterministic assistant sentence");
const activityNode = activity();
const button = disclosure();
const pendingClass = button.className;
assert.ok(activityNode.textContent?.includes("Menyusun jawaban…"));
assert.equal(activityNode.querySelectorAll("li").length, 0, "no invented tool steps");
assert.equal(host.querySelectorAll('[role="status"][aria-live="polite"]').length, 1);

await render({
  assistant: assistant([
    introPart,
    { type: "tool-getBankBalances", toolCallId: "balance", state: "input-streaming", input: {} },
  ]),
});
assert.equal(introVisible(), true, "model introduction renders independently of final answer");
const introNode = introduction();
assert.ok(introNode.textContent?.includes(introText));
assert.equal(activity(), activityNode);
assert.equal(disclosure(), button, "placeholder and actual tools share one disclosure owner");
assert.equal(activityNode.querySelectorAll("li").length, 0, "argument streaming is not execution");
if (motion === "reduced")
  assert.equal(introNode.style.transform.includes("translateY(6px)"), false);

const traceOnly = assistant([introPart, running("getBankBalances", "balance")]);
const traceOnlySnapshot = JSON.stringify(traceOnly);
await render({ assistant: traceOnly });
assert.ok(activityNode.textContent?.includes("Membaca saldo rekening"));
assert.equal(button.className, pendingClass, "pending and real traces retain the same appearance");
assert.equal(button.getAttribute("aria-expanded"), "false");
await act(async (): Promise<void> => {
  button.click();
  button.focus();
});
assert.equal(button.getAttribute("aria-expanded"), "true");
await render({
  assistant: assistant([
    introPart,
    done("getBankBalances", "balance", { accounts: [] }),
    running("getProjectBudget", "budget"),
  ]),
});
assert.equal(disclosure(), button);
assert.equal(document.activeElement, button);
assert.equal(introduction(), introNode);
assert.ok(activityNode.textContent?.includes("Membaca budget dan realisasi biaya"));

presentation = "desktop";
browserWindow.innerWidth = 1280;
await render();
assert.equal(activity(), activityNode);
assert.equal(disclosure(), button);
assert.equal(button.getAttribute("aria-expanded"), "true");

await render({
  assistant: assistant([
    introPart,
    done("getBankBalances", "balance", { accounts: [] }),
    done("getProjectBudget", "budget", {}),
    { type: "text", state: "streaming", text: "Saldo QA telah dibaca." },
  ]),
});
assert.equal(introVisible(), true, "introduction remains above the real answer");
assert.ok(host.textContent?.includes("Saldo QA telah dibaca."));
assert.equal(introduction(), introNode);
assert.equal(activity(), activityNode);
assert.equal(disclosure(), button);
assert.equal(button.className, pendingClass, "completion cannot change the trace owning surface");
assert.equal(document.activeElement, button);
assert.equal(host.querySelectorAll('[aria-label="Langkah asisten"]').length, 1);
assert.ok(introNode.compareDocumentPosition(activityNode) & Node.DOCUMENT_POSITION_FOLLOWING);
const answerNode = [...host.querySelectorAll("p")].find(
  (node) => node.textContent === "Saldo QA telah dibaca.",
);
assert.ok(answerNode);
assert.ok(activityNode.compareDocumentPosition(answerNode) & Node.DOCUMENT_POSITION_FOLLOWING);
await render({ isBusy: false });
assert.equal(introduction(), introNode, "completed introduction remains in the transcript");
assert.equal(button.getAttribute("aria-expanded"), "true");
assert.equal(JSON.stringify(user), submittedSnapshot);
assert.equal(JSON.stringify(traceOnly), traceOnlySnapshot, "projection does not mutate SDK parts");
assert.equal(
  unansweredTurn([user, assistant([introPart])]),
  user,
  "intro-only is still unanswered",
);

// Ready text has no forced preamble, timer or extra model request.
await render({
  assistant: assistant([{ type: "text", text: "Jawaban cepat QA." }]),
  isBusy: true,
  replyCycle: 2,
});
assert.equal(introVisible(), false);
assert.ok(host.textContent?.includes("Jawaban cepat QA."));
await wait(220);
assert.equal(introVisible(), false);
assert.equal(activity().className, "hidden", "fast answer does not leave a pending indicator");

// Stop and switching before a model introduction cannot later invent one.
await render({ assistant: null, replyCycle: 3 });
await render({ statusSuppressed: true });
await wait(220);
assert.equal(introVisible(), false);
assert.equal(activity().className, "hidden");
await render({ statusSuppressed: false, isCurrent: false, replyCycle: 4 });
await wait(220);
assert.equal(introVisible(), false);
await render({ isCurrent: true, isBusy: true, replyCycle: 5, assistant: traceOnly });
assert.equal(introVisible(), true, "retry only shows model-provided introduction");
await render({ statusSuppressed: true });
assert.equal(introVisible(), true, "stopped model commentary stays truthful history");
assert.ok(activity().textContent?.includes("Proses dihentikan"));

// Errors retain commentary while making the unresolved failure clear.
await render({
  isBusy: true,
  statusSuppressed: false,
  replyCycle: 6,
  assistant: assistant([
    introPart,
    {
      type: "tool-getBankBalances",
      toolCallId: "denied",
      state: "output-error",
      input: {},
      errorText: "Akses rekening ditolak.",
    },
  ]),
});
assert.equal(introVisible(), true);
assert.ok(activity().textContent?.includes("Sebagian pemeriksaan belum selesai"));
await act(async (): Promise<void> => {
  if (disclosure().getAttribute("aria-expanded") === "false") disclosure().click();
});
assert.ok(activity().textContent?.includes("Akses data ditolak."));
await render({
  assistant: assistant([
    introPart,
    done("getBankBalances", "denied-envelope", { error: "Proyek di luar akses Anda." }),
  ]),
});
assert.ok(activity().textContent?.includes("Sebagian pemeriksaan belum selesai"));

const pendingInput: ActiveInputRequest = {
  toolCallId: "choose-project",
  payload: requestUserInputSchema.parse({
    actionTitle: "Pilih proyek QA",
    fields: [
      {
        key: "projectId",
        label: "Proyek",
        type: "select",
        required: true,
        options: [{ value: "qa-project", label: "Proyek QA" }],
      },
    ],
  }),
};
await render({
  pendingInput,
  assistant: assistant([
    introPart,
    done("requestUserInput", "choose-project", pendingInput.payload),
  ]),
  isBusy: true,
  replyCycle: 7,
});
assert.ok(activity().textContent?.includes("Pilih proyek untuk melanjutkan"));
assert.equal(introVisible(), true);

const proposal = ownProfileProposalSchema.parse({
  kind: "OWN_PROFILE",
  input: { name: "Nama QA baru", photo: { action: "KEEP" } },
  expectedContext: "0".repeat(64),
  before: { name: "Nama QA lama", imageUrl: null, hasPhoto: false },
  after: { name: "Nama QA baru", imageUrl: null, hasPhoto: false },
  photoSource: null,
  changedFields: ["name"],
});
await render({
  pendingInput: null,
  assistant: assistant([introPart, done("proposeOwnProfile", "profile", { proposal })]),
  isBusy: false,
  replyCycle: 8,
});
assert.equal(introVisible(), true);
assert.ok(host.textContent?.includes("Nama QA baru"));
assert.ok(host.textContent?.includes("Simpan profil"));
const saveProfile = [...host.querySelectorAll("button")].find((node) =>
  node.textContent?.includes("Simpan profil"),
);
assert.ok(saveProfile?.disabled, "UI cannot bypass proposal server revalidation");
assert.equal(externalCalls, 0, "presentation did not perform model or business operations");

// Refresh/history retain supplied introduction and the completed disclosure.
await render({
  isCurrent: false,
  isBusy: true,
  replyCycle: 9,
  assistant: assistant([
    introPart,
    done("getBankBalances", "balance", { accounts: [] }),
    { type: "text", text: "Jawaban riwayat QA." },
  ]),
});
await wait(220);
assert.equal(introVisible(), true);
assert.ok(host.textContent?.includes("Jawaban riwayat QA."));
assert.equal(activity().textContent?.includes("Menyusun jawaban…"), false);
await render({ assistant: assistant([{ type: "text", text: "Jawaban lama tanpa pengantar." }]) });
assert.equal(introVisible(), false, "legacy histories do not acquire invented commentary");
await act(async (): Promise<void> => {
  root.unmount();
});
await browserWindow.happyDOM.close();
console.log(`reply handoff DOM passed (${motion})`);
