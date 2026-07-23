"use client";

import { Building2, ChevronRight, KeyRound, UsersRound } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import React from "react";
import { toast } from "sonner";

import {
  createStaffUser,
  getAdministrationOverview,
  saveVendor,
  setVendorActive,
  updateStaffUser,
  type AdministrationOverview,
} from "@/app/actions/administration";
import { BottomSheet, SheetFooterActions } from "@/components/ui";
import {
  FormField,
  FormSection,
  SheetSelect,
  Textarea,
  TextInput,
} from "@/components/ui/form/form-controls";
import { SegmentedTabs } from "@/components/ui/navigation/segmented-tabs";
import {
  SettingsGroupSurface,
  SettingsModuleHeader,
  SettingsStatusLabel,
} from "@/features/settings/components/shared/settings-primitives";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import { transitionSpringSnappy } from "@/lib/utils/motion";

type AdministrationTab = "USERS" | "VENDORS";
type EditorMode = "NEW_USER" | "EDIT_USER" | "NEW_VENDOR" | "EDIT_VENDOR" | null;
type UserFormState = {
  readonly name: string;
  readonly email: string;
  readonly roleId: string;
  readonly temporaryPassword: string;
};
type VendorFormState = {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly bankName: string;
  readonly bankAccountNumber: string;
  readonly bankAccountHolder: string;
};

const roleLabel: Record<string, string> = {
  OWNER: "Owner",
  FINANCE_ADMIN: "Finance Admin",
  PROJECT_MANAGER: "Project Manager",
  PURCHASING: "Purchasing",
};
const roleDescription: Record<string, string> = {
  OWNER: "Akses penuh dan pemberi persetujuan utama seluruh alur ERP.",
  FINANCE_ADMIN: "Kelola kas, tagihan, pembayaran, dan pengaturan finansial.",
  PROJECT_MANAGER: "Kelola proyek yang ditugaskan dan ajukan biaya lapangan.",
  PURCHASING: "Kelola vendor, material, penerimaan, dan kontrol stok.",
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
  const [pending, setPending] = React.useState(false);
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

  async function refreshAfterMutation(): Promise<void> {
    setEditorMode(null);
    setSelectedUserId(null);
    setSelectedVendorId(null);

    const refreshed = await getAdministrationOverview();
    if (refreshed.success) {
      setData(refreshed.data);
      onMutationComplete?.();
      return;
    }

    toast.warning(
      "Data tersimpan, tetapi daftar terbaru belum dapat dimuat. Halaman akan dimuat ulang.",
    );
    window.location.reload();
  }

  async function submitUser(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    const result =
      editorMode === "EDIT_USER" && selectedUser
        ? await updateStaffUser({
            userId: selectedUser.id,
            name: userForm.name,
            roleId: userForm.roleId,
            isActive: selectedUser.isActive,
          })
        : await createStaffUser({
            name: userForm.name,
            email: userForm.email,
            roleId: userForm.roleId,
            temporaryPassword: userForm.temporaryPassword,
          });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      editorMode === "EDIT_USER" ? "User diperbarui." : "User dibuat dengan password sementara.",
    );
    await refreshAfterMutation();
  }

  async function submitVendor(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    const result = await saveVendor({
      vendorId: selectedVendor?.id,
      name: vendorForm.name,
      email: vendorForm.email,
      phone: vendorForm.phone,
      address: vendorForm.address,
      bankName: vendorForm.bankName,
      bankAccountNumber: vendorForm.bankAccountNumber,
      bankAccountHolder: vendorForm.bankAccountHolder,
      isActive: selectedVendor?.isActive ?? true,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(selectedVendor ? "Vendor diperbarui." : "Vendor dibuat.");
    await refreshAfterMutation();
  }

  async function toggleSelectedUser(): Promise<void> {
    if (!selectedUser) return;
    setPending(true);
    const result = await updateStaffUser({
      userId: selectedUser.id,
      name: selectedUser.name,
      roleId: selectedUser.roleId,
      isActive: !selectedUser.isActive,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    setData((current) => ({
      ...current,
      users: current.users.map((row) =>
        row.id === selectedUser.id ? { ...row, isActive: !row.isActive } : row,
      ),
    }));
    setEditorMode(null);
  }

  async function toggleSelectedVendor(): Promise<void> {
    if (!selectedVendor) return;
    setPending(true);
    const result = await setVendorActive({
      vendorId: selectedVendor.id,
      isActive: !selectedVendor.isActive,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    setData((current) => ({
      ...current,
      vendors: current.vendors.map((row) =>
        row.id === selectedVendor.id ? { ...row, isActive: !row.isActive } : row,
      ),
    }));
    setEditorMode(null);
  }

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
    <section className={`min-w-0 ${presentation === "onboarding" ? "space-y-3" : "space-y-4"}`}>
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
              className="relative min-h-10 shrink-0 rounded-full bg-accent/8 px-3.5 text-[10px] font-bold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] focus-visible:ring-2 focus-visible:ring-accent/25"
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
              <h3 className="text-[15px] leading-5 font-bold text-on-surface">Tim internal</h3>
              <span className="text-[9px] leading-4 font-semibold text-on-surface-variant">
                {activeUserCount} aktif dari {data.users.length}
              </span>
            </div>
          ) : null}
          <SettingsGroupSurface>
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
                    className="flex min-h-18 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-inset active:bg-surface-container-low/70"
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
                      <span className="block truncate text-[10px] leading-4 text-on-surface-variant">
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
                <p className="mt-1 text-[10px] leading-4 text-on-surface-variant">
                  Tambahkan akun sesuai tanggung jawab operasional.
                </p>
              </div>
            )}
          </SettingsGroupSurface>
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
          <SettingsGroupSurface>
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
                    className="flex min-h-17 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-inset active:bg-surface-container-low/70"
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
                      <span className="block truncate text-[10px] leading-4 text-on-surface-variant">
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
                <p className="mt-1 text-[10px] leading-4 text-on-surface-variant">
                  Vendor aktif dapat dipakai pada tagihan dan konteks material.
                </p>
              </div>
            )}
          </SettingsGroupSurface>
        </section>
      )}

      <BottomSheet
        open={data.capabilities.canManageUsers && userEditorOpen}
        title={editorMode === "EDIT_USER" ? "Edit user" : "Tambah user"}
        onClose={closeEditor}
        footer={
          <SheetFooterActions
            secondary={
              editorMode === "EDIT_USER" && selectedUser && selectedUser.roleName !== "OWNER"
                ? {
                    label: selectedUser.isActive ? "Nonaktifkan" : "Aktifkan",
                    disabled: pending,
                    onClick: () => void toggleSelectedUser(),
                  }
                : undefined
            }
            primary={{
              label: editorMode === "EDIT_USER" ? "Simpan" : "Tambah",
              pending,
              form: "administration-user-form",
              type: "submit",
            }}
          />
        }
      >
        <form id="administration-user-form" onSubmit={submitUser} className="space-y-md">
          <FormSection
            title="Informasi akun"
            helper={
              editorMode === "NEW_USER"
                ? "Role menentukan akses. Email dipakai untuk login."
                : "Perubahan nama dan role dicatat dalam audit log."
            }
          >
            <FormField label="Nama user" htmlFor="administration-user-name" required>
              <TextInput
                id="administration-user-name"
                name="name"
                value={userForm.name}
                onChange={(value) => setUserForm((current) => ({ ...current, name: value }))}
                placeholder="Contoh: Budi Santoso"
                autoComplete="name"
                required
              />
            </FormField>
            {editorMode === "EDIT_USER" && selectedUser ? (
              <FormField label="Email akun" htmlFor="administration-user-email" readOnly>
                <TextInput id="administration-user-email" value={userForm.email} readOnly />
              </FormField>
            ) : (
              <FormField label="Email" htmlFor="administration-user-email" required>
                <TextInput
                  id="administration-user-email"
                  name="email"
                  type="email"
                  value={userForm.email}
                  onChange={(value) => setUserForm((current) => ({ ...current, email: value }))}
                  placeholder="nama@dekoria.com"
                  autoComplete="email"
                  required
                />
              </FormField>
            )}
            {selectedUser?.roleName === "OWNER" ? (
              <FormField
                label="Role"
                htmlFor="administration-user-role-fixed"
                helper="Role Owner tidak dapat diubah dari akun ini."
                readOnly
              >
                <TextInput id="administration-user-role-fixed" value="Owner" readOnly />
              </FormField>
            ) : (
              <SheetSelect
                id="administration-user-role"
                label="Role"
                value={userForm.roleId}
                onChange={(value) => setUserForm((current) => ({ ...current, roleId: value }))}
                options={data.roles.map((row) => ({
                  value: row.id,
                  label: roleLabel[row.name] ?? row.name,
                  description: roleDescription[row.name],
                }))}
                placeholder="Pilih tanggung jawab"
                title="Pilih role user"
                required
              />
            )}
            {editorMode === "NEW_USER" ? (
              <FormField
                label="Password sementara"
                htmlFor="administration-user-password"
                helper="Minimal 12 karakter dengan huruf besar, huruf kecil, dan angka."
                required
              >
                <TextInput
                  id="administration-user-password"
                  name="temporaryPassword"
                  type="password"
                  value={userForm.temporaryPassword}
                  onChange={(value) =>
                    setUserForm((current) => ({
                      ...current,
                      temporaryPassword: value,
                    }))
                  }
                  placeholder="Buat password awal yang aman"
                  autoComplete="new-password"
                  required
                />
              </FormField>
            ) : null}
          </FormSection>
          {editorMode === "NEW_USER" ? (
            <div className="flex items-start gap-3 rounded-[20px] bg-warning/8 px-4 py-3 text-warning ring-1 ring-warning/8">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-[10px] leading-4">
                User wajib mengganti password sementara saat pertama kali login.
              </p>
            </div>
          ) : null}
        </form>
      </BottomSheet>

      <BottomSheet
        open={data.capabilities.canManageVendors && vendorEditorOpen}
        title={editorMode === "EDIT_VENDOR" ? "Edit vendor" : "Tambah vendor"}
        onClose={closeEditor}
        footer={
          <SheetFooterActions
            secondary={
              editorMode === "EDIT_VENDOR" && selectedVendor
                ? {
                    label: selectedVendor.isActive ? "Arsipkan" : "Aktifkan",
                    disabled: pending,
                    onClick: () => void toggleSelectedVendor(),
                  }
                : undefined
            }
            primary={{
              label: editorMode === "EDIT_VENDOR" ? "Simpan" : "Tambah",
              pending,
              form: "administration-vendor-form",
              type: "submit",
            }}
          />
        }
      >
        <form id="administration-vendor-form" onSubmit={submitVendor} className="space-y-md">
          <FormSection
            title="Identitas vendor"
            helper="Kontak ini digunakan saat menyiapkan tagihan dan pembelian."
          >
            <FormField label="Nama vendor" htmlFor="administration-vendor-name" required>
              <TextInput
                id="administration-vendor-name"
                name="name"
                value={vendorForm.name}
                onChange={(value) => setVendorForm((current) => ({ ...current, name: value }))}
                placeholder="Contoh: PT Sumber Interior"
                required
              />
            </FormField>
            <FormField label="Telepon" htmlFor="administration-vendor-phone" required>
              <TextInput
                id="administration-vendor-phone"
                name="phone"
                type="tel"
                value={vendorForm.phone}
                onChange={(value) => setVendorForm((current) => ({ ...current, phone: value }))}
                placeholder="Contoh: 0812 3456 7890"
                autoComplete="tel"
                required
              />
            </FormField>
            <FormField label="Email" htmlFor="administration-vendor-email" optional>
              <TextInput
                id="administration-vendor-email"
                name="email"
                type="email"
                value={vendorForm.email}
                onChange={(value) => setVendorForm((current) => ({ ...current, email: value }))}
                placeholder="vendor@perusahaan.com"
                autoComplete="email"
              />
            </FormField>
            <FormField label="Alamat" htmlFor="administration-vendor-address" optional>
              <Textarea
                id="administration-vendor-address"
                name="address"
                value={vendorForm.address}
                onChange={(value) => setVendorForm((current) => ({ ...current, address: value }))}
                placeholder="Alamat kantor atau gudang vendor"
                rows={2}
              />
            </FormField>
          </FormSection>
          <FormSection
            title="Rekening pembayaran"
            helper="Opsional. Isi sesuai rekening tujuan pembayaran vendor."
          >
            <FormField label="Bank" htmlFor="administration-vendor-bank" optional>
              <TextInput
                id="administration-vendor-bank"
                name="bankName"
                value={vendorForm.bankName}
                onChange={(value) => setVendorForm((current) => ({ ...current, bankName: value }))}
                placeholder="Contoh: BCA"
              />
            </FormField>
            <FormField
              label="Nomor rekening"
              htmlFor="administration-vendor-account-number"
              optional
            >
              <TextInput
                id="administration-vendor-account-number"
                name="bankAccountNumber"
                value={vendorForm.bankAccountNumber}
                onChange={(value) =>
                  setVendorForm((current) => ({
                    ...current,
                    bankAccountNumber: value,
                  }))
                }
                placeholder="Nomor rekening tujuan"
                inputMode="numeric"
              />
            </FormField>
            <FormField
              label="Nama pemilik rekening"
              htmlFor="administration-vendor-account-holder"
              optional
            >
              <TextInput
                id="administration-vendor-account-holder"
                name="bankAccountHolder"
                value={vendorForm.bankAccountHolder}
                onChange={(value) =>
                  setVendorForm((current) => ({
                    ...current,
                    bankAccountHolder: value,
                  }))
                }
                placeholder="Sesuai nama pada rekening"
              />
            </FormField>
          </FormSection>
        </form>
      </BottomSheet>
    </section>
  );
}
