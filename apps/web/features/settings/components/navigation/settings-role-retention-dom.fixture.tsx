import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { listManagedRoles, updateRoleDetails } from "@/app/actions/administration-roles";
import type { SettingsReadSources } from "@atria/core/settings/read-sources";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { AdministrationOverview } from "@/app/actions/administration";
import {
  createDefaultOwnerQuickStartState,
  getQuickStartProgress,
  type OrganizationSetupOverview,
} from "@atria/core/onboarding/organization-setup";

const browserWindow = new Window({
  url: "https://atria.test/settings?tab=organization&admin=roles&keep=audit#organization",
  width: 1280,
  height: 960,
});
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
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
const nextNavigation = await import("next/navigation");
let refreshCalls = 0;
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => "/settings",
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "settings-skeleton-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {
      refreshCalls += 1;
    },
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));

type ReadResult = Awaited<ReturnType<typeof listManagedRoles>>;
const reads: Array<(result: ReadResult) => void> = [];
let readCalls = 0;
let writes = 0;
const roleActions = await import("@/app/actions/administration-roles");
mock.module("@/app/actions/administration-roles", () => ({
  ...roleActions,
  listManagedRoles: (): Promise<ReadResult> => {
    readCalls += 1;
    return new Promise<ReadResult>((resolve) => reads.push(resolve));
  },
  updateRoleDetails: async (): Promise<Awaited<ReturnType<typeof updateRoleDetails>>> => {
    writes += 1;
    return { success: true, data: { updated: true } };
  },
  updateRolePermissions: async (): Promise<never> => {
    throw new Error("Selection/read QA does not change role permissions");
  },
  createRole: async (): Promise<never> => {
    throw new Error("Read QA does not create roles");
  },
  deleteRole: async (): Promise<never> => {
    throw new Error("Read QA does not delete roles");
  },
}));
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { DesktopUIProvider } = await import("@/components/ui");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { SettingsDashboard } = await import("./settings-dashboard");
const { AdministrationManager } =
  await import("@/features/administration/components/workspaces/administration-manager");
const {
  SETTINGS_FIXTURE_OVERVIEW,
  SETTINGS_FIXTURE_ADMINISTRATION,
  SETTINGS_FIXTURE_PERMISSIONS,
  SETTINGS_FIXTURE_ROLES,
} = await import("../../../../.storybook/settings-data.fixture");
const sources = [SETTINGS_FIXTURE_ADMINISTRATION, { ...SETTINGS_FIXTURE_ADMINISTRATION }];
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
  });
}
async function render(version = 0, actor = "owner"): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(
      <WorkspacePresentationProvider presentation="desktop">
        <DesktopUIProvider>
          <PermissionsProvider
            permissions={SETTINGS_FIXTURE_PERMISSIONS}
            user={{ id: actor, sessionId: actor, name: "Owner", image: null, dataScope: "GLOBAL" }}
          >
            <SettingsDashboard
              overview={SETTINGS_FIXTURE_OVERVIEW}
              administration={sources[version] ?? SETTINGS_FIXTURE_ADMINISTRATION}
              pricingTemplates={[]}
              setup={null}
              initialStock={[]}
              openingBatches={[]}
              approvalThresholds={null}
            />
          </PermissionsProvider>
        </DesktopUIProvider>
      </WorkspacePresentationProvider>,
    );
  });
  await settle();
}
async function answer(result: ReadResult): Promise<void> {
  const resolve = reads.shift();
  assert(resolve, "An expected role read is pending");
  await act(async (): Promise<void> => resolve(result));
  await settle();
}
async function press(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    element.click();
  });
  await settle();
}
function tab(label: string): HTMLElement {
  const element = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((tab) =>
    tab.textContent?.startsWith(label),
  );
  assert(element, `Tab ${label} exists`);
  return element;
}
function button(label: string): HTMLButtonElement {
  const element = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.trim() === label,
  );
  assert(element, `Button ${label} exists`);
  return element;
}
function roleTable(): HTMLTableElement | null {
  return host.querySelector('table[aria-label="Peran dan akses"]');
}
const setup: OrganizationSetupOverview = {
  canManageQuickStart: false,
  hasPersistedState: true,
  freshInstall: false,
  shouldAutoOpen: false,
  quickStart: {
    state: createDefaultOwnerQuickStartState(),
    progress: getQuickStartProgress("welcome"),
  },
  requiredReadiness: [],
  recommendedReadiness: [],
  requiredReadyCount: 0,
  requiredTotal: 0,
  allRequiredReady: false,
};
async function renderSourceCase(
  kind: "unavailable" | "restricted" | "ready",
  module: "organization" | "initial-stock",
  permissions: readonly PermissionKey[],
): Promise<void> {
  const state =
    kind === "ready"
      ? { status: "ready" as const }
      : { status: kind, message: "Sumber uji belum tersedia." };
  const status: SettingsReadSources = {
    administration: state,
    setup: { status: "ready" },
    initialStock: state,
    openingBatches: state,
    approvalThresholds: { status: "ready" },
  };
  await act(async (): Promise<void> => {
    window.history.replaceState(
      {},
      "",
      module === "organization"
        ? "/settings?tab=organization"
        : "/settings?tab=readiness&flow=initial-stock",
    );
    root.render(
      <WorkspacePresentationProvider presentation="desktop">
        <DesktopUIProvider>
          <PermissionsProvider permissions={permissions}>
            <SettingsDashboard
              key={`${module}-${kind}-${permissions.join()}`}
              overview={SETTINGS_FIXTURE_OVERVIEW}
              administration={null}
              setup={setup}
              pricingTemplates={[]}
              initialStock={[]}
              openingBatches={[]}
              approvalThresholds={null}
              sources={status}
            />
          </PermissionsProvider>
        </DesktopUIProvider>
      </WorkspacePresentationProvider>,
    );
  });
  await settle();
}
async function renderAdministration(source: AdministrationOverview): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(
      <WorkspacePresentationProvider presentation="desktop">
        <DesktopUIProvider>
          <PermissionsProvider permissions={SETTINGS_FIXTURE_PERMISSIONS}>
            <AdministrationManager initialData={source} />
          </PermissionsProvider>
        </DesktopUIProvider>
      </WorkspacePresentationProvider>,
    );
  });
  await settle();
}
async function type(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert(setter);
  await act(async (): Promise<void> => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
try {
  await render();
  assert.equal(readCalls, 1, "Only the opened role module requests its authorized source");
  assert.equal(roleTable(), null, "Initial loading does not invent role rows");
  await answer({ success: true, data: SETTINGS_FIXTURE_ROLES });
  assert(roleTable());
  const search = host.querySelector<HTMLInputElement>('input[aria-label="Cari peran dan akses"]');
  assert(search);
  await type(search, "Pengawas");
  assert.equal(new URL(window.location.href).searchParams.get("admin-roles-search"), "Pengawas");
  await press(tab("Tim"));
  await press(tab("Peran"));
  assert(roleTable(), "Entity revisit immediately restores the role table");
  assert.equal(
    host.querySelector<HTMLInputElement>('input[aria-label="Cari peran dan akses"]')?.value,
    "Pengawas",
  );
  assert.equal(readCalls, 1, "Entity revisit does not repeat the role read");
  await press(tab("Katalog Master Data"));
  await press(tab("Tim, Vendor & Peran"));
  assert.equal(new URL(window.location.href).searchParams.get("admin"), "roles");
  assert(roleTable(), "Main Settings revisit retains its role read across both conditional owners");
  assert.equal(
    host.querySelector<HTMLInputElement>('input[aria-label="Cari peran dan akses"]')?.value,
    "Pengawas",
    "Collection query survives main-tab remount",
  );
  assert.equal(new URL(window.location.href).searchParams.get("keep"), "audit");
  assert.equal(window.location.hash, "#organization");
  const restoredSearch = host.querySelector<HTMLInputElement>(
    'input[aria-label="Cari peran dan akses"]',
  );
  assert(restoredSearch);
  await type(restoredSearch, "");
  assert.equal(readCalls, 1);
  const custom = SETTINGS_FIXTURE_ROLES[4];
  assert(custom);
  const customRow = [...roleTable()!.querySelectorAll<HTMLElement>("tbody tr")].find((row) =>
    row.textContent?.toLocaleLowerCase("id-ID").includes(custom.name.toLocaleLowerCase("id-ID")),
  );
  assert(customRow, "Representative editable role is in the current page");
  await press(customRow);
  const input = document.querySelector<HTMLInputElement>("#role-name");
  assert(input);
  await type(input, "Pengawas proyek diperbarui");
  await press(button("Simpan peran"));
  assert.equal(writes, 1, "Only an explicit mock save invokes the safe writer stub");
  assert.equal(readCalls, 2, "A successful mutation performs a fresh source read");
  assert.equal(
    document.querySelector("#role-name"),
    input,
    "Pending source read retains the existing role editor DOM",
  );
  assert(
    button("Menyimpan…").disabled,
    "The role mutation remains pending until its source reload settles",
  );
  await answer({
    success: true,
    data: SETTINGS_FIXTURE_ROLES.map((role) =>
      role.id === custom.id ? { ...role, name: "PENGAWAS PROYEK DIPERBARUI" } : role,
    ),
  });
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 650));
  });
  assert.equal(document.querySelector("#role-name"), null);
  assert(
    roleTable()?.textContent?.toLocaleLowerCase("id-ID").includes("pengawas proyek diperbarui"),
  );
  await render(1);
  assert.equal(
    roleTable(),
    null,
    "Parent generation change hides the prior authorized rows immediately",
  );
  assert.equal(readCalls, 3);
  await answer({ success: false, error: { code: "FORBIDDEN", message: "Role access revoked." } });
  assert(host.textContent?.includes("Role access revoked."));
  await press(tab("Tim"));
  await press(tab("Peran"));
  assert.equal(readCalls, 3, "A denied source stays denied across tab remount");
  assert.equal(roleTable(), null);
  assert(host.textContent?.includes("Role access revoked."));
  await press(button("Coba lagi"));
  assert.equal(readCalls, 4, "Explicit retry invalidates the denied generation");
  await answer({ success: true, data: SETTINGS_FIXTURE_ROLES });
  assert(roleTable());
  await render(1, "different-session");
  assert.equal(roleTable(), null, "A different actor/session never inherits cached roles");
  assert.equal(readCalls, 5);
  await answer({ success: true, data: [] });
  assert(roleTable()?.textContent?.includes("Belum ada peran"));
  assert.equal(writes, 1, "Tab and scope changes never invoke writers");
  await renderSourceCase("unavailable", "organization", SETTINGS_FIXTURE_PERMISSIONS);
  assert(host.textContent?.includes("Data administrasi belum dapat dimuat"));
  assert(
    !host.textContent?.includes("Akses administrasi dibatasi"),
    "A query outage is not reported as permission denial",
  );
  await press(button("Coba lagi"));
  assert.equal(refreshCalls, 1, "Local failure retry uses the existing route refresh");
  await renderSourceCase("restricted", "organization", SETTINGS_FIXTURE_PERMISSIONS);
  assert(host.textContent?.includes("Akses bagian ini dibatasi"));
  assert(!host.textContent?.includes("Coba lagi"));
  await renderSourceCase("unavailable", "initial-stock", SETTINGS_FIXTURE_PERMISSIONS);
  assert(host.querySelector("h1")?.textContent?.includes("Saldo awal stok"));
  assert(host.textContent?.includes("Saldo awal stok belum dapat dimuat"));
  assert(!host.textContent?.includes("Belum ada pengajuan"));
  assert(
    !host.textContent?.includes("Tidak ada stok lama"),
    "Failed sources never offer an empty-stock declaration",
  );
  await renderSourceCase("ready", "initial-stock", ["view:settings", "view:inventory"]);
  assert(
    host.textContent?.includes("Belum ada pengajuan saldo awal"),
    "A successful empty collection remains distinguishable",
  );
  assert(!host.textContent?.includes("Tidak ada stok lama"));
  assert(
    ![...host.querySelectorAll("button")].some(
      (element) => element.textContent?.trim() === "Catat saldo awal",
    ),
    "A stock reader is not offered an unauthorized creation action",
  );
  await renderSourceCase("ready", "initial-stock", [
    "view:settings",
    "view:inventory",
    "manage:onboarding",
  ]);
  assert(
    host.textContent?.includes("Tidak ada stok lama"),
    "Setup managers retain their authorized decision action",
  );
  assert(
    ![...host.querySelectorAll("button")].some(
      (element) => element.textContent?.trim() === "Catat saldo awal",
    ),
  );
  assert.equal(writes, 1, "Read-only source/capability QA does not invoke a writer");
  await act(async (): Promise<void> =>
    window.history.replaceState({}, "", "/settings?tab=organization&admin=team"),
  );
  await renderAdministration(SETTINGS_FIXTURE_ADMINISTRATION);
  const member = host.querySelector<HTMLElement>('table[aria-label="Tim internal"] tbody tr');
  assert(member);
  await press(member);
  const name = document.querySelector<HTMLInputElement>("#administration-user-name");
  assert(name);
  await type(name, "Draft anggota dipertahankan");
  const newer: AdministrationOverview = {
    ...SETTINGS_FIXTURE_ADMINISTRATION,
    users: SETTINGS_FIXTURE_ADMINISTRATION.users.map((row) => ({
      ...row,
      name: "Sumber server lebih baru",
    })),
  };
  const latest: AdministrationOverview = {
    ...newer,
    users: newer.users.map((row) => ({ ...row, name: "Sumber server terbaru" })),
    capabilities: { ...newer.capabilities, canManageUsers: false },
  };
  await renderAdministration(newer);
  await renderAdministration(latest);
  assert.equal(
    document.querySelector("#administration-user-name"),
    name,
    "Refresh preserves the actual open editor DOM",
  );
  assert.equal(
    name.value,
    "Draft anggota dipertahankan",
    "Deferred sources do not overwrite a dirty draft",
  );
  const close = document.querySelector<HTMLButtonElement>('button[aria-label="Tutup"]');
  assert(close);
  await press(close);
  await press(button("Batal"));
  assert.equal(name.value, "Draft anggota dipertahankan");
  await press(close);
  await press(button("Buang perubahan"));
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 650));
  });
  assert.equal(document.querySelector("#administration-user-name"), null);
  assert(
    host.textContent?.includes("Sumber server terbaru"),
    "Closing accepts the latest source, not the first deferred replacement",
  );
  assert(!host.textContent?.includes("Sumber server lebih baru"));
  assert(
    !host.querySelector('button[title="Tambah Anggota Tim"]'),
    "Revoked creation capability is applied once the owner closes",
  );
  const idle: AdministrationOverview = {
    ...latest,
    users: latest.users.map((row) => ({ ...row, name: "Pembaruan saat daftar diam" })),
  };
  await renderAdministration(idle);
  assert(
    host.textContent?.includes("Pembaruan saat daftar diam"),
    "A refresh updates an idle collection immediately",
  );
  await act(async (): Promise<void> =>
    window.history.replaceState({}, "", "/settings?tab=organization&admin=roles"),
  );
  await renderAdministration(SETTINGS_FIXTURE_ADMINISTRATION);
  await answer({ success: true, data: SETTINGS_FIXTURE_ROLES });
  const editableRole = [
    ...host.querySelectorAll<HTMLElement>('table[aria-label="Peran dan akses"] tbody tr'),
  ].find((row) => row.textContent?.toLocaleLowerCase("id-ID").includes("pengawas proyek 1"));
  assert(editableRole);
  await press(editableRole);
  const roleDraft = document.querySelector<HTMLInputElement>("#role-name");
  assert(roleDraft);
  await type(roleDraft, "Draft peran dipertahankan");
  const roleRevoked: AdministrationOverview = {
    ...idle,
    capabilities: { ...idle.capabilities, canManageRoles: false },
  };
  await renderAdministration(roleRevoked);
  assert.equal(
    document.querySelector("#role-name"),
    roleDraft,
    "A parent source refresh does not unmount the actual role editor",
  );
  assert.equal(roleDraft.value, "Draft peran dipertahankan");
  const roleClose = document.querySelector<HTMLButtonElement>('button[aria-label="Tutup"]');
  assert(roleClose);
  await press(roleClose);
  await press(button("Buang perubahan"));
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 650));
  });
  assert.equal(document.querySelector("#role-name"), null);
  assert(
    host.querySelector('table[aria-label="Tim internal"]'),
    "The latest accepted capabilities choose an available entity after closing",
  );
  assert(
    ![...host.querySelectorAll('[role="tab"]')].some(
      (element) => element.textContent?.trim() === "Peran",
    ),
  );
  assert.equal(writes, 1, "Source acceptance and discard never invoke a writer");
  console.log("Settings roles retained read owner regression passed");
} finally {
  await act(async (): Promise<void> => root.unmount());
  await browserWindow.happyDOM.close();
}
