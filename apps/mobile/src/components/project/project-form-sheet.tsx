import { useScreenQuery, useOnline } from "@/lib/use-screen-query";
import { isAccessRevoked } from "@/lib/access-error";
import { screenLoadState } from "@/lib/screen-query-state";
import { ScreenQueryState, ScreenRefreshNotice } from "@/components/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner-native";

import {
  Button,
  FormField,
  FormSection,
  AdaptiveSelect,
  ComboboxField,
  DatePickerField,
  FormDisclosure,
  SmartDefaultHint,
  ProjectFormSkeleton,
  SkeletonFooter,
  SuccessDialog,
  TextInput,
  WorkflowFormSheet,
  BottomSheet,
  useSheetDismissal,
  useSheetFormFields,
  type SelectOption,
} from "@/components/ui";
import { trpcClient } from "@/lib/trpc-client";
import {
  COMMON_ROOM_OPTIONS,
  PROJECT_TYPE_OPTIONS,
} from "@atria/core/presentation/project-input-options";

type ProjectFormDraft = {
  readonly name: string;
  readonly clientId: string;
  readonly isNewClient: boolean;
  readonly newClientName: string;
  readonly newClientEmail: string;
  readonly newClientPhone: string;
  readonly newClientAddress: string;
  readonly projectManagerId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly location: string;
  readonly roomArea: string;
  readonly projectType: string;
  readonly notes: string;
};

type ProjectBootstrapResult = Awaited<ReturnType<typeof trpcClient.project.bootstrap.query>>;
type ProjectBootstrapReady = Extract<ProjectBootstrapResult, { readonly status: "ready" }>;

function blankDraft(): ProjectFormDraft {
  return {
    name: "",
    clientId: "",
    isNewClient: false,
    newClientName: "",
    newClientEmail: "",
    newClientPhone: "",
    newClientAddress: "",
    projectManagerId: "",
    startDate: "",
    endDate: "",
    location: "",
    roomArea: "",
    projectType: "",
    notes: "",
  };
}

function createInitialDraft(data: ProjectBootstrapReady): ProjectFormDraft {
  const project = data.project;
  if (!project) {
    return {
      ...blankDraft(),
      projectManagerId:
        data.projectManagers.length === 1 ? (data.projectManagers[0]?.id ?? "") : "",
    };
  }
  return {
    ...blankDraft(),
    name: project.name,
    clientId: project.clientId,
    projectManagerId: project.projectManagerId ?? "",
    startDate: project.startDate?.slice(0, 10) ?? "",
    endDate: project.endDate?.slice(0, 10) ?? "",
    location: project.location ?? "",
    roomArea: project.roomArea ?? "",
    projectType: project.projectType ?? "",
    notes: project.notes ?? "",
  };
}

function getDateError(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return null;
  return endDate < startDate ? "Tanggal selesai tidak boleh lebih awal dari tanggal mulai." : null;
}

function ReadyProjectForm({
  data,
  projectId,
}: {
  readonly data: ProjectBootstrapReady;
  readonly projectId?: string;
}): React.JSX.Element {
  const online = useOnline();
  const queryClient = useQueryClient();
  const editMode = Boolean(projectId);
  const [draft, setDraft] = useState<ProjectFormDraft>(() => createInitialDraft(data));
  const [initialDraft] = useState(() => JSON.stringify(draft));
  const fields = useSheetFormFields();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [operationalExpanded, setOperationalExpanded] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dismissal = useSheetDismissal({
    dirty: JSON.stringify(draft) !== initialDraft,
    pending: submitting || successMessage !== null,
    fields,
  });

  const clientOptions = useMemo<readonly SelectOption[]>(
    () => data.clients.map((client) => ({ value: client.id, label: client.name })),
    [data.clients],
  );
  const projectManagerOptions = useMemo<readonly SelectOption[]>(
    () =>
      data.projectManagers.map((manager) => ({
        value: manager.id,
        label: manager.name,
      })),
    [data.projectManagers],
  );
  const dateError = getDateError(draft.startDate, draft.endDate);

  function patch(next: Partial<ProjectFormDraft>): void {
    setDraft((current) => ({ ...current, ...next }));
    setFieldErrors({});
    setError(null);
  }

  function validate(): { readonly field: string; readonly message: string } | null {
    if (!draft.name.trim()) return { field: "name", message: "Nama proyek wajib diisi." };
    if (draft.isNewClient && !draft.newClientName.trim())
      return { field: "newClientName", message: "Nama klien baru wajib diisi." };
    if (!draft.isNewClient && !draft.clientId)
      return { field: "client", message: "Pilih klien untuk proyek ini." };
    if (!draft.projectManagerId)
      return { field: "projectManager", message: "Pilih Project Manager untuk proyek ini." };
    return dateError ? { field: "endDate", message: dateError } : null;
  }

  async function submit(): Promise<void> {
    if (!online) {
      toast.error("Hubungkan ke internet untuk mengirim form.");
      return;
    }
    const validationError = validate();
    if (validationError) {
      setFieldErrors({ [validationError.field]: validationError.message });
      requestAnimationFrame(() => fields.focus(validationError.field));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result =
        editMode && projectId
          ? await trpcClient.project.update.mutate({
              id: projectId,
              name: draft.name.trim(),
              clientId: draft.clientId,
              projectManagerId: draft.projectManagerId,
              startDate: draft.startDate,
              endDate: draft.endDate,
              location: draft.location.trim(),
              roomArea: draft.roomArea.trim(),
              projectType: draft.projectType.trim(),
              notes: draft.notes.trim(),
            })
          : await trpcClient.project.create.mutate({
              name: draft.name.trim(),
              clientId: draft.isNewClient ? undefined : draft.clientId,
              newClientName: draft.isNewClient ? draft.newClientName.trim() : undefined,
              newClientEmail: draft.isNewClient ? draft.newClientEmail.trim() : undefined,
              newClientPhone: draft.isNewClient ? draft.newClientPhone.trim() : undefined,
              newClientAddress: draft.isNewClient ? draft.newClientAddress.trim() : undefined,
              projectManagerId: draft.projectManagerId,
              startDate: draft.startDate,
              endDate: draft.endDate,
              location: draft.location.trim(),
              roomArea: draft.roomArea.trim(),
              projectType: draft.projectType.trim(),
              notes: draft.notes.trim(),
            });

      if (!result.success) {
        setError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["screen", "projects"] });
      toast.success(editMode ? "Proyek berhasil diperbarui." : "Proyek berhasil dibuat.");
      setSuccessMessage(editMode ? "Proyek diperbarui" : "Proyek berhasil dibuat");
    } catch {
      const message = "Perubahan belum tersimpan. Periksa koneksi lalu coba lagi.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const operationalCount = [
    draft.startDate,
    draft.endDate,
    draft.location,
    draft.roomArea,
    draft.projectType,
    draft.notes,
  ].filter(Boolean).length;
  return (
    <WorkflowFormSheet
      description={
        editMode
          ? "Perbarui data operasional proyek tanpa mengubah budget atau status aktivasi."
          : "Isi identitas utama. Budget dan aktivasi disiapkan pada langkah terpisah."
      }
      loadingContent={<ProjectFormSkeleton editMode={editMode} />}
      dismissal={dismissal}
      fields={fields}
      bodyOverlay={
        <SuccessDialog
          visible={successMessage !== null}
          title={successMessage ?? "Proyek tersimpan"}
          description="Data proyek sudah tersimpan."
          facts={[{ label: "Proyek", value: draft.name }]}
          onClose={dismissal.complete}
        />
      }
      footerStatus={error}
      footer={
        <Button
          disabled={!online || successMessage !== null}
          loading={submitting}
          onPress={() => void submit()}
        >
          {editMode ? "Simpan" : "Buat proyek"}
        </Button>
      }
      title={editMode ? "Ubah proyek" : "Proyek baru"}
    >
      {!online ? <ScreenRefreshNotice query={{ data, error: null, fetchStatus: "idle" }} /> : null}
      <FormSection title="Identitas inti" helper="Nama, klien, dan PM menentukan ownership proyek.">
        <FormField fieldId="name" error={fieldErrors.name} label="Nama proyek" required>
          <TextInput
            editable={!submitting && successMessage === null}
            accessibilityLabel="Nama proyek"
            autoCapitalize="words"
            invalid={Boolean(fieldErrors.name)}
            onChangeText={(name) => patch({ name })}
            placeholder="Contoh: Renovasi Rumah Cilandak"
            returnKeyType="next"
            value={draft.name}
          />
        </FormField>
        {!editMode ? (
          <AdaptiveSelect
            disabled={submitting || successMessage !== null}
            fieldId="clientKind"
            label="Jenis klien"
            value={draft.isNewClient ? "new" : "existing"}
            options={[
              { value: "existing", label: "Klien terdaftar" },
              { value: "new", label: "Klien baru" },
            ]}
            onChange={(value) => patch({ isNewClient: value === "new" })}
          />
        ) : null}
        {!draft.isNewClient ? (
          <AdaptiveSelect
            disabled={submitting || successMessage !== null}
            fieldId="client"
            error={fieldErrors.client}
            label="Klien"
            options={clientOptions}
            required
            value={draft.clientId}
            onChange={(clientId) => patch({ clientId })}
          />
        ) : (
          <>
            <FormField
              fieldId="newClientName"
              error={fieldErrors.newClientName}
              label="Nama klien baru"
              required
            >
              <TextInput
                editable={!submitting && successMessage === null}
                accessibilityLabel="Nama klien baru"
                autoCapitalize="words"
                invalid={Boolean(fieldErrors.newClientName)}
                onChangeText={(newClientName) => patch({ newClientName })}
                placeholder="Nama klien"
                value={draft.newClientName}
              />
            </FormField>
            <FormField label="Email klien" optional>
              <TextInput
                editable={!submitting && successMessage === null}
                accessibilityLabel="Email klien"
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(newClientEmail) => patch({ newClientEmail })}
                placeholder="nama@email.com"
                value={draft.newClientEmail}
              />
            </FormField>
            <FormField label="Nomor telepon" optional>
              <TextInput
                editable={!submitting && successMessage === null}
                accessibilityLabel="Nomor telepon klien"
                keyboardType="phone-pad"
                onChangeText={(newClientPhone) => patch({ newClientPhone })}
                placeholder="08xx"
                value={draft.newClientPhone}
              />
            </FormField>
            <FormField label="Alamat klien" optional>
              <TextInput
                editable={!submitting && successMessage === null}
                accessibilityLabel="Alamat klien"
                onChangeText={(newClientAddress) => patch({ newClientAddress })}
                placeholder="Alamat korespondensi"
                value={draft.newClientAddress}
              />
            </FormField>
          </>
        )}
        <AdaptiveSelect
          disabled={submitting || successMessage !== null}
          fieldId="projectManager"
          error={fieldErrors.projectManager}
          label="Project Manager"
          options={projectManagerOptions}
          required
          value={draft.projectManagerId}
          onChange={(projectManagerId) => patch({ projectManagerId })}
        />
        {data.projectManagers.length === 1 && draft.projectManagerId ? (
          <SmartDefaultHint>
            Project Manager otomatis dipilih karena hanya ada satu opsi aktif.
          </SmartDefaultHint>
        ) : null}
      </FormSection>
      <FormDisclosure
        title="Detail operasional"
        description="Jadwal, lokasi, dan catatan proyek"
        summary={operationalCount ? `${operationalCount} terisi` : "Opsional"}
        expanded={operationalExpanded}
        onToggle={() => setOperationalExpanded((value) => !value)}
        fieldIds={["startDate", "endDate", "location", "roomArea", "projectType", "notes"]}
      >
        <FormSection title="Jadwal dan lokasi" helper="Konteks utama untuk pelaksanaan proyek.">
          <DatePickerField
            disabled={submitting || successMessage !== null}
            fieldId="startDate"
            label="Tanggal mulai"
            value={draft.startDate}
            optional
            onChange={(startDate) => patch({ startDate })}
          />
          <DatePickerField
            disabled={submitting || successMessage !== null}
            fieldId="endDate"
            label="Tanggal selesai"
            value={draft.endDate}
            optional
            error={fieldErrors.endDate ?? dateError ?? undefined}
            minimumDate={draft.startDate || undefined}
            onChange={(endDate) => patch({ endDate })}
          />
          <FormField fieldId="location" label="Lokasi" optional>
            <TextInput
              editable={!submitting && successMessage === null}
              accessibilityLabel="Lokasi proyek"
              onChangeText={(location) => patch({ location })}
              placeholder="Area atau alamat proyek"
              value={draft.location}
            />
          </FormField>
          <ComboboxField
            disabled={submitting || successMessage !== null}
            fieldId="roomArea"
            label="Ruangan/Area"
            value={draft.roomArea}
            options={COMMON_ROOM_OPTIONS}
            placeholder="Pilih atau ketik area"
            onChange={(roomArea) => patch({ roomArea })}
          />
          <ComboboxField
            disabled={submitting || successMessage !== null}
            fieldId="projectType"
            label="Tipe proyek"
            value={draft.projectType}
            options={PROJECT_TYPE_OPTIONS}
            placeholder="Pilih atau ketik tipe"
            onChange={(projectType) => patch({ projectType })}
          />
        </FormSection>
        <FormSection title="Catatan" helper="Informasi pendukung yang dapat dilengkapi nanti.">
          <FormField fieldId="notes" label="Catatan proyek" optional>
            <TextInput
              editable={!submitting && successMessage === null}
              accessibilityLabel="Catatan internal proyek"
              multiline
              onChangeText={(notes) => patch({ notes })}
              placeholder="Konteks singkat untuk tim proyek"
              textAlignVertical="top"
              value={draft.notes}
            />
          </FormField>
        </FormSection>
      </FormDisclosure>
    </WorkflowFormSheet>
  );
}

export function ProjectFormSheet({
  projectId,
}: {
  readonly projectId?: string;
}): React.JSX.Element {
  const online = useOnline();
  const query = useScreenQuery(
    "project-form",
    (signal) => trpcClient.project.bootstrap.query({ projectId }, { signal }),
    [projectId ?? "new"],
  );
  const loading = screenLoadState(query, online) === "loading";
  if (query.data === undefined || isAccessRevoked(query.error))
    return (
      <BottomSheet
        title={projectId ? "Ubah proyek" : "Proyek baru"}
        sizing="maximum"
        description={
          projectId
            ? "Perbarui data operasional proyek tanpa mengubah budget atau status aktivasi."
            : "Isi identitas utama. Budget dan aktivasi disiapkan pada langkah terpisah."
        }
        contentPhase={loading ? "loading" : "ready"}
        footer={loading ? <SkeletonFooter /> : undefined}
      >
        <ScreenQueryState
          query={query}
          skeleton={<ProjectFormSkeleton editMode={Boolean(projectId)} />}
          onRetry={() => void query.refetch()}
        />
      </BottomSheet>
    );
  if (query.data.status === "notFound")
    return (
      <BottomSheet
        title="Proyek tidak tersedia"
        description="Proyek yang ingin diubah tidak ditemukan."
      />
    );
  if (
    query.data.status === "restricted" ||
    (!projectId && !query.data.canCreate) ||
    (Boolean(projectId) && !query.data.canUpdate)
  ) {
    return (
      <BottomSheet
        title="Akses dibatasi"
        description="Peran atau cakupan proyek Anda tidak mengizinkan perubahan ini."
      />
    );
  }

  return <ReadyProjectForm key={projectId ?? "new"} data={query.data} projectId={projectId} />;
}
