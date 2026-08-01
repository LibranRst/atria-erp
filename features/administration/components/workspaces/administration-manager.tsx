"use client";

import { Building2, ChevronRight, UsersRound } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import React from "react";
import type { AdministrationOverview } from "@/app/actions/administration";
import { GroupedSurface, SegmentedTabs } from "@/components/ui";
import {
  SettingsModuleHeader,
  SettingsStatusLabel,
} from "@/features/settings/components/shared/settings-primitives";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import { transitionSpringSnappy } from "@/lib/utils/motion";
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
  const [activeTab, setActiveTab] = React.useState<AdministrationTab>(() =>
    initialData.capabilities.canViewUsers ? "USERS" : "VENDORS",
  );
  const [editorMode, setEditorMode] = React.useState<EditorMode>(null);
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
  const tabOptions = [
    ...(data.capabilities.canViewUsers
      ? [
          {
            value: "USERS" as const,
            label: "User",
            icon: <UsersRound className="h-4 w-4" aria-hidden="true" />,
          },
        ]
      : []),
    ...(data.capabilities.canViewVendors
      ? [
          {
            value: "VENDORS" as const,
            label: "Vendor",
            icon: <Building2 className="h-4 w-4" aria-hidden="true" />,
          },
        ]
      : []),
  ];
  const canManageActiveTab =
    activeTab === "USERS" ? data.capabilities.canManageUsers : data.capabilities.canManageVendors;
  return (
    <section className={`min-w-0 ${presentation === "onboarding" ? "space-y-3" : "space-y-sm"}`}>
      {presentation === "settings" ? (
        <SettingsModuleHeader
          eyebrow="Kontrol akses"
          title="Tim & Vendor"
          description={
            data.capabilities.canViewUsers
              ? `${activeUserCount} user aktif · ${activeVendorCount} vendor aktif. Riwayat transaksi tetap tersimpan saat akses dinonaktifkan.`
              : `${activeVendorCount} vendor aktif. Finance dapat memperbarui vendor tanpa memperoleh akses manajemen user.`
          }
          actionLabel={
            canManageActiveTab
              ? activeTab === "USERS"
                ? "Tambah user"
                : "Tambah vendor"
              : undefined
          }
          onAction={canManageActiveTab ? openCreate : undefined}
        />
      ) : null}

      {tabOptions.length > 1 ? (
        <SegmentedTabs
          value={activeTab}
          onChange={setActiveTab}
          options={tabOptions}
          ariaLabel="Jenis data administrasi"
          layoutId="administration-entity-tabs"
          density={presentation === "onboarding" ? "compact" : "default"}
        />
      ) : null}

      {presentation === "onboarding" ? (
        <div className="flex min-w-0 items-center justify-between gap-3 px-1">
          <span className="min-w-0">
            <span className="block text-[13px] leading-5 font-bold text-on-surface">
              {activeTab === "USERS" ? "Tim internal" : "Vendor"}
            </span>
            <span className="block text-[9px] leading-4 text-on-surface-variant">
              {activeTab === "USERS"
                ? `${activeUserCount} akun aktif`
                : `${activeVendorCount} vendor aktif`}
            </span>
          </span>
          {canManageActiveTab ? (
            <button
              type="button"
              onClick={openCreate}
              className="relative min-h-10 shrink-0 rounded-full bg-accent/8 px-3.5 text-[10px] font-bold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {activeTab === "USERS" ? "Tambah user" : "Tambah vendor"}
            </button>
          ) : null}
        </div>
      ) : null}

      {activeTab === "USERS" ? (
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
                      <UsersRound className="h-4.5 w-4.5" />
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
                          <SettingsStatusLabel label="Ganti password" tone="warning" />
                        </span>
                      ) : null}
                    </span>
                    <div className="flex flex-row items-center">
                      <SettingsStatusLabel
                        label={row.isActive ? "Aktif" : "Nonaktif"}
                        tone={row.isActive ? "positive" : "inactive"}
                      />
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-on-surface-variant/55"
                        aria-hidden="true"
                      />
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <UsersRound
                  className="mx-auto h-5 w-5 text-on-surface-variant/55"
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
              <h3 className="text-[15px] font-bold text-on-surface">Daftar vendor</h3>
              <span className="text-[9px] font-semibold text-on-surface-variant">
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
                      <Building2 className="h-4.5 w-4.5" />
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
                      <SettingsStatusLabel
                        label={row.isActive ? "Aktif" : "Diarsipkan"}
                        tone={row.isActive ? "positive" : "inactive"}
                      />
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-on-surface-variant/55"
                        aria-hidden="true"
                      />
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <Building2
                  className="mx-auto h-5 w-5 text-on-surface-variant/55"
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
