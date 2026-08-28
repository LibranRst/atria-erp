"use client";

import React from "react";

import {
  AppIcon,
  ChoiceRow,
  FormDisclosure,
  FormField,
  FormSection,
  GroupedSurface,
  InlineStateRow,
  OperationalFormSheet,
  Textarea,
  TextInput,
} from "@/components/ui";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ManagedRole } from "@/server/usecases/administration/roles";
import {
  buildPermissionGroups,
  DATA_SCOPE_OPTIONS,
  describePermissionRow,
  togglePermission,
  type RoleDraft,
  type RoleSuggestions,
} from "../../utils/role-editor";

/**
 * Penyunting satu peran.
 *
 * Sheet ini menampilkan **seluruh** kunci izin, bukan hanya yang menyala:
 * pertanyaan yang dijawab Owner di sini adalah "peran ini boleh apa saja",
 * dan daftar yang hanya memuat izin aktif tidak bisa menjawabnya.
 *
 * Izin yang tidak dipegang penyunting tampil terkunci dengan alasannya, sesuai
 * aturan anti-eskalasi yang ditegakkan server.
 */
export function RoleEditorSheet({
  open,
  role,
  draft,
  editorPermissions,
  suggestions,
  pending,
  dirty,
  readOnly,
  readOnlyReason,
  onDraftChange,
  onClose,
  onSubmit,
  onDelete,
}: {
  readonly open: boolean;
  readonly role: ManagedRole | null;
  readonly draft: RoleDraft;
  readonly editorPermissions: readonly PermissionKey[];
  /** Sorotan dari kartu asisten; tidak mengubah satu pun nilai sakelar. */
  readonly suggestions?: RoleSuggestions;
  readonly pending: boolean;
  readonly dirty: boolean;
  readonly readOnly: boolean;
  readonly readOnlyReason?: string;
  readonly onDraftChange: (draft: RoleDraft) => void;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
  readonly onDelete: () => void;
}): React.JSX.Element {
  const [expandedGroups, setExpandedGroups] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [autoExpandedFor, setAutoExpandedFor] = React.useState<string | null>(null);
  const groups = buildPermissionGroups(draft.permissions, editorPermissions, {
    lockEverything: readOnly,
    suggestions,
  });
  const totalSuggested = groups.reduce((sum, group) => sum + group.suggestedCount, 0);

  /*
   * Membuka SETIAP grup yang memuat saran, bukan hanya yang pertama.
   *
   * Orang yang baru menekan "Buka di Peran & akses" datang dari kartu yang
   * menyebut tiga perubahan; membuka satu grup saja menyembunyikan dua di
   * antaranya di balik delapan panel tertutup. Disesuaikan saat render dan
   * hanya sekali per himpunan saran, sehingga pengguna tetap bebas menutupnya.
   */
  const suggestedGroupKeys = groups
    .filter((group) => group.suggestedCount > 0)
    .map((group) => group.key);
  const suggestionSignature = suggestedGroupKeys.join(",");
  if (suggestionSignature.length > 0 && autoExpandedFor !== suggestionSignature) {
    setAutoExpandedFor(suggestionSignature);
    setExpandedGroups(new Set(suggestedGroupKeys));
  }

  function toggleGroup(key: string): void {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const nameLocked = readOnly || role?.isSystem === true;

  function setPermission(key: PermissionKey, next: boolean): void {
    onDraftChange({ ...draft, permissions: togglePermission(draft.permissions, key, next) });
  }

  return (
    <OperationalFormSheet
      open={open}
      title={role ? draft.name : "Peran"}
      submitLabel="Simpan peran"
      submittingLabel="Menyimpan…"
      pending={pending}
      hideSubmit={readOnly}
      disabled={!dirty}
      disabledReason={dirty ? undefined : "Belum ada perubahan."}
      statusText={
        readOnly
          ? readOnlyReason
          : "Perubahan izin berlaku pada permintaan berikutnya setiap pemegang peran ini."
      }
      statusTone={readOnly ? "warning" : "default"}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {totalSuggested > 0 ? (
        <GroupedSurface>
          <InlineStateRow
            icon="chat"
            tone="neutral"
            title={`${totalSuggested} saran dari asisten`}
            description="Baris bertanda Disarankan belum diterapkan. Anda yang menekannya."
          />
        </GroupedSurface>
      ) : null}

      <FormSection title="Identitas peran">
        <FormField
          label="Nama peran"
          htmlFor="role-name"
          required
          readOnly={nameLocked}
          helper={
            role?.isSystem
              ? "Peran bawaan sistem — namanya dipakai kode dan tidak dapat diubah."
              : "Huruf, angka, spasi, - dan _. Disimpan dalam huruf kapital."
          }
        >
          <TextInput
            id="role-name"
            value={draft.name}
            onChange={(value) => onDraftChange({ ...draft, name: value })}
            readOnly={nameLocked}
            placeholder="Site Supervisor"
          />
        </FormField>
        <FormField label="Deskripsi" htmlFor="role-description" optional readOnly={readOnly}>
          <Textarea
            id="role-description"
            value={draft.description}
            onChange={(value) => onDraftChange({ ...draft, description: value })}
            readOnly={readOnly}
            rows={2}
            placeholder="Tanggung jawab peran ini dalam satu kalimat."
          />
        </FormField>
      </FormSection>

      {/*
       * Cakupan memakai bahasa yang sama dengan sisa sheet: panel putih berbaris
       * dengan pemisah. `OptionChoiceGroup` membawa permukaan abu-abunya
       * sendiri, sehingga di sini ia tampil sebagai kotak asing yang bersarang
       * di dalam panel — bukan bagian dari formulir yang sama.
       */}
      <FormSection
        title="Cakupan data proyek"
        helper={
          readOnly
            ? undefined
            : "Menentukan proyek mana yang terlihat, terpisah dari daftar izin di bawah."
        }
      >
        {readOnly ? (
          <FormField label="Proyek yang dapat diakses" readOnly>
            <p className="text-row font-bold text-on-surface">
              {DATA_SCOPE_OPTIONS.find((option) => option.value === draft.dataScope)?.label ??
                draft.dataScope}
            </p>
          </FormField>
        ) : (
          <div
            role="radiogroup"
            aria-label="Cakupan data proyek"
            className="divide-y divide-outline-variant/20"
          >
            {DATA_SCOPE_OPTIONS.map((option) => (
              <ChoiceRow
                key={option.value}
                selectionMode="radio"
                checked={draft.dataScope === option.value}
                onChange={() => onDraftChange({ ...draft, dataScope: option.value })}
                title={option.label}
                description={option.description}
              />
            ))}
          </div>
        )}
      </FormSection>

      <FormSection
        title="Izin"
        helper="Baris bertanda Terkunci adalah izin yang tidak Anda pegang sendiri."
        presentation="plain"
      >
        <div className="space-y-1.5">
          {groups.map((group) => (
            <FormDisclosure
              key={group.key}
              title={group.title}
              description={group.description}
              summary={
                group.suggestedCount > 0
                  ? `${group.activeCount}/${group.totalCount} · ${group.suggestedCount} saran`
                  : `${group.activeCount}/${group.totalCount}`
              }
              variant="compact"
              icon={<AppIcon name={group.iconName} className="icon-sm" aria-hidden="true" />}
              expanded={expandedGroups.has(group.key)}
              onToggle={() => toggleGroup(group.key)}
            >
              {/*
               * `ChoiceRow` alih-alih `SwitchRow`: baris turun dari 87 px ke
               * 58 px, dan kotak centang memang bentuk yang benar di sini —
               * sakelar menyiratkan efek seketika, padahal daftar ini baru
               * berlaku setelah tombol simpan ditekan.
               */}
              <FormSection presentation="grouped">
                {group.toggles.map((toggle) => (
                  <ChoiceRow
                    key={toggle.key}
                    emphasis="neutral"
                    checked={toggle.checked}
                    disabled={toggle.locked}
                    onChange={(next) => setPermission(toggle.key, next)}
                    title={toggle.label}
                    description={describePermissionRow(toggle)}
                  />
                ))}
              </FormSection>
            </FormDisclosure>
          ))}
        </div>
      </FormSection>

      {role && !readOnly && !role.isSystem ? (
        <FormSection title="Hapus peran" presentation="plain">
          <GroupedSurface>
            <InlineStateRow
              icon="delete"
              tone={role.userCount > 0 ? "warning" : "critical"}
              title={role.userCount > 0 ? "Masih dipakai" : "Hapus peran ini"}
              description={
                role.userCount > 0
                  ? `${role.userCount} pengguna memakai peran ini. Pindahkan mereka lebih dulu.`
                  : "Peran tanpa pemegang dapat dihapus permanen."
              }
              action={
                role.userCount === 0 ? (
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={pending}
                    className="min-h-10 rounded-full bg-error-container px-3.5 text-meta font-bold text-on-error-container outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-45"
                  >
                    Hapus
                  </button>
                ) : null
              }
            />
          </GroupedSurface>
        </FormSection>
      ) : null}
    </OperationalFormSheet>
  );
}
