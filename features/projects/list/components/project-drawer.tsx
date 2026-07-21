"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createProjectAction, updateProjectAction } from "@/app/actions/project/crud";
import { signImagekit } from "@/app/actions/media/sign-imagekit";
import { getErrorMessage } from "@/lib/utils/error-message";
import {
  FormField,
  FormDisclosure,
  FormSection,
  FormRiskNotice,
  ConfirmationModal,
  OperationalFormSheet,
  SheetSelect,
  SmartDefaultHint,
  Textarea,
  TextInput,
  WorkflowFormSheet,
} from "@/components/ui";
import { BottomSheet } from "@/components/ui";
import { useLocalFormRecovery } from "@/features/forms/use-local-form-recovery";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { toast } from "sonner";
import {
  ProjectClientFields,
  ProjectCoverField,
  ProjectCreatedSuccess,
  ProjectDetailFields,
  ProjectEditStateFields,
} from "./project-drawer-sections";
import {
  FINANCIAL_HEALTH_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  type ProjectFinancialHealthOption,
  type ProjectStatusOption,
} from "./project-drawer-options";
import {
  createProjectFormDraft,
  getProjectDateError,
  projectFormDraftSchema,
  type ProjectFormDraft,
} from "./project-form-draft";

interface ClientOption {
  readonly id: string;
  readonly name: string;
}

interface UserOption {
  readonly id: string;
  readonly name: string;
}

interface ProjectData {
  readonly id: string;
  readonly name: string;
  readonly clientId: string;
  readonly projectManagerId: string;
  readonly status: "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  readonly financialHealth: "HEALTHY" | "WARNING" | "CRITICAL";
  readonly totalContractValue: number;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly location?: string | null;
  readonly roomArea?: string | null;
  readonly projectType?: string | null;
  readonly coverImageUrl?: string | null;
  readonly notes?: string | null;
}

interface ProjectDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly clients: readonly ClientOption[];
  readonly users: readonly UserOption[];
  readonly editProject?: ProjectData | null;
}

interface ImageKitUploadResponse {
  readonly url: string;
}

export function ProjectDrawer({
  isOpen,
  onClose,
  clients,
  users,
  editProject,
}: ProjectDrawerProps): React.JSX.Element | null {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initialDraft = React.useCallback(
    (): ProjectFormDraft => createProjectFormDraft(editProject, users),
    [editProject, users],
  );
  const recovery = useLocalFormRecovery({
    storageKey: `atria:project-form:${editProject?.id ?? "new"}`,
    schema: projectFormDraftSchema,
    initialPayload: initialDraft,
  });
  const {
    name,
    clientId,
    isNewClient,
    newClientName,
    newClientEmail,
    newClientPhone,
    newClientAddress,
    projectManagerId,
    startDate,
    endDate,
    location,
    roomArea,
    projectType,
    coverImageUrl,
    notes,
    status,
    financialHealth,
  } = recovery.payload;
  const patch = React.useCallback(
    (next: Partial<ProjectFormDraft>): void => {
      recovery.setPayload((current) => ({ ...current, ...next }));
    },
    [recovery],
  );
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showOperationalDetails, setShowOperationalDetails] = useState<boolean | null>(null);

  // Error/Success state
  const [error, setError] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  React.useEffect(() => {
    if (recovery.isDirty || projectManagerId || users.length !== 1) return;
    recovery.reset(createProjectFormDraft(editProject, users));
  }, [editProject, projectManagerId, recovery, users]);

  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: client.name,
  }));
  const userOptions = users.map((user) => ({
    value: user.id,
    label: user.name,
  }));
  const selectedClientName = isNewClient
    ? newClientName.trim() || "Klien baru"
    : (clients.find((client) => client.id === clientId)?.name ?? "Belum dipilih");
  const selectedPmName =
    users.find((user) => user.id === projectManagerId)?.name ?? "Belum dipilih";
  const selectedStatusLabel =
    PROJECT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
  const selectedHealthLabel =
    FINANCIAL_HEALTH_OPTIONS.find((option) => option.value === financialHealth)?.label ??
    financialHealth;
  const operationalDetailCount = [
    startDate,
    endDate,
    location,
    roomArea,
    projectType,
    coverImageUrl,
    notes,
  ].filter((value) => Boolean(value)).length;
  const hasOperationalDetails = Boolean(editProject || operationalDetailCount > 0);
  const operationalDetailsVisible = showOperationalDetails ?? hasOperationalDetails;
  const dateError = getProjectDateError(startDate, endDate);
  const projectBlockers = [
    !name.trim() ? "Nama proyek" : "",
    !editProject && !isNewClient && !clientId ? "Klien terdaftar" : "",
    !editProject && isNewClient && !newClientName.trim() ? "Nama klien baru" : "",
    !projectManagerId ? "Project Manager" : "",
    dateError ? "Urutan tanggal" : "",
  ].filter(Boolean);
  const coreCompletedCount = [
    Boolean(name.trim()),
    Boolean(editProject || (isNewClient ? newClientName.trim() : clientId)),
    Boolean(projectManagerId),
  ].filter(Boolean).length;
  const disabledReason =
    projectBlockers.length > 0 ? `Belum bisa disimpan: ${projectBlockers.join(", ")}.` : undefined;

  const handleClose = React.useCallback(() => {
    if (createdProjectId) {
      router.push(`/projects/${createdProjectId}`);
      return;
    }
    setReviewing(false);
    setConfirmClose(false);
    onClose();
  }, [onClose, createdProjectId, router]);

  function requestClose(): void {
    if (reviewing) {
      setReviewing(false);
      return;
    }
    if (recovery.isDirty) {
      setConfirmClose(true);
      return;
    }
    handleClose();
  }

  const setName = (value: string): void => patch({ name: value });
  const setClientId = (value: string): void => patch({ clientId: value });
  const setIsNewClient = (value: boolean): void => patch({ isNewClient: value });
  const setNewClientName = (value: string): void => patch({ newClientName: value });
  const setNewClientEmail = (value: string): void => patch({ newClientEmail: value });
  const setNewClientPhone = (value: string): void => patch({ newClientPhone: value });
  const setNewClientAddress = (value: string): void => patch({ newClientAddress: value });
  const setProjectManagerId = (value: string): void => patch({ projectManagerId: value });
  const setStartDate = (value: string): void => patch({ startDate: value });
  const setEndDate = (value: string): void => patch({ endDate: value });
  const setLocation = (value: string): void => patch({ location: value });
  const setRoomArea = (value: string): void => patch({ roomArea: value });
  const setProjectType = (value: string): void => patch({ projectType: value });
  const setCoverImageUrl = (value: string): void => patch({ coverImageUrl: value });
  const setNotes = (value: string): void => patch({ notes: value });
  const setStatus = (value: ProjectStatusOption): void => patch({ status: value });
  const setFinancialHealth = (value: ProjectFinancialHealthOption): void =>
    patch({ financialHealth: value });

  const handleCoverUpload = async (file: File): Promise<void> => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Cover harus berupa file gambar.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Ukuran cover maksimal 8 MB.");
      return;
    }
    setIsUploadingCover(true);

    try {
      const signRes = await signImagekit();
      if (!signRes.success) {
        throw new Error(signRes.error.message || "Gagal melakukan otentikasi unggah cover.");
      }

      const { token, expire, signature } = signRes.data;
      const safeFileName = `project-cover-${Date.now()}-${file.name.replaceAll(" ", "_")}`;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", safeFileName);
      formData.append(
        "publicKey",
        process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_PRvr9hXwFetaQx4ZejdGwJ1Ue8=",
      );
      formData.append("signature", signature);
      formData.append("token", token);
      formData.append("expire", expire.toString());
      formData.append("folder", "/project-covers");

      const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = (await uploadRes.json()) as {
          readonly message?: string;
        };
        throw new Error(errorData.message || "Gagal mengunggah cover proyek.");
      }

      const uploadData = (await uploadRes.json()) as ImageKitUploadResponse;
      patch({ coverImageUrl: uploadData.url });
      toast.success("Cover proyek berhasil diunggah.");
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, "Terjadi kesalahan saat mengunggah cover proyek.");
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsUploadingCover(false);
    }
  };

  function prepareReview(event: React.FormEvent): void {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Nama proyek wajib diisi.");
      toast.error("Nama proyek wajib diisi.");
      return;
    }

    if (!isNewClient && !clientId) {
      setError("Silakan pilih klien terdaftar.");
      toast.error("Silakan pilih klien terdaftar.");
      return;
    }

    if (isNewClient && !newClientName.trim()) {
      setError("Nama klien baru wajib diisi.");
      toast.error("Nama klien baru wajib diisi.");
      return;
    }

    if (!projectManagerId) {
      setError("Silakan pilih Project Manager.");
      toast.error("Silakan pilih Project Manager.");
      return;
    }

    if (dateError) {
      setError(dateError);
      toast.error(dateError);
      return;
    }

    setReviewing(true);
  }

  function handleSubmit(): void {
    setError(null);

    startTransition(async () => {
      if (editProject) {
        // Update Flow
        const res = await updateProjectAction({
          id: editProject.id,
          name,
          clientId,
          projectManagerId,
          startDate,
          endDate,
          location,
          roomArea,
          projectType,
          coverImageUrl,
          notes,
          status,
          financialHealth,
        });

        if (res.success) {
          recovery.clear();
          toast.success("Proyek berhasil diperbarui.");
          router.refresh();
          handleClose();
        } else {
          setReviewing(false);
          setError(res.error.message);
          toast.error(res.error.message);
        }
      } else {
        // Create Flow
        const res = await createProjectAction({
          name,
          clientId: isNewClient ? undefined : clientId,
          newClientName: isNewClient ? newClientName : undefined,
          newClientEmail: isNewClient ? newClientEmail : undefined,
          newClientPhone: isNewClient ? newClientPhone : undefined,
          newClientAddress: isNewClient ? newClientAddress : undefined,
          projectManagerId,
          startDate,
          endDate,
          location,
          roomArea,
          projectType,
          coverImageUrl,
          notes,
          status,
        });

        if (res.success) {
          recovery.clear();
          setCreatedProjectId(res.data.id);
          toast.success("Proyek berhasil dibuat!");
          router.refresh();
        } else {
          setReviewing(false);
          setError(res.error.message);
          toast.error(res.error.message);
        }
      }
    });
  }

  if (createdProjectId) {
    return (
      <BottomSheet
        open={isOpen}
        title="Proyek berhasil dibuat"
        onClose={() => {
          if (!isPending) handleClose();
        }}
      >
        <ProjectCreatedSuccess
          projectId={createdProjectId}
          onClose={onClose}
          onNavigate={(href) => router.push(href)}
          onReturn={() => {
            onClose();
            router.refresh();
          }}
        />
      </BottomSheet>
    );
  }

  return (
    <>
      <OperationalFormSheet
        open={isOpen && !reviewing}
        title={editProject ? "Edit Proyek" : "Buat Proyek Baru"}
        onClose={() => {
          if (!isPending) requestClose();
        }}
        formId="project-drawer-form"
        pending={isPending}
        disabled={projectBlockers.length > 0}
        disabledReason={disabledReason}
        submitLabel="Tinjau"
        submittingLabel="Menyimpan..."
        statusText={
          projectBlockers.length
            ? `${coreCompletedCount} dari 3 data utama lengkap`
            : `${selectedClientName} · ${selectedPmName} · Siap ditinjau`
        }
        statusTone={projectBlockers.length ? "warning" : "success"}
        error={
          error ? (
            <div className="flex items-start gap-2 rounded-2xl border border-error bg-error-container/10 p-3 text-xs text-error">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span className="leading-normal">{error}</span>
            </div>
          ) : null
        }
      >
        <form id="project-drawer-form" onSubmit={prepareReview} className="space-y-md">
          <FormSection
            title="Identitas inti"
            helper="Nama, klien, dan PM menentukan ownership proyek."
          >
            <FormField label="Nama Proyek" required>
              <TextInput
                value={name}
                onChange={setName}
                placeholder="Misal: Menteng Villa Penthouse Fit-Out"
              />
            </FormField>

            {/* Client Selection */}
            {!editProject && (
              <ProjectClientFields
                isNewClient={isNewClient}
                clientId={clientId}
                clientOptions={clientOptions}
                newClientName={newClientName}
                newClientEmail={newClientEmail}
                newClientPhone={newClientPhone}
                newClientAddress={newClientAddress}
                onClientModeChange={setIsNewClient}
                onClientIdChange={setClientId}
                onNewClientNameChange={setNewClientName}
                onNewClientEmailChange={setNewClientEmail}
                onNewClientPhoneChange={setNewClientPhone}
                onNewClientAddressChange={setNewClientAddress}
              />
            )}
            <SheetSelect
              label="Project Manager"
              value={projectManagerId}
              onChange={setProjectManagerId}
              options={userOptions}
              placeholder="Pilih Project Manager"
              required
            />
            {users.length === 1 && projectManagerId ? (
              <SmartDefaultHint>
                Project Manager otomatis dipilih karena hanya ada satu opsi aktif.
              </SmartDefaultHint>
            ) : null}
          </FormSection>

          {editProject ? (
            <FormSection
              title="Status proyek"
              helper="Status dan kesehatan finansial memengaruhi cara proyek dipantau."
            >
              <ProjectEditStateFields
                status={status}
                financialHealth={financialHealth}
                onStatusChange={setStatus}
                onFinancialHealthChange={setFinancialHealth}
              />
            </FormSection>
          ) : null}

          <FormDisclosure
            title="Detail operasional"
            description="Jadwal, lokasi, cover, dan catatan proyek"
            variant="compact"
            icon={
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                tune
              </span>
            }
            summary={operationalDetailCount > 0 ? `${operationalDetailCount} terisi` : "Opsional"}
            expanded={operationalDetailsVisible}
            onToggle={() =>
              setShowOperationalDetails((current) => !(current ?? hasOperationalDetails))
            }
          >
            <div className="space-y-md">
              <FormSection
                title="Jadwal dan lokasi"
                helper="Konteks utama untuk pelaksanaan proyek."
              >
                <ProjectDetailFields
                  startDate={startDate}
                  endDate={endDate}
                  location={location}
                  roomArea={roomArea}
                  projectType={projectType}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onLocationChange={setLocation}
                  onRoomAreaChange={setRoomArea}
                  onProjectTypeChange={setProjectType}
                />
              </FormSection>

              <FormSection
                title="Cover dan catatan"
                helper="Informasi pendukung yang dapat dilengkapi nanti."
              >
                <ProjectCoverField
                  coverImageUrl={coverImageUrl}
                  isUploading={isUploadingCover}
                  isPending={isPending}
                  onClear={() => setCoverImageUrl("")}
                  onUpload={(file) => {
                    void handleCoverUpload(file);
                  }}
                />
                <FormField label="Catatan Proyek" optional>
                  <Textarea
                    value={notes}
                    onChange={setNotes}
                    placeholder="Catatan tambahan mengenai scope proyek..."
                  />
                </FormField>
              </FormSection>
            </div>
          </FormDisclosure>

          {recovery.recoveredAt ? (
            <SmartDefaultHint>Isian sebelumnya dipulihkan dari perangkat ini.</SmartDefaultHint>
          ) : null}
        </form>
      </OperationalFormSheet>
      <WorkflowFormSheet
        open={isOpen && reviewing}
        title={editProject ? "Tinjau Perubahan Proyek" : "Tinjau Proyek Baru"}
        primaryLabel={editProject ? "Simpan" : "Buat"}
        secondaryLabel="Ubah"
        pendingLabel={editProject ? "Memperbarui…" : "Membuat…"}
        pending={isPending}
        onClose={() => setReviewing(false)}
        onSecondary={() => setReviewing(false)}
        onPrimary={handleSubmit}
        statusText={`${selectedClientName} · ${selectedPmName}`}
        statusTone="success"
      >
        <div className="space-y-3">
          <FormSection
            title={editProject ? "Tinjau Perubahan Proyek" : "Tinjau Proyek Baru"}
            helper="Periksa detail proyek sebelum menyimpan."
          >
            <ReviewFact label="Nama Proyek" value={name.trim()} />
            <ReviewFact label="Klien" value={selectedClientName ?? "–"} />
            <ReviewFact label="Project Manager" value={selectedPmName ?? "–"} />
            <ReviewFact
              label="Lokasi & Area"
              value={[location, roomArea].filter(Boolean).join(" · ") || "–"}
            />
            <ReviewFact
              label="Periode"
              value={
                startDate || endDate ? `${startDate || "–"}${endDate ? ` → ${endDate}` : ""}` : "–"
              }
            />
            <ReviewFact label="Status Proyek" value={selectedStatusLabel ?? "–"} />
            {editProject && (
              <ReviewFact label="Kesehatan Finansial" value={selectedHealthLabel ?? "–"} />
            )}
          </FormSection>
          <FormRiskNotice
            title={editProject ? "Dampak perubahan" : "Yang disiapkan otomatis"}
            tone="warning"
          >
            {editProject
              ? "Assignment PM dan status proyek langsung memengaruhi akses serta workflow operasional setelah disimpan."
              : "Project dibuat sebagai Draft. Budget kategori awal disiapkan dari default Settings; lengkapi setup lalu aktifkan proyek sebelum transaksi atau pergerakan stok."}
          </FormRiskNotice>
        </div>
      </WorkflowFormSheet>
      <ConfirmationModal
        open={confirmClose}
        title="Tutup form proyek?"
        description="Isian sudah aman di perangkat ini dan dapat dilanjutkan saat form dibuka kembali."
        tone="warning"
        onClose={() => setConfirmClose(false)}
        actions={
          <div className="space-y-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => {
                setConfirmClose(false);
                handleClose();
              }}
              className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-white"
            >
              Simpan Lokal & Tutup
            </motion.button>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                onClick={() => {
                  recovery.reset(initialDraft());
                  setConfirmClose(false);
                  handleClose();
                }}
                className="min-h-12 rounded-full bg-error-container/25 px-4 text-xs font-bold text-error"
              >
                Buang Perubahan
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                onClick={() => setConfirmClose(false)}
                className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface"
              >
                Lanjut Mengisi
              </motion.button>
            </div>
          </div>
        }
      />
    </>
  );
}

function ReviewFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
