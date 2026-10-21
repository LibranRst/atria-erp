"use client";

import { motion, useReducedMotion } from "framer-motion";
import React from "react";
import { toast } from "sonner";

import {
  createRole,
  deleteRole,
  updateRoleDetails,
  updateRolePermissions,
} from "@/app/actions/administration-roles";
import {
  AppIcon,
  ConfirmationDialog,
  GroupedSurface,
  InlineStateRow,
  WorkspaceStatusLabel,
  Button,
} from "@/components/ui";
import { usePermissions } from "@/components/auth/permissions-provider";
import { parsePermissionKeyList, ROLE_DEEP_LINK_PARAMS } from "@atria/core/auth/role-deep-link";
import type { PermissionKey, RoleDataScope } from "@atria/core/auth/permissions";
import { useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { transitionSpringSnappy, buttonTapActiveScale } from "@/lib/utils/motion";
import type { ManagedRole } from "@/server/usecases/administration/roles";
import {
  arePermissionsDirty,
  describeDataScope,
  formatRoleName,
  isDetailsDirty,
  normalizeRoleName,
  summarizeRole,
  toRoleDraft,
  type RoleDraft,
} from "../../utils/role-editor";
import { EMPTY_ROLE_CREATE_FORM, RoleCreateSheet, type RoleCreateForm } from "./role-create-sheet";
import { RoleEditorSheet } from "./role-editor-sheet";
import { ManagedRolesReadContext, ManagedRolesReadProvider } from "./managed-roles-read-provider";
import { useAdministrationTable } from "../../hooks/use-administration-table";
import {
  AdministrationDesktopTable,
  AdministrationRoleTableSkeleton,
  administrationRoleColumns,
  administrationRoleFilter,
  administrationRoleSearch,
} from "../workspaces/desktop-administration-tables";

function isDataScope(value: string | null): value is RoleDataScope {
  return value === "GLOBAL" || value === "ASSIGNED" || value === "NONE";
}

const EMPTY_DRAFT: RoleDraft = {
  name: "",
  description: "",
  dataScope: "NONE",
  permissions: [],
};

/**
 * Modul "Peran & akses".
 *
 * Datanya dimuat saat modul dibuka, bukan ikut setiap pemuatan Settings: peran
 * jarang disentuh, dan daftar izin lengkapnya jauh lebih berat daripada sisa
 * halaman.
 */
type RoleAccessManagerProps = {
  /** The workspace owns its create trigger, alongside Team and Vendor. */
  readonly createOpen: boolean;
  readonly onCreateOpenChange: (open: boolean) => void;
  readonly onBusyChange?: (busy: boolean) => void;
};

export function RoleAccessManager(props: RoleAccessManagerProps): React.JSX.Element {
  const source = React.useContext(ManagedRolesReadContext);
  if (!source)
    return (
      <ManagedRolesReadProvider generation="standalone">
        <RoleAccessManager {...props} />
      </ManagedRolesReadProvider>
    );
  return <RoleAccessManagerContent key={source.scopeKey} {...props} source={source} />;
}

function RoleAccessManagerContent({
  createOpen,
  onCreateOpenChange,
  onBusyChange,
  source,
}: RoleAccessManagerProps & {
  readonly source: NonNullable<React.ContextType<typeof ManagedRolesReadContext>>;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const editorPermissions = usePermissions();
  const reduceMotion = useReducedMotion();
  const roles = source.data ?? (source.error ? [] : null);
  const loadError = source.error;
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<ManagedRole | null>(null);
  const activate = source.activate;
  React.useEffect(() => activate(), [activate]);
  const [pending, setPending] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [linkConsumed, setLinkConsumed] = React.useState(false);
  const [createLinkConsumed, setCreateLinkConsumed] = React.useState(false);
  const [draftRoleId, setDraftRoleId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<RoleDraft>(EMPTY_DRAFT);
  const [createForm, setCreateForm] = React.useState<RoleCreateForm>(EMPTY_ROLE_CREATE_FORM);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const roleTable = useAdministrationTable(
    roles ?? [],
    administrationRoleColumns,
    administrationRoleSearch,
    administrationRoleFilter,
    "admin-roles",
  );

  /*
   * Saran dari kartu asisten: peran mana yang dibuka, dan sakelar mana yang
   * disorot. Sengaja hanya menyorot — tidak ada satu pun sakelar yang berubah
   * sendiri, karena yang menekan harus tetap manusia.
   */
  const linkedRoleId = useBrowserUrlSearchParam(ROLE_DEEP_LINK_PARAMS.role);
  const linkedName = useBrowserUrlSearchParam(ROLE_DEEP_LINK_PARAMS.name);
  const linkedScope = useBrowserUrlSearchParam(ROLE_DEEP_LINK_PARAMS.scope);
  const grantParam = useBrowserUrlSearchParam(ROLE_DEEP_LINK_PARAMS.grant);
  const revokeParam = useBrowserUrlSearchParam(ROLE_DEEP_LINK_PARAMS.revoke);
  const suggestions = React.useMemo(
    () => ({
      grant: parsePermissionKeyList(grantParam) as readonly PermissionKey[],
      revoke: parsePermissionKeyList(revokeParam) as readonly PermissionKey[],
    }),
    [grantParam, revokeParam],
  );

  /*
   * Peran yang terbuka: pilihan pengguna kalau ada, kalau tidak yang ditunjuk
   * tautan sampai sheet-nya ditutup sekali. Diturunkan saat render, bukan lewat
   * efek — efek yang memanggil setState di sini akan membuka ulang sheet setiap
   * kali ditutup, karena parameter URL-nya masih di tempat.
   */
  const effectiveSelectedId = selectedId ?? (linkConsumed ? null : linkedRoleId);

  /*
   * Isian awal sheet pembuatan dari `?name=`/`?scope=` — jalan keluar untuk
   * permintaan yang ditolak jalur asisten.
   *
   * Yang MEMBUKA sheet-nya adalah `AdministrationManager`, karena state itu
   * miliknya: menyetel state komponen lain saat render bukan sekadar tidak
   * rapi, React menolaknya. Yang disiapkan di sini hanyalah isian formulir,
   * dan hanya sekali — setelah itu formulirnya milik pengguna sepenuhnya.
   */
  if (createOpen && (linkedName || linkedScope) && !createLinkConsumed) {
    setCreateLinkConsumed(true);
    setCreateForm({
      ...EMPTY_ROLE_CREATE_FORM,
      name: linkedName ?? "",
      dataScope: isDataScope(linkedScope) ? linkedScope : EMPTY_ROLE_CREATE_FORM.dataScope,
    });
  }
  const selected =
    roles?.find((role) => role.id === effectiveSelectedId) ??
    (source.loading && !source.accessDenied && selectedSnapshot?.id === effectiveSelectedId
      ? selectedSnapshot
      : null);

  // Menyiapkan draft saat peran yang terbuka berganti. Menyetel state selama
  // render adalah pola React untuk menyesuaikan state terhadap perubahan props.
  if (selected && selected.id !== draftRoleId) {
    setDraftRoleId(selected.id);
    setSelectedSnapshot(selected);
    setDraft(toRoleDraft(selected));
  }

  const customCount = roles?.filter((role) => !role.isSystem).length ?? 0;

  /** Mutations await the next retained source read before releasing their pending guard. */
  async function load(): Promise<void> {
    await source.refresh();
  }

  function openRole(role: ManagedRole): void {
    setSelectedId(role.id);
  }

  function closeEditor(): void {
    if (pending) return;
    setSelectedId(null);
    setLinkConsumed(true);
    setDraftRoleId(null);
  }

  const detailsDirty = selected ? isDetailsDirty(selected, draft) : false;
  const permissionsDirty = selected ? arePermissionsDirty(selected, draft) : false;
  const busy = createOpen || selected !== null || deleteOpen || pending;
  React.useEffect(() => {
    onBusyChange?.(busy);
    return (): void => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  async function submitEditor(): Promise<void> {
    if (!selected) return;
    setPending(true);

    if (detailsDirty) {
      const result = await updateRoleDetails({
        roleId: selected.id,
        name: normalizeRoleName(draft.name),
        description: draft.description.trim() || undefined,
        dataScope: draft.dataScope,
      });
      if (!result.success) {
        setPending(false);
        toast.error(result.error.message);
        return;
      }
    }

    if (permissionsDirty) {
      const result = await updateRolePermissions({
        roleId: selected.id,
        permissions: [...draft.permissions],
      });
      if (!result.success) {
        setPending(false);
        toast.error(result.error.message);
        return;
      }
    }

    await load();
    setPending(false);
    setSelectedId(null);
    setLinkConsumed(true);
    setDraftRoleId(null);
    toast.success("Peran diperbarui.");
  }

  async function submitCreate(): Promise<void> {
    setPending(true);
    const result = await createRole({
      name: createForm.name,
      description: createForm.description.trim() || undefined,
      dataScope: createForm.dataScope,
      permissions: [],
      duplicateFromRoleId: createForm.duplicateFromRoleId || undefined,
    });
    if (!result.success) {
      setPending(false);
      toast.error(result.error.message);
      return;
    }

    await load();
    setPending(false);
    onCreateOpenChange(false);
    setCreateForm(EMPTY_ROLE_CREATE_FORM);
    toast.success("Peran dibuat. Sesuaikan izinnya bila perlu.");
  }

  async function submitDelete(): Promise<void> {
    if (!selected) return;
    setPending(true);
    const result = await deleteRole({ roleId: selected.id });
    if (!result.success) {
      setPending(false);
      toast.error(result.error.message);
      return;
    }

    await load();
    setPending(false);
    setDeleteOpen(false);
    setSelectedId(null);
    setLinkConsumed(true);
    setDraftRoleId(null);
    toast.success("Peran dihapus.");
  }

  return (
    <section className={`min-w-0 ${desktop ? "space-y-4" : "space-y-sm"}`}>
      {desktop ? (
        roles === null ? (
          <AdministrationRoleTableSkeleton />
        ) : loadError ? (
          <GroupedSurface variant="desktopPanel">
            <InlineStateRow
              icon="lock"
              tone="warning"
              title="Peran belum dapat dimuat"
              description={loadError}
            />
            <div className="px-4 pb-4">
              <Button variant="secondary" size="compact" onClick={() => void load()}>
                Coba lagi
              </Button>
            </div>
          </GroupedSurface>
        ) : (
          <AdministrationDesktopTable
            title="Peran dan akses"
            description="Cakupan data dan izin yang menentukan akses setiap anggota tim."
            summary={[
              { label: "Peran", value: roles.length },
              { label: "Kustom", value: customCount },
            ]}
            table={roleTable}
            columns={administrationRoleColumns}
            filters={[
              { value: "all", label: "Semua peran" },
              { value: "system", label: "Bawaan" },
              { value: "custom", label: "Kustom" },
            ]}
            rowKey={(row): string => row.id}
            onRowAction={openRole}
            selectedRowKey={effectiveSelectedId}
            emptyTitle="Belum ada peran"
          />
        )
      ) : (
        <>
          <div className="flex min-h-8 items-center justify-between gap-3 px-1">
            <h3 className="text-section font-bold text-on-surface">Daftar peran</h3>
            <span className="text-eyebrow font-semibold text-on-surface-variant">
              {roles === null ? "Memuat…" : `${customCount} kustom dari ${roles.length}`}
            </span>
          </div>

          <GroupedSurface>
            {roles === null ? (
              <div className="divide-y divide-outline-variant/20" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="flex min-h-18 items-center gap-3 px-3.5 py-3">
                    <div className="h-10 w-10 shrink-0 rounded-[14px] bg-surface-container-low" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3 w-2/5 rounded-full bg-surface-container-low" />
                      <div className="h-2.5 w-3/5 rounded-full bg-surface-container-low" />
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <InlineStateRow
                icon="lock"
                tone="warning"
                title="Peran belum dapat dimuat"
                description={loadError}
              />
            ) : (
              <div className="divide-y divide-outline-variant/20">
                {roles.map((role) => (
                  <motion.button
                    key={role.id}
                    type="button"
                    onClick={() => openRole(role)}
                    whileTap={reduceMotion ? undefined : { scale: buttonTapActiveScale }}
                    transition={transitionSpringSnappy}
                    className="flex min-h-18 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container-low/70"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-surface-container-low text-on-surface-variant"
                      aria-hidden="true"
                    >
                      <AppIcon name="verified_user" className="icon-md" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-row font-bold text-on-surface">
                        {formatRoleName(role.name)}
                      </span>
                      <span className="block truncate text-meta text-on-surface-variant">
                        {summarizeRole(role)}
                      </span>
                      {/*
                       * Cakupan dapat barisnya sendiri: digabung ke baris di atas,
                       * ia justru yang terpotong lebih dulu pada 320–375 px —
                       * padahal ia satu-satunya fakta di baris itu yang tidak bisa
                       * ditebak dari nama peran.
                       */}
                      <span className="mt-0.5 block truncate text-meta text-on-surface-variant/85">
                        {describeDataScope(role.dataScope)}
                      </span>
                    </span>
                    <div className="flex flex-row items-center">
                      {role.isOwnerRole ? (
                        <WorkspaceStatusLabel label="Terkunci" tone="inactive" />
                      ) : role.isSystem ? (
                        <WorkspaceStatusLabel label="Bawaan" tone="neutral" />
                      ) : (
                        <WorkspaceStatusLabel label="Kustom" tone="positive" />
                      )}
                      <AppIcon
                        name="chevron_right"
                        className="icon-sm shrink-0 text-on-surface-variant/55"
                        aria-hidden="true"
                      />
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </GroupedSurface>
        </>
      )}

      <RoleEditorSheet
        open={selected !== null}
        role={selected}
        draft={draft}
        editorPermissions={editorPermissions}
        suggestions={selected && selected.id === linkedRoleId ? suggestions : undefined}
        pending={pending}
        dirty={detailsDirty || permissionsDirty}
        readOnly={selected?.isOwnerRole === true}
        readOnlyReason="Peran Owner tidak dapat diubah — ia adalah jalan keluar terakhir bila konfigurasi peran lain terkunci."
        onDraftChange={setDraft}
        onClose={closeEditor}
        onSubmit={() => void submitEditor()}
        onDelete={() => setDeleteOpen(true)}
      />

      {/* Satu sheet pada satu waktu: penyunting menang, karena ia yang sedang
          memegang perubahan yang belum disimpan. */}
      <RoleCreateSheet
        open={createOpen && selected === null}
        form={createForm}
        roles={roles ?? []}
        pending={pending}
        onFormChange={setCreateForm}
        onClose={() => {
          if (pending) return;
          onCreateOpenChange(false);
        }}
        onSubmit={() => void submitCreate()}
      />

      <ConfirmationDialog
        open={deleteOpen}
        tone="danger"
        title="Hapus peran ini?"
        description={
          selected
            ? `${formatRoleName(selected.name)} akan dihapus permanen beserta seluruh izinnya.`
            : ""
        }
        confirmLabel="Hapus peran"
        pending={pending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void submitDelete()}
      />
    </section>
  );
}
