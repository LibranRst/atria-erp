"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction, updateProjectAction } from "@/app/actions/project/crud";
import { signImagekit } from "@/app/actions/media/sign-imagekit";
import { getErrorMessage } from "@/lib/utils/error-message";
import { BottomSheet, OperationalFormSheet } from "@/components/ui";
import { useLocalFormRecovery } from "@/features/shared-hooks/use-local-form-recovery";
import { toast } from "sonner";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { ProjectCreatedSuccess } from "./project-drawer-sections";
import { ProjectDrawerFormFields } from "./project-drawer-form-fields";
import { ProjectRecoveryModal } from "./project-recovery-modal";
import { ProjectReviewSheet } from "./project-review-sheet";
import type { ProjectDrawerProps } from "./project-drawer-types";
import {
  FINANCIAL_HEALTH_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from "../../utils/project-drawer-options";
import {
  createProjectFormDraft,
  getProjectDateError,
  projectFormDraftSchema,
  type ProjectFormDraft,
} from "../../utils/project-form-draft";

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
              <AppIcon name="error" className="text-[18px]" />
              <span className="leading-normal">{error}</span>
            </div>
          ) : null
        }
      >
        <form id="project-drawer-form" onSubmit={prepareReview} className="space-y-md">
          <ProjectDrawerFormFields
            draft={recovery.payload}
            editMode={Boolean(editProject)}
            clients={clients}
            users={users}
            operationalDetailCount={operationalDetailCount}
            operationalDetailsVisible={operationalDetailsVisible}
            recovered={Boolean(recovery.recoveredAt)}
            isUploadingCover={isUploadingCover}
            isPending={isPending}
            onPatch={patch}
            onToggleOperationalDetails={() =>
              setShowOperationalDetails((current) => !(current ?? hasOperationalDetails))
            }
            onCoverUpload={(file) => {
              void handleCoverUpload(file);
            }}
          />
        </form>
      </OperationalFormSheet>
      <ProjectReviewSheet
        open={isOpen && reviewing}
        editMode={Boolean(editProject)}
        pending={isPending}
        draft={recovery.payload}
        clientName={selectedClientName}
        projectManagerName={selectedPmName}
        statusLabel={selectedStatusLabel}
        healthLabel={selectedHealthLabel}
        onClose={() => setReviewing(false)}
        onSubmit={handleSubmit}
      />
      <ProjectRecoveryModal
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onSaveAndClose={() => {
          setConfirmClose(false);
          handleClose();
        }}
        onDiscard={() => {
          recovery.reset(initialDraft());
          setConfirmClose(false);
          handleClose();
        }}
      />
    </>
  );
}
