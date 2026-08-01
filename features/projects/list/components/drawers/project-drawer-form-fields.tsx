import React from "react";

import {
  AppIcon,
  FormDisclosure,
  FormField,
  FormSection,
  SheetSelect,
  SmartDefaultHint,
  Textarea,
  TextInput,
} from "@/components/ui";
import type { ProjectFormDraft } from "@/features/projects/list/utils/project-form-draft";
import type { ProjectClientOption, ProjectUserOption } from "./project-drawer-types";
import {
  ProjectClientFields,
  ProjectCoverField,
  ProjectDetailFields,
  ProjectEditStateFields,
} from "./project-drawer-sections";

type ProjectDrawerFormFieldsProps = {
  readonly draft: ProjectFormDraft;
  readonly editMode: boolean;
  readonly clients: readonly ProjectClientOption[];
  readonly users: readonly ProjectUserOption[];
  readonly operationalDetailCount: number;
  readonly operationalDetailsVisible: boolean;
  readonly recovered: boolean;
  readonly isUploadingCover: boolean;
  readonly isPending: boolean;
  readonly onPatch: (next: Partial<ProjectFormDraft>) => void;
  readonly onToggleOperationalDetails: () => void;
  readonly onCoverUpload: (file: File) => void;
};

export function ProjectDrawerFormFields({
  draft,
  editMode,
  clients,
  users,
  operationalDetailCount,
  operationalDetailsVisible,
  recovered,
  isUploadingCover,
  isPending,
  onPatch,
  onToggleOperationalDetails,
  onCoverUpload,
}: ProjectDrawerFormFieldsProps): React.JSX.Element {
  const clientOptions = clients.map((client) => ({ value: client.id, label: client.name }));
  const userOptions = users.map((user) => ({ value: user.id, label: user.name }));

  return (
    <>
      <FormSection title="Identitas inti" helper="Nama, klien, dan PM menentukan ownership proyek.">
        <FormField label="Nama Proyek" required>
          <TextInput
            value={draft.name}
            onChange={(name) => onPatch({ name })}
            placeholder="Misal: Menteng Villa Penthouse Fit-Out"
          />
        </FormField>

        {!editMode ? (
          <ProjectClientFields
            isNewClient={draft.isNewClient}
            clientId={draft.clientId}
            clientOptions={clientOptions}
            newClientName={draft.newClientName}
            newClientEmail={draft.newClientEmail}
            newClientPhone={draft.newClientPhone}
            newClientAddress={draft.newClientAddress}
            onClientModeChange={(isNewClient) => onPatch({ isNewClient })}
            onClientIdChange={(clientId) => onPatch({ clientId })}
            onNewClientNameChange={(newClientName) => onPatch({ newClientName })}
            onNewClientEmailChange={(newClientEmail) => onPatch({ newClientEmail })}
            onNewClientPhoneChange={(newClientPhone) => onPatch({ newClientPhone })}
            onNewClientAddressChange={(newClientAddress) => onPatch({ newClientAddress })}
          />
        ) : null}
        <SheetSelect
          label="Project Manager"
          value={draft.projectManagerId}
          onChange={(projectManagerId) => onPatch({ projectManagerId })}
          options={userOptions}
          placeholder="Pilih Project Manager"
          required
        />
        {users.length === 1 && draft.projectManagerId ? (
          <SmartDefaultHint>
            Project Manager otomatis dipilih karena hanya ada satu opsi aktif.
          </SmartDefaultHint>
        ) : null}
      </FormSection>

      {editMode ? (
        <FormSection
          title="Status proyek"
          helper="Status dan kesehatan finansial memengaruhi cara proyek dipantau."
        >
          <ProjectEditStateFields
            status={draft.status}
            financialHealth={draft.financialHealth}
            onStatusChange={(status) => onPatch({ status })}
            onFinancialHealthChange={(financialHealth) => onPatch({ financialHealth })}
          />
        </FormSection>
      ) : null}

      <FormDisclosure
        title="Detail operasional"
        description="Jadwal, lokasi, cover, dan catatan proyek"
        variant="compact"
        icon={<AppIcon name="tune" className="icon-md" />}
        summary={operationalDetailCount > 0 ? `${operationalDetailCount} terisi` : "Opsional"}
        expanded={operationalDetailsVisible}
        onToggle={onToggleOperationalDetails}
      >
        <div className="space-y-md">
          <FormSection title="Jadwal dan lokasi" helper="Konteks utama untuk pelaksanaan proyek.">
            <ProjectDetailFields
              startDate={draft.startDate}
              endDate={draft.endDate}
              location={draft.location}
              roomArea={draft.roomArea}
              projectType={draft.projectType}
              onStartDateChange={(startDate) => onPatch({ startDate })}
              onEndDateChange={(endDate) => onPatch({ endDate })}
              onLocationChange={(location) => onPatch({ location })}
              onRoomAreaChange={(roomArea) => onPatch({ roomArea })}
              onProjectTypeChange={(projectType) => onPatch({ projectType })}
            />
          </FormSection>

          <FormSection
            title="Cover dan catatan"
            helper="Informasi pendukung yang dapat dilengkapi nanti."
          >
            <ProjectCoverField
              coverImageUrl={draft.coverImageUrl}
              isUploading={isUploadingCover}
              isPending={isPending}
              onClear={() => onPatch({ coverImageUrl: "" })}
              onUpload={onCoverUpload}
            />
            <FormField label="Catatan Proyek" optional>
              <Textarea
                value={draft.notes}
                onChange={(notes) => onPatch({ notes })}
                placeholder="Catatan tambahan mengenai scope proyek..."
              />
            </FormField>
          </FormSection>
        </div>
      </FormDisclosure>

      {recovered ? (
        <SmartDefaultHint>Isian sebelumnya dipulihkan dari perangkat ini.</SmartDefaultHint>
      ) : null}
    </>
  );
}
