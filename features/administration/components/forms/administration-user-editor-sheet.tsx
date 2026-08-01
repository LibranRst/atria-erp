"use client";

import React from "react";
import { KeyRound } from "lucide-react";
import type { AdministrationOverview } from "@/app/actions/administration";
import {
  BottomSheet,
  FormField,
  FormSection,
  SheetFooterActions,
  SheetSelect,
  TextInput,
} from "@/components/ui";
import type { EditorMode, UserFormState } from "./administration-editor-types";

type Props = {
  readonly data: AdministrationOverview;
  readonly editorMode: EditorMode;
  readonly selectedUser: AdministrationOverview["users"][number] | undefined;
  readonly form: UserFormState;
  readonly pending: boolean;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly onFormChange: React.Dispatch<React.SetStateAction<UserFormState>>;
  readonly onToggle: () => void;
};

const roleLabel: Readonly<Record<string, string>> = {
  OWNER: "Owner",
  FINANCE_ADMIN: "Finance Admin",
  PROJECT_MANAGER: "Project Manager",
  PURCHASING: "Purchasing",
};
const roleDescription: Readonly<Record<string, string>> = {
  OWNER: "Akses penuh dan pemberi persetujuan utama seluruh alur ERP.",
  FINANCE_ADMIN: "Kelola kas, tagihan, pembayaran, dan pengaturan finansial.",
  PROJECT_MANAGER: "Kelola proyek yang ditugaskan dan ajukan biaya lapangan.",
  PURCHASING: "Kelola vendor, material, penerimaan, dan kontrol stok.",
};

export function AdministrationUserEditorSheet({
  data,
  editorMode,
  selectedUser,
  form: userForm,
  pending,
  open,
  onClose: closeEditor,
  onSubmit: submitUser,
  onFormChange: setUserForm,
  onToggle: toggleSelectedUser,
}: Props): React.JSX.Element {
  return (
    <BottomSheet
      open={open}
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
            <p className="text-meta">
              User wajib mengganti password sementara saat pertama kali login.
            </p>
          </div>
        ) : null}
      </form>
    </BottomSheet>
  );
}
