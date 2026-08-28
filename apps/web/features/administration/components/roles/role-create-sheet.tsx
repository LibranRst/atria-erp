"use client";

import React from "react";

import {
  AdaptiveSelect,
  ChoiceRow,
  FormField,
  FormSection,
  OperationalFormSheet,
  Textarea,
  TextInput,
} from "@/components/ui";
import type { RoleDataScope } from "@atria/core/auth/permissions";
import type { ManagedRole } from "@/server/usecases/administration/roles";
import { DATA_SCOPE_OPTIONS, formatRoleName } from "../../utils/role-editor";

export type RoleCreateForm = {
  readonly name: string;
  readonly description: string;
  readonly dataScope: RoleDataScope;
  readonly duplicateFromRoleId: string;
};

export const EMPTY_ROLE_CREATE_FORM: RoleCreateForm = {
  name: "",
  description: "",
  dataScope: "ASSIGNED",
  duplicateFromRoleId: "",
};

/**
 * Membuat peran dimulai dari menyalin peran yang sudah ada.
 *
 * Peran kosong itu sah, tetapi hampir tidak pernah yang dimaksudkan: sebuah
 * peran baru biasanya "seperti PM, tapi tanpa mencairkan uang". Menyalin lalu
 * mencabut jauh lebih sulit salah daripada menyalakan tujuh puluh satu sakelar
 * dari nol.
 */
export function RoleCreateSheet({
  open,
  form,
  roles,
  pending,
  onFormChange,
  onClose,
  onSubmit,
}: {
  readonly open: boolean;
  readonly form: RoleCreateForm;
  readonly roles: readonly ManagedRole[];
  readonly pending: boolean;
  readonly onFormChange: (form: RoleCreateForm) => void;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
}): React.JSX.Element {
  const nameReady = form.name.trim().length >= 3;
  const source = roles.find((role) => role.id === form.duplicateFromRoleId);

  return (
    <OperationalFormSheet
      open={open}
      title="Peran baru"
      submitLabel="Buat peran"
      submittingLabel="Membuat…"
      pending={pending}
      disabled={!nameReady}
      disabledReason={nameReady ? undefined : "Nama peran minimal 3 karakter."}
      statusText={
        source
          ? `Menyalin ${source.permissions.length} izin dari ${formatRoleName(source.name)}. Anda dapat menyesuaikannya setelah peran dibuat.`
          : "Peran dibuat tanpa izin. Nyalakan izinnya setelah peran tersimpan."
      }
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <FormSection title="Identitas peran">
        <FormField
          label="Nama peran"
          htmlFor="new-role-name"
          required
          helper="Huruf, angka, spasi, - dan _. Disimpan dalam huruf kapital."
        >
          <TextInput
            id="new-role-name"
            value={form.name}
            onChange={(value) => onFormChange({ ...form, name: value })}
            placeholder="Site Supervisor"
          />
        </FormField>
        <FormField label="Deskripsi" htmlFor="new-role-description" optional>
          <Textarea
            id="new-role-description"
            value={form.description}
            onChange={(value) => onFormChange({ ...form, description: value })}
            rows={2}
            placeholder="Tanggung jawab peran ini dalam satu kalimat."
          />
        </FormField>
      </FormSection>

      {/*
       * `AdaptiveSelect` sudah merender labelnya sendiri; membungkusnya dengan
       * `FormField` mencetak label yang sama dua kali. Pola bakunya adalah
       * select langsung sebagai anak `FormSection`.
       */}
      <FormSection
        title="Titik awal izin"
        helper="Peran baru biasanya versi lebih sempit dari peran yang sudah ada."
      >
        <AdaptiveSelect
          id="new-role-source"
          label="Salin izin dari"
          value={form.duplicateFromRoleId}
          placeholder="Mulai tanpa izin"
          optional
          options={roles.map((role) => ({
            value: role.id,
            label: formatRoleName(role.name),
            description: `${role.permissions.length} izin`,
          }))}
          onChange={(value) => onFormChange({ ...form, duplicateFromRoleId: value })}
        />
      </FormSection>

      <FormSection
        title="Cakupan data proyek"
        helper="Menentukan proyek mana yang terlihat, terpisah dari daftar izin."
      >
        <div
          role="radiogroup"
          aria-label="Cakupan data proyek"
          className="divide-y divide-outline-variant/20"
        >
          {DATA_SCOPE_OPTIONS.map((option) => (
            <ChoiceRow
              key={option.value}
              selectionMode="radio"
              checked={form.dataScope === option.value}
              onChange={() => onFormChange({ ...form, dataScope: option.value })}
              title={option.label}
              description={option.description}
            />
          ))}
        </div>
      </FormSection>
    </OperationalFormSheet>
  );
}
