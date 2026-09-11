import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { toast } from "sonner-native";

import {
  Button,
  FormField,
  FormSection,
  ScreenMessage,
  ScreenSkeleton,
  SelectionSheet,
  SheetSelect,
  TextInput,
  WorkflowFormSheet,
  type SelectOption,
} from "@/components/ui";
import { trpcClient } from "@/lib/trpc-client";

const NEW_CLIENT_VALUE = "__new_client__";

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
type SelectionTarget = "client" | "projectManager" | null;

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const editMode = Boolean(projectId);
  const [draft, setDraft] = useState<ProjectFormDraft>(() => createInitialDraft(data));
  const [selection, setSelection] = useState<SelectionTarget>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clientOptions = useMemo<readonly SelectOption[]>(() => {
    const options = data.clients.map((client) => ({ value: client.id, label: client.name }));
    return editMode
      ? options
      : [
          ...options,
          {
            value: NEW_CLIENT_VALUE,
            label: "Klien baru",
            description: "Isi identitas klien tanpa meninggalkan form.",
          },
        ];
  }, [data.clients, editMode]);
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
  }

  function validate(): string | null {
    if (!draft.name.trim()) return "Nama proyek wajib diisi.";
    if (draft.isNewClient && !draft.newClientName.trim()) return "Nama klien baru wajib diisi.";
    if (!draft.isNewClient && !draft.clientId) return "Pilih klien untuk proyek ini.";
    if (!draft.projectManagerId) return "Pilih Project Manager untuk proyek ini.";
    return dateError;
  }

  async function submit(): Promise<void> {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
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
      router.back();
    } catch {
      const message = "Perubahan belum tersimpan. Periksa koneksi lalu coba lagi.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const picker =
    selection === "client"
      ? {
          title: "Pilih klien",
          value: draft.isNewClient ? NEW_CLIENT_VALUE : draft.clientId,
          options: clientOptions,
        }
      : {
          title: "Pilih Project Manager",
          value: draft.projectManagerId,
          options: projectManagerOptions,
        };

  return (
    <>
      <WorkflowFormSheet
        description={
          editMode
            ? "Perbarui data operasional proyek tanpa mengubah budget atau status aktivasi."
            : "Isi identitas utama. Budget dan aktivasi disiapkan pada langkah terpisah."
        }
        footer={
          <>
            <Button
              disabled={submitting}
              onPress={() => router.back()}
              style={styles.footerButton}
              variant="secondary"
            >
              Batal
            </Button>
            <Button loading={submitting} onPress={() => void submit()} style={styles.footerButton}>
              {editMode ? "Simpan" : "Buat proyek"}
            </Button>
          </>
        }
        title={editMode ? "Ubah proyek" : "Proyek baru"}
      >
        <FormSection title="Identitas proyek">
          <FormField
            error={!draft.name.trim() && error ? "Nama proyek wajib diisi." : undefined}
            label="Nama proyek"
            required
          >
            <TextInput
              accessibilityLabel="Nama proyek"
              autoCapitalize="words"
              invalid={!draft.name.trim() && Boolean(error)}
              onChangeText={(name) => patch({ name })}
              placeholder="Contoh: Renovasi Rumah Cilandak"
              returnKeyType="next"
              value={draft.name}
            />
          </FormField>
          <SheetSelect
            error={!draft.isNewClient && !draft.clientId && error ? "Pilih klien." : undefined}
            label="Klien"
            onPress={() => setSelection("client")}
            options={clientOptions}
            required
            value={draft.isNewClient ? NEW_CLIENT_VALUE : draft.clientId}
          />
          {draft.isNewClient ? (
            <>
              <FormField
                error={
                  draft.isNewClient && !draft.newClientName.trim() && error
                    ? "Nama klien baru wajib diisi."
                    : undefined
                }
                label="Nama klien baru"
                required
              >
                <TextInput
                  accessibilityLabel="Nama klien baru"
                  autoCapitalize="words"
                  invalid={draft.isNewClient && !draft.newClientName.trim() && Boolean(error)}
                  onChangeText={(newClientName) => patch({ newClientName })}
                  placeholder="Nama klien"
                  value={draft.newClientName}
                />
              </FormField>
              <FormField label="Email klien" optional>
                <TextInput
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
                  accessibilityLabel="Nomor telepon klien"
                  keyboardType="phone-pad"
                  onChangeText={(newClientPhone) => patch({ newClientPhone })}
                  placeholder="08xx"
                  value={draft.newClientPhone}
                />
              </FormField>
              <FormField label="Alamat klien" optional>
                <TextInput
                  accessibilityLabel="Alamat klien"
                  onChangeText={(newClientAddress) => patch({ newClientAddress })}
                  placeholder="Alamat korespondensi"
                  value={draft.newClientAddress}
                />
              </FormField>
            </>
          ) : null}
          <SheetSelect
            error={!draft.projectManagerId && error ? "Pilih Project Manager." : undefined}
            label="Project Manager"
            onPress={() => setSelection("projectManager")}
            options={projectManagerOptions}
            required
            value={draft.projectManagerId}
          />
        </FormSection>

        <FormSection helper="Gunakan format tanggal YYYY-MM-DD." title="Jadwal dan lokasi">
          <FormField label="Tanggal mulai" optional>
            <TextInput
              accessibilityLabel="Tanggal mulai"
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              onChangeText={(startDate) => patch({ startDate })}
              placeholder="2026-08-16"
              value={draft.startDate}
            />
          </FormField>
          <FormField error={dateError ?? undefined} label="Tanggal selesai" optional>
            <TextInput
              accessibilityLabel="Tanggal selesai"
              autoCapitalize="none"
              invalid={Boolean(dateError)}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              onChangeText={(endDate) => patch({ endDate })}
              placeholder="2026-12-16"
              value={draft.endDate}
            />
          </FormField>
          <FormField label="Lokasi" optional>
            <TextInput
              accessibilityLabel="Lokasi proyek"
              onChangeText={(location) => patch({ location })}
              placeholder="Area atau alamat proyek"
              value={draft.location}
            />
          </FormField>
          <FormField label="Area ruangan" optional>
            <TextInput
              accessibilityLabel="Area ruangan"
              onChangeText={(roomArea) => patch({ roomArea })}
              placeholder="Contoh: Lantai 1 dan dapur"
              value={draft.roomArea}
            />
          </FormField>
          <FormField label="Jenis proyek" optional>
            <TextInput
              accessibilityLabel="Jenis proyek"
              onChangeText={(projectType) => patch({ projectType })}
              placeholder="Contoh: Renovasi interior"
              value={draft.projectType}
            />
          </FormField>
        </FormSection>

        <FormSection title="Catatan">
          <FormField label="Catatan internal" optional>
            <TextInput
              accessibilityLabel="Catatan internal proyek"
              multiline
              onChangeText={(notes) => patch({ notes })}
              placeholder="Konteks singkat untuk tim proyek"
              style={styles.notesInput}
              textAlignVertical="top"
              value={draft.notes}
            />
          </FormField>
        </FormSection>
      </WorkflowFormSheet>

      <SelectionSheet
        onClose={() => setSelection(null)}
        onSelect={(value) => {
          if (selection === "client") {
            patch({
              clientId: value === NEW_CLIENT_VALUE ? "" : value,
              isNewClient: value === NEW_CLIENT_VALUE,
            });
          } else if (selection === "projectManager") {
            patch({ projectManagerId: value });
          }
        }}
        options={picker.options}
        title={picker.title}
        value={picker.value}
        visible={selection !== null}
      />
    </>
  );
}

export function ProjectFormSheet({
  projectId,
}: {
  readonly projectId?: string;
}): React.JSX.Element {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["project", "form", projectId ?? "new"],
    queryFn: () => trpcClient.project.bootstrap.query({ projectId }),
  });

  if (query.isPending) return <ScreenSkeleton rows={5} />;
  if (query.isError || !query.data) {
    return (
      <ScreenMessage
        description="Pilihan klien dan Project Manager belum dapat dimuat."
        onAction={() => void query.refetch()}
        title="Form belum siap"
      />
    );
  }
  if (query.data.status === "notFound") {
    return (
      <ScreenMessage
        actionLabel="Kembali"
        description="Proyek yang ingin diubah tidak ditemukan."
        icon="folder_open"
        onAction={() => router.back()}
        title="Proyek tidak tersedia"
      />
    );
  }
  if (
    query.data.status === "restricted" ||
    (!projectId && !query.data.canCreate) ||
    (Boolean(projectId) && !query.data.canUpdate)
  ) {
    return (
      <ScreenMessage
        actionLabel="Kembali"
        description="Peran atau cakupan proyek Anda tidak mengizinkan perubahan ini."
        icon="lock"
        onAction={() => router.back()}
        title="Akses dibatasi"
      />
    );
  }

  return <ReadyProjectForm key={projectId ?? "new"} data={query.data} projectId={projectId} />;
}

const styles = StyleSheet.create({
  footerButton: { flex: 1 },
  notesInput: { minHeight: 88 },
});
