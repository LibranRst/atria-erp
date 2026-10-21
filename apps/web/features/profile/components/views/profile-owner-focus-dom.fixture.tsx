import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { WorkspacePresentation } from "@/lib/navigation/workspace-routes";

const browser = new Window({ url: "https://atria.test/profile", width: 1440, height: 978 });
Reflect.set(browser.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "performance",
  "CSS",
  "HTMLElement",
  "HTMLAnchorElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "Element",
  "Node",
  "NodeList",
  "HTMLCollection",
  "NodeFilter",
  "Event",
  "CustomEvent",
  "FocusEvent",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
  "ResizeObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
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

const nextNavigation = await import("next/navigation");
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => "/profile",
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "profile-owner-focus",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
let writes = 0;
function rejectWrite(): never {
  writes += 1;
  throw new Error("Profile focus fixtures must never mutate accounts or upload photos");
}
mock.module("@/app/actions/profile/update-own-profile", () => ({ updateOwnProfile: rejectWrite }));
mock.module("@/app/actions/profile/change-own-password", () => ({
  changeOwnPassword: rejectWrite,
}));
mock.module("@/lib/media/upload-to-imagekit", () => ({ uploadToImageKit: rejectWrite }));
mock.module("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ refetch: rejectWrite }) },
}));

const { createRoot } = await import("react-dom/client");
const { DesktopUIProvider } = await import("@/components/ui");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { ProfileActionsProvider } = await import("./profile-actions-provider");
const { ProfileIdentitySurface } = await import("./profile-identity-surface");
const { ProfileAccountRows } = await import("./profile-account-rows");
const { ProfileAccessList } = await import("./profile-access-list");
const { summarizeProfileAccess } = await import("../../utils/profile-access");
const groups = summarizeProfileAccess(["view:settings", "view:budget"]);

function Fixture({
  presentation,
}: {
  readonly presentation: WorkspacePresentation;
}): React.JSX.Element {
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <ProfileActionsProvider displayName="Nama fixture" imageUrl={null} initials="NF">
          <ProfileIdentitySurface
            displayName="Nama fixture"
            displayEmail="fixture@example.test"
            imageUrl={null}
            initials="NF"
            roleLabel="Peran khusus"
            roleStatus="DRAFT"
            isActive
            accessibleModuleCount={2}
            moduleCount={groups.length}
          />
          <ProfileAccountRows />
          <ProfileAccessList groups={groups} roleLabel="Peran khusus" />
        </ProfileActionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(ms = 40): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  });
}
async function render(presentation: WorkspacePresentation, width: number): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width, height: 978 });
    root.render(<Fixture presentation={presentation} />);
  });
  await settle();
}
function button(label: string): HTMLButtonElement {
  const node = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) =>
      candidate.getAttribute("aria-label") === label ||
      candidate.textContent?.trim().startsWith(label),
  );
  assert.ok(node, `The ${label} control exists`);
  return node;
}
async function click(node: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    node.focus();
    node.click();
  });
  await settle();
}
async function finishExit(): Promise<void> {
  for (let frame = 0; frame < 50; frame += 1) {
    if (document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length === 0) return;
    await settle(40);
  }
  assert.equal(
    document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length,
    0,
    "shared overlay exit completes",
  );
}
function close(title: string): HTMLButtonElement {
  const node = document.querySelector<HTMLButtonElement>(
    `[role="dialog"][aria-label="${title}"] button[aria-label="Tutup"]`,
  );
  assert.ok(node, `The ${title} overlay has its shared close control`);
  return node;
}
function nameInput(): HTMLInputElement {
  const node = document.getElementById("profile-display-name");
  assert.ok(node instanceof HTMLInputElement);
  return node;
}
async function typeName(value: string): Promise<void> {
  const node = nameInput();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert.ok(setter);
  await act(async (): Promise<void> => {
    node.focus();
    setter.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
function focusedSection(label: string): boolean {
  return (
    document.activeElement instanceof HTMLElement &&
    document.activeElement.getAttribute("aria-label") === label
  );
}
try {
  await render("desktop", 1440);
  const editInvoker = button("Ubah profil");
  await click(editInvoker);
  await settle(80);
  const input = nameInput();
  await typeName("Draft profil belum disimpan");
  await render("mobile", 390);
  assert.ok(
    !editInvoker.isConnected,
    "responsive identity genuinely replaces the original invoker",
  );
  assert.ok(nameInput() === input, "the existing profile editor keeps its exact input DOM");
  assert.ok(document.activeElement === input, "resizing preserves draft focus");
  assert.equal(input.value, "Draft profil belum disimpan");
  await click(close("Ubah profil"));
  await click(button("Batal"));
  await settle(650);
  assert.ok(document.querySelector('[role="dialog"][aria-label="Ubah profil"]'));
  assert.equal(
    nameInput().value,
    "Draft profil belum disimpan",
    "cancelling discard keeps the name draft",
  );
  await click(close("Ubah profil"));
  await click(button("Buang perubahan"));
  await finishExit();
  assert.ok(
    focusedSection("Identitas akun"),
    "profile discard after resize returns to the visible identity section",
  );
  assert.equal(document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length, 0);

  await click(button("Ganti password"));
  await settle(80);
  const currentPassword = document.getElementById("profile-current-password");
  assert.ok(currentPassword instanceof HTMLInputElement);
  assert.equal(currentPassword.value, "", "credentials are never entered by this fixture");
  await render("desktop", 1280);
  assert.ok(document.getElementById("profile-current-password") === currentPassword);
  await click(close("Ganti password"));
  await finishExit();
  assert.ok(
    focusedSection("Keamanan akun"),
    `clean password dismissal returns to the responsive security section: ${document.activeElement?.tagName} ${document.activeElement?.getAttribute("aria-label") ?? ""}`,
  );

  await render("mobile", 390);
  await click(button("Tinjau akses Kontrol keuangan"));
  await settle(80);
  assert.ok(document.querySelector('[role="dialog"][aria-label="Kontrol keuangan"]'));
  assert.ok(
    document.body.textContent?.includes("Tidak diberikan ke peran ini"),
    "missing permissions stay inspectable",
  );
  await render("desktop", 1024);
  await click(close("Kontrol keuangan"));
  await finishExit();
  assert.ok(
    focusedSection("Hak akses per modul"),
    `permission dismissal returns to the current permission collection: ${document.activeElement?.tagName} ${document.activeElement?.getAttribute("aria-label") ?? ""}; dialogs ${document.querySelectorAll('[role="dialog"]').length}`,
  );
  assert.ok(document.querySelector('[role="grid"][aria-label="Hak akses per modul"]'));
  assert.equal(writes, 0);
  console.log("Profile owner responsive focus regression passed");
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  browser.happyDOM.abort();
}
