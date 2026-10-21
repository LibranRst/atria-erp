import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, useEffect, useState } from "react";
import { buildRoleGuide, type OwnRoleGuide } from "@atria/core/onboarding/role-guide";
import type { ActionResponse } from "@atria/core/types/action-response";

const browser = new Window({ url: "https://atria.test/projects?preserve=yes#reading" });
Reflect.set(browser.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
  "ResizeObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "sessionStorage",
] as const) {
  const value: unknown = key === "window" ? browser : Reflect.get(browser, key);
  Reflect.set(
    globalThis,
    key,
    typeof value === "function" &&
      ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key)
      ? value.bind(browser)
      : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
let route = "/projects";
const router = {
  push: (href: string): void => {
    route = href;
  },
  replace: (): void => undefined,
  prefetch: (): void => undefined,
  back: (): void => undefined,
  forward: (): void => undefined,
  refresh: (): void => undefined,
};
mock.module("next/navigation", () => ({
  usePathname: (): string => route,
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  useSelectedLayoutSegment: () => null,
  useSelectedLayoutSegments: () => [],
}));
function guide(key = "a"): OwnRoleGuide {
  return {
    ...buildRoleGuide({
      roleId: "custom",
      roleName: "project_team",
      dataScope: "ASSIGNED",
      permissions: ["view:budget", "view:cost", "create:cost"],
    }),
    contextKey: key.repeat(64),
    canAcknowledge: true,
    shouldAutoShow: true,
  };
}
let currentGuide = guide();
let delayed: Promise<ActionResponse<OwnRoleGuide>> | null = null;
let failLoad = false;
const saved: string[] = [];
mock.module("@/app/actions/profile/role-guide", () => ({
  getOwnRoleGuide: async (): Promise<ActionResponse<OwnRoleGuide>> => {
    if (delayed) return delayed;
    if (failLoad) throw new Error("offline");
    return { success: true, data: currentGuide };
  },
  acknowledgeOwnRoleGuide: async (input: {
    readonly contextKey: string;
  }): Promise<ActionResponse<{ readonly acknowledged: boolean }>> => {
    saved.push(input.contextKey);
    return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "offline" } };
  },
}));
const { createRoot } = await import("react-dom/client");
// Coordinator tests use an immediate feature presenter. Shared sheet motion/focus
// has its own DOM suites, and the real presenter is covered by browser tests.
mock.module(`${import.meta.dir}/components/role-guide-sheet.tsx`, () => ({
  RoleGuideSheet: ({
    guide: content,
    open,
    onClose,
    onStart,
    onExitComplete,
  }: {
    readonly guide: OwnRoleGuide | null;
    readonly open: boolean;
    readonly onClose: () => void;
    readonly onStart: () => void;
    readonly onExitComplete: () => void;
  }): React.JSX.Element | null => {
    useEffect((): void => {
      if (!open) onExitComplete();
    }, [open, onExitComplete]);
    return open && content ? (
      <section role="dialog" aria-label="Panduan peran Anda">
        <h2>{content.roleLabel}</h2>
        <button onClick={onClose}>Mengerti</button>
        <button onClick={onStart}>{content.primaryAction.label}</button>
      </section>
    ) : null;
  },
}));
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { RoleGuideProvider } = await import("./components/role-guide-provider");
const { RoleGuideTrigger } = await import("./components/role-guide-trigger");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
function Draft(): React.JSX.Element {
  const [value, setValue] = useState("Draft proyek");
  return (
    <input
      aria-label="Draft proyek"
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  );
}
function Harness({ userId = "alice" }: { readonly userId?: string }): React.JSX.Element {
  return (
    <PermissionsProvider
      permissions={["view:budget"]}
      user={{
        id: userId,
        sessionId: "qa",
        roleId: "custom",
        dataScope: "ASSIGNED",
        name: userId,
        image: null,
      }}
    >
      <RoleGuideProvider>
        <Draft />
        <RoleGuideTrigger />
      </RoleGuideProvider>
    </PermissionsProvider>
  );
}
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 450));
  });
}
async function render(userId = "alice"): Promise<void> {
  await act(async () => root.render(<Harness userId={userId} />));
  await flush();
}
function panel(): Element | null {
  return document.querySelector('[role="dialog"]');
}
async function click(label: string): Promise<void> {
  const button = [...document.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  assert.ok(button, `Missing button ${label}`);
  await act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await flush();
}
try {
  // A focused draft and an existing menu defer the automatic guide.
  route = "/onboarding/review";
  await render();
  assert.equal(Boolean(panel()), false);
  const input = host.querySelector("input");
  assert.ok(input);
  await act(async () => input.focus());
  route = "/projects";
  await render();
  assert.equal(Boolean(panel()), false, "Do not interrupt a focused draft");
  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  document.body.append(menu);
  await act(async () => input.blur());
  await flush();
  assert.equal(Boolean(panel()), false, "Do not stack above an existing menu");
  await act(async () => menu.remove());
  await flush();
  assert.ok(panel()?.textContent?.includes(currentGuide.roleLabel));
  const draftNode = input;
  await act(async () => window.dispatchEvent(new Event("resize")));
  assert.equal(host.querySelector("input"), draftNode, "Resize preserves the workflow DOM");
  assert.equal(input.value, "Draft proyek");
  await click("Mengerti");
  await flush();
  assert.equal(Boolean(panel()), false);
  assert.equal(route, "/projects");
  assert.equal(saved.length, 1);
  route = "/profile";
  await render();
  assert.equal(
    Boolean(panel()),
    false,
    "Failed acknowledgment must not replay in the same session",
  );
  await click("Panduan peran saya");
  assert.ok(panel(), "Manual replay ignores the local seen status");
  await click("Mengerti");
  await flush();
  failLoad = true;
  await click("Panduan peran saya");
  assert.match(host.textContent ?? "", /Panduan belum dapat dimuat/);
  assert.equal(Boolean(panel()), false);
  failLoad = false;

  // A late response for a different account cannot replace its current guide.
  let resolveLate: ((value: ActionResponse<OwnRoleGuide>) => void) | undefined;
  delayed = new Promise((resolve) => {
    resolveLate = resolve;
  });
  route = "/materials";
  await render("bob");
  delayed = null;
  currentGuide = { ...guide("b"), roleLabel: "Akun berikutnya" };
  await render("carol");
  assert.ok(panel()?.textContent?.includes("Akun berikutnya"));
  await act(async () => resolveLate?.({ success: true, data: guide("c") }));
  assert.ok(panel()?.textContent?.includes("Akun berikutnya"));
  await click("Mengerti");
  await flush();

  currentGuide = { ...guide("d"), shouldAutoShow: false, canAcknowledge: false };
  route = "/profile";
  await render("simulation");
  const previousSaved = saved.length;
  await click("Panduan peran saya");
  assert.ok(panel());
  await click("Mengerti");
  await flush();
  assert.equal(saved.length, previousSaved, "Simulation does not acknowledge a real user's guide");
  // Clicking replay before the scheduled automatic fetch must keep manual priority.
  let resolveManual: ((value: ActionResponse<OwnRoleGuide>) => void) | undefined;
  delayed = new Promise((resolve) => {
    resolveManual = resolve;
  });
  currentGuide = { ...guide("e"), shouldAutoShow: false };
  route = "/profile";
  await act(async () => {
    root.render(<Harness userId="fast-click" />);
  });
  const replay = [...host.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Panduan peran saya",
  );
  assert.ok(replay);
  await act(async () => {
    replay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush();
  await act(async () => {
    resolveManual?.({ success: true, data: currentGuide });
  });
  await flush();
  delayed = null;
  assert.ok(panel(), "Manual replay survives a queued automatic request with shouldAutoShow=false");
  await click("Mengerti");
  console.info("Role guide DOM regressions passed");
} finally {
  await act(async () => root.unmount());
  await browser.happyDOM.close();
}
