"use client";

import { motion, useReducedMotion } from "framer-motion";
import React from "react";
import type { AdministrationOverview } from "@/app/actions/administration";
import { AppIcon, GroupedSurface, SegmentedTabs, WorkspaceStatusLabel } from "@/components/ui";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { ROLE_DEEP_LINK_PARAMS, ROLE_WORKSPACE_VALUE } from "@atria/core/auth/role-deep-link";
import { useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { RoleAccessManager } from "../roles/role-access-manager";
import { AdministrationUserEditorSheet } from "../forms/administration-user-editor-sheet";
import { AdministrationVendorEditorSheet } from "../forms/administration-vendor-editor-sheet";
import { useAdministrationMutations } from "../../hooks/use-administration-mutations";
import type {
  AdministrationTab,
  EditorMode,
  UserFormState,
  VendorFormState,
} from "../forms/administration-editor-types";

const roleLabel: Record<string, string> = {
  OWNER: "Owner",
  FINANCE_ADMIN: "Finance Admin",
  PROJECT_MANAGER: "Project Manager",
  PURCHASING: "Purchasing",
};

const EMPTY_USER_FORM: UserFormState = {
  name: "",
  email: "",
  roleId: "",
  temporaryPassword: "",
};
const EMPTY_VENDOR_FORM: VendorFormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
};

export function AdministrationManager({
  initialData,
  presentation = "settings",
  onMutationComplete,
}: {
  readonly initialData: AdministrationOverview;
  readonly presentation?: "settings" | "onboarding";
  readonly onMutationComplete?: () => void;
}): React.JSX.Element {
  const [data, setData] = React.useState(initialData);
  /*
   * Tab entitas bisa ditunjuk dari luar lewat `?admin=roles`.
   *
   * Itu yang membuat kartu asisten bisa mendarat di tempat yang tepat alih-alih
   * di halaman Pengaturan lalu menyuruh orang mencari sendiri.
   */
  const workspaceParam = useBrowserUrlSearchParam(ROLE_DEEP_LINK_PARAMS.workspace);
  const newRoleParam = useBrowserUrlSearchParam(ROLE_DEEP_LINK_PARAMS.newRole);
  const [activeTab, setActiveTab] = React.useState<AdministrationTab>(() => {
    if (presentation === "settings" && workspaceParam === ROLE_WORKSPACE_VALUE) return "ROLES";
    if (initialData.capabilities.canViewUsers) return "USERS";
    if (initialData.capabilities.canViewVendors) return "VENDORS";
    // Peran adalah satu-satunya modul yang tersisa untuk peran yang hanya
    // memegang `manage:roles`; onboarding tidak pernah mendarat di sini.
    return presentation === "settings" ? "ROLES" : "VENDORS";
  });
  const [editorMode, setEditorMode] = React.useState<EditorMode>(null);
  const [roleCreateOpen, setRoleCreateOpen] = React.useState(false);
  const [roleCreateLinkConsumed, setRoleCreateLinkConsumed] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = React.useState<string | null>(null);
  const [userForm, setUserForm] = React.useState<UserFormState>(EMPTY_USER_FORM);
  const [vendorForm, setVendorForm] = React.useState<VendorFormState>(EMPTY_VENDOR_FORM);
  const reduceMotion = useReducedMotion();
  const selectedUser = data.users.find((row) => row.id === selectedUserId);
  const selectedVendor = data.vendors.find((row) => row.id === selectedVendorId);
  const activeUserCount = data.users.filter((row) => row.isActive).length;
  const activeVendorCount = data.vendors.filter((row) => row.isActive).length;
  const userEditorOpen = editorMode === "NEW_USER" || editorMode === "EDIT_USER";
  const vendorEditorOpen = editorMode === "NEW_VENDOR" || editorMode === "EDIT_VENDOR";

  function closeEditor(): void {
    if (pending) return;
    setEditorMode(null);
  }

  function openCreate(): void {
    if (activeTab === "ROLES") {
      if (!data.capabilities.canManageRoles) return;
      setRoleCreateOpen(true);
      return;
    }
    if (activeTab === "USERS") {
      if (!data.capabilities.canManageUsers) return;
      setSelectedUserId(null);
      setUserForm({ ...EMPTY_USER_FORM, roleId: data.roles[0]?.id ?? "" });
      setEditorMode("NEW_USER");
      return;
    }
    if (!data.capabilities.canManageVendors) return;
    setSelectedVendorId(null);
    setVendorForm(EMPTY_VENDOR_FORM);
    setEditorMode("NEW_VENDOR");
  }

  const { pending, submitUser, submitVendor, toggleSelectedUser, toggleSelectedVendor } =
    useAdministrationMutations({
      editorMode,
      selectedUser,
      selectedVendor,
      userForm,
      vendorForm,
      onMutationComplete,
      setData,
      setEditorMode,
      setSelectedUserId,
      setSelectedVendorId,
    });
  /*
   * Label tab tanpa hitungan.
   * Dengan tiga tab dan tombol buat di baris yang sama, "Anggota Tim (5)" pada
   * 320 px menyusut jadi "Anggot…" — hitungan yang terpotong lebih buruk
   * daripada tidak ada, dan angkanya tetap terbaca utuh di kepala daftar
   * tepat di bawahnya.
   */
  const showRoles = presentation === "settings" && data.capabilities.canManageRoles;

  /*
   * `?newRole=1` membuka sheet pembuatan peran. Diputuskan di sini karena
   * state-nya milik komponen ini — sekali saja, supaya pengguna tetap bisa
   * menutupnya tanpa ia terbuka lagi.
   */
  if (showRoles && newRoleParam === "1" && !roleCreateLinkConsumed) {
    setRoleCreateLinkConsumed(true);
    setRoleCreateOpen(true);
  }
  const createActionLabel =
    activeTab === "USERS"
      ? "Tambah User"
      : activeTab === "VENDORS"
        ? "Tambah Vendor"
        : "Peran Baru";
  const createActionTitle =
    activeTab === "USERS"
      ? "Tambah Anggota Tim"
      : activeTab === "VENDORS"
        ? "Tambah Vendor Baru"
        : "Buat Peran Baru";
  const tabOptions = [
    ...(data.capabilities.canViewUsers
      ? [
          {
            value: "USERS" as const,
            label: "Tim",
            icon: <AppIcon name="group" className="h-3.75 w-3.75" aria-hidden="true" />,
          },
        ]
      : []),
    ...(data.capabilities.canViewVendors
      ? [
          {
            value: "VENDORS" as const,
            label: "Vendor",
            icon: <AppIcon name="domain" className="h-3.75 w-3.75" aria-hidden="true" />,
          },
        ]
      : []),
    // Peran hanya relevan di Settings: onboarding menyiapkan tim, bukan
    // mendefinisikan ulang akses.
    ...(showRoles
      ? [
          {
            value: "ROLES" as const,
            label: "Peran",
            icon: <AppIcon name="verified_user" className="h-3.75 w-3.75" aria-hidden="true" />,
          },
        ]
      : []),
  ];
  const canManageActiveTab =
    activeTab === "USERS"
      ? data.capabilities.canManageUsers
      : activeTab === "VENDORS"
        ? data.capabilities.canManageVendors
        : data.capabilities.canManageRoles;
  return (
    <section className={`min-w-0 ${presentation === "onboarding" ? "space-y-3" : "space-y-sm"}`}>
      {presentation === "onboarding" ? (
        <div className="flex min-w-0 items-center justify-between gap-3 px-1">
          <span className="min-w-0">
            <span className="block text-[13px] leading-5 font-bold text-on-surface">
              {activeTab === "USERS" ? "Tim internal" : "Vendor"}
            </span>
            <span className="block text-meta text-on-surface-variant">
              {activeTab === "USERS"
                ? `${activeUserCount} akun aktif`
                : `${activeVendorCount} vendor aktif`}
            </span>
          </span>
          {canManageActiveTab ? (
            <button
              type="button"
              onClick={openCreate}
              className="relative min-h-10 shrink-0 rounded-full bg-accent/8 px-3.5 text-meta font-bold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {activeTab === "USERS" ? "Tambah user" : "Tambah vendor"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex min-w-0 items-center justify-between gap-2">
          {tabOptions.length > 1 ? (
            <div className="min-w-0 flex-1">
              <SegmentedTabs
                value={activeTab}
                onChange={setActiveTab}
                options={tabOptions}
                ariaLabel="Jenis data administrasi"
                layoutId="administration-entity-tabs"
                density="compact"
                scrollable
                fillAvailableSpace
              />
            </div>
          ) : null}
          {canManageActiveTab ? (
            <button
              type="button"
              onClick={openCreate}
              /*
               * `max-[420px]:w-12 px-0` menjaga lingkarannya benar-benar bulat.
               * Tanpa itu, label yang disembunyikan menyisakan `px-3.5` di
               * kedua sisi sehingga tombolnya 44×48 — lonjong, bukan lingkaran.
               */
              className="hover:bg-primary-hover flex h-12 shrink-0 items-center justify-center rounded-full bg-primary px-3.5 text-xs font-bold text-white shadow-control max-[420px]:w-12 max-[420px]:px-0"
              title={createActionTitle}
            >
              <AppIcon name="add" className="icon-sm" />
              <span className="ml-1 max-[420px]:hidden">{createActionLabel}</span>
            </button>
          ) : null}
        </div>
      )}

      {activeTab === "ROLES" ? (
        <RoleAccessManager createOpen={roleCreateOpen} onCreateOpenChange={setRoleCreateOpen} />
      ) : activeTab === "USERS" ? (
        <section className="space-y-2">
          {presentation === "settings" ? (
            <div className="flex min-h-8 items-center justify-between gap-3 px-1">
              <h3 className="text-section font-bold text-on-surface">Tim internal</h3>
              <span className="text-[9px] leading-4 font-semibold text-on-surface-variant">
                {activeUserCount} aktif dari {data.users.length}
              </span>
            </div>
          ) : null}
          <GroupedSurface>
            {data.users.length > 0 ? (
              <div className="divide-y divide-outline-variant/20">
                {data.users.map((row) => (
                  <motion.button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(row.id);
                      setUserForm({
                        name: row.name,
                        email: row.email,
                        roleId: row.roleId,
                        temporaryPassword: "",
                      });
                      setEditorMode("EDIT_USER");
                    }}
                    whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                    transition={transitionSpringSnappy}
                    className="flex min-h-18 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container-low/70"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-surface-container-low text-on-surface-variant"
                      aria-hidden="true"
                    >
                      <AppIcon name="group" className="icon-md" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] leading-5 font-bold text-on-surface">
                        {row.name}
                      </span>
                      <span className="block truncate text-meta text-on-surface-variant">
                        {row.email} · {roleLabel[row.roleName] ?? formatBusinessLabel(row.roleName)}
                      </span>
                      {row.mustChangePassword ? (
                        <span className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
                          <WorkspaceStatusLabel label="Ganti password" tone="warning" />
                        </span>
                      ) : null}
                    </span>
                    <div className="flex flex-row items-center">
                      <WorkspaceStatusLabel
                        label={row.isActive ? "Aktif" : "Nonaktif"}
                        tone={row.isActive ? "positive" : "inactive"}
                      />
                      <AppIcon
                        name="chevron_right"
                        className="icon-sm shrink-0 text-on-surface-variant/55"
                        aria-hidden="true"
                      />
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <AppIcon
                  name="group"
                  className="mx-auto icon-lg text-on-surface-variant/55"
                  aria-hidden="true"
                />
                <p className="mt-2 text-xs font-bold text-on-surface">Belum ada user internal</p>
                <p className="mt-1 text-meta text-on-surface-variant">
                  Tambahkan akun sesuai tanggung jawab operasional.
                </p>
              </div>
            )}
          </GroupedSurface>
        </section>
      ) : (
        <section className="space-y-2">
          {presentation === "settings" ? (
            <div className="flex min-h-8 items-center justify-between gap-3 px-1">
              <h3 className="text-section font-bold text-on-surface">Daftar vendor</h3>
              <span className="text-eyebrow font-semibold text-on-surface-variant">
                {activeVendorCount} aktif dari {data.vendors.length}
              </span>
            </div>
          ) : null}
          <GroupedSurface>
            {data.vendors.length > 0 ? (
              <div className="divide-y divide-outline-variant/20">
                {data.vendors.map((row) => (
                  <motion.button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      setSelectedVendorId(row.id);
                      setVendorForm({
                        name: row.name,
                        phone: row.phone,
                        email: row.email ?? "",
                        address: row.address ?? "",
                        bankName: row.bankName ?? "",
                        bankAccountNumber: row.bankAccountNumber ?? "",
                        bankAccountHolder: row.bankAccountHolder ?? "",
                      });
                      setEditorMode("EDIT_VENDOR");
                    }}
                    whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                    transition={transitionSpringSnappy}
                    className="flex min-h-17 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container-low/70"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-surface-container-low text-on-surface-variant"
                      aria-hidden="true"
                    >
                      <AppIcon name="domain" className="icon-md" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] leading-5 font-bold text-on-surface">
                        {row.name}
                      </span>
                      <span className="block truncate text-meta text-on-surface-variant">
                        {row.phone}
                        {row.bankName ? ` · ${row.bankName}` : ""}
                      </span>
                    </span>
                    <div className="flex flex-row items-center">
                      <WorkspaceStatusLabel
                        label={row.isActive ? "Aktif" : "Diarsipkan"}
                        tone={row.isActive ? "positive" : "inactive"}
                      />
                      <AppIcon
                        name="chevron_right"
                        className="icon-sm shrink-0 text-on-surface-variant/55"
                        aria-hidden="true"
                      />
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <AppIcon
                  name="domain"
                  className="mx-auto icon-lg text-on-surface-variant/55"
                  aria-hidden="true"
                />
                <p className="mt-2 text-xs font-bold text-on-surface">Belum ada vendor</p>
                <p className="mt-1 text-meta text-on-surface-variant">
                  Vendor aktif dapat dipakai pada tagihan dan konteks material.
                </p>
              </div>
            )}
          </GroupedSurface>
        </section>
      )}

      <AdministrationUserEditorSheet
        data={data}
        editorMode={editorMode}
        selectedUser={selectedUser}
        form={userForm}
        pending={pending}
        open={data.capabilities.canManageUsers && userEditorOpen}
        onClose={closeEditor}
        onSubmit={submitUser}
        onFormChange={setUserForm}
        onToggle={() => void toggleSelectedUser()}
      />
      <AdministrationVendorEditorSheet
        editorMode={editorMode}
        selectedVendor={selectedVendor}
        form={vendorForm}
        pending={pending}
        open={data.capabilities.canManageVendors && vendorEditorOpen}
        onClose={closeEditor}
        onSubmit={submitVendor}
        onFormChange={setVendorForm}
        onToggle={() => void toggleSelectedVendor()}
      />
    </section>
  );
}
