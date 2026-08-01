"use client";

import React from "react";
import { motion } from "framer-motion";
import { ImagePlus, Trash2 } from "lucide-react";

import {
  AppIcon,
  Button,
  ComboboxField,
  COMMON_ROOM_OPTIONS,
  DatePickerField,
  FormField,
  SheetSelect,
  Textarea,
  TextInput,
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import {
  FINANCIAL_HEALTH_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  type ProjectFinancialHealthOption,
  type ProjectStatusOption,
} from "../../utils/project-drawer-options";

type SelectOption = {
  readonly value: string;
  readonly label: string;
};

export function ProjectCreatedSuccess({
  projectId,
  onClose,
  onNavigate,
  onReturn,
}: {
  readonly projectId: string;
  readonly onClose: () => void;
  readonly onNavigate: (href: string) => void;
  readonly onReturn: () => void;
}): React.JSX.Element {
  const actions = [
    {
      icon: "architecture",
      title: "Buat RAP Internal",
      description: "Susun material, tukang, dan subcon sebagai source RAB.",
      href: `/projects/${projectId}?tab=rap`,
    },
    {
      icon: "space_dashboard",
      title: "Lihat Overview Proyek",
      description: "Review status awal sebelum mulai planning.",
      href: `/projects/${projectId}`,
    },
  ] as const;

  return (
    <div className="space-y-lg py-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary bg-primary/10 text-primary">
        <AppIcon name="check_circle" className="text-[36px]" />
      </div>
      <div className="space-y-sm">
        <h3 className="text-lg font-bold text-on-surface">Proyek Berhasil Dibuat!</h3>
        <p className="mx-auto max-w-xs text-xs leading-relaxed text-on-surface-variant">
          Proyek dibuat sebagai Draft dan anggaran awal kategori (Tukang, Material, Operasional,
          dll.) telah disiapkan berdasarkan setelan sistem. Lengkapi setup lalu aktifkan proyek
          sebelum operasional.
        </p>
      </div>

      <div className="space-y-sm text-left">
        <p className="px-1 font-sans text-[8px] leading-4 font-bold tracking-wider text-on-surface-variant uppercase">
          Langkah Berikutnya:
        </p>
        <div className="space-y-xs">
          {actions.map((action) => (
            <button
              key={action.title}
              type="button"
              onClick={() => {
                onClose();
                onNavigate(action.href);
              }}
              className="flex min-h-16 w-full items-center justify-between rounded-full bg-white px-5 py-3 text-left shadow-surface transition-transform active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <AppIcon name={action.icon} className="text-primary" />
                <div className="flex flex-col">
                  <span className="block text-xs leading-5 font-bold text-on-surface">
                    {action.title}
                  </span>
                  <span className="text-meta text-on-surface-variant">{action.description}</span>
                </div>
              </div>
              <AppIcon name="chevron_right" className="text-[20px] text-outline-variant" />
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2">
        <Button type="button" variant="secondary" fullWidth onClick={onReturn}>
          Kembali ke Daftar Proyek
        </Button>
      </div>
    </div>
  );
}

export function ProjectCoverField({
  coverImageUrl,
  isUploading,
  isPending,
  onClear,
  onUpload,
}: {
  readonly coverImageUrl: string;
  readonly isUploading: boolean;
  readonly isPending: boolean;
  readonly onClear: () => void;
  readonly onUpload: (file: File) => void;
}): React.JSX.Element {
  const busy = isUploading || isPending;

  return (
    <FormField label="Cover proyek" optional>
      {coverImageUrl ? (
        <div className="space-y-2.5">
          <div className="relative aspect-video overflow-hidden rounded-3xl bg-surface-container-low ring-1 ring-ring-control">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImageUrl} alt="Cover proyek" className="h-full w-full object-cover" />
            {isUploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-5 text-center text-white">
                <p className="text-xs font-bold">Mengunggah cover…</p>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <motion.label
              whileTap={busy ? undefined : { scale: 0.97 }}
              transition={transitionSpringSnappy}
              aria-disabled={busy}
              className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary focus-within:ring-2 focus-within:ring-focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-45"
            >
              <ImagePlus className="h-4 w-4" />
              Ganti gambar
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onUpload(file);
                }}
              />
            </motion.label>
            <motion.button
              type="button"
              whileTap={busy ? undefined : { scale: 0.97 }}
              transition={transitionSpringSnappy}
              disabled={busy}
              onClick={onClear}
              aria-label="Hapus cover proyek"
              className="flex min-h-12 min-w-12 items-center justify-center rounded-full bg-error-container/25 px-4 text-error disabled:opacity-45"
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      ) : (
        <motion.label
          whileTap={busy ? undefined : { scale: 0.985 }}
          transition={transitionSpringSnappy}
          aria-disabled={busy}
          className="group flex min-h-12 cursor-pointer items-center gap-3 bg-transparent py-1 focus-within:text-accent aria-disabled:pointer-events-none aria-disabled:opacity-45"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
            <ImagePlus className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs leading-[1.15] font-bold text-on-surface">
              {isUploading ? "Mengunggah cover…" : "Tambahkan cover proyek"}
            </span>
            <span className="mt-0.5 block text-[10px] leading-tight text-on-surface-variant">
              {isUploading ? "Mohon tunggu" : "JPG atau PNG · Maks. 8 MB"}
            </span>
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onUpload(file);
            }}
          />
        </motion.label>
      )}
    </FormField>
  );
}

export function ProjectClientFields({
  isNewClient,
  clientId,
  clientOptions,
  newClientName,
  newClientEmail,
  newClientPhone,
  newClientAddress,
  onClientModeChange,
  onClientIdChange,
  onNewClientNameChange,
  onNewClientEmailChange,
  onNewClientPhoneChange,
  onNewClientAddressChange,
}: {
  readonly isNewClient: boolean;
  readonly clientId: string;
  readonly clientOptions: readonly SelectOption[];
  readonly newClientName: string;
  readonly newClientEmail: string;
  readonly newClientPhone: string;
  readonly newClientAddress: string;
  readonly onClientModeChange: (isNewClient: boolean) => void;
  readonly onClientIdChange: (value: string) => void;
  readonly onNewClientNameChange: (value: string) => void;
  readonly onNewClientEmailChange: (value: string) => void;
  readonly onNewClientPhoneChange: (value: string) => void;
  readonly onNewClientAddressChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="divide-y divide-outline-variant/20">
      <SheetSelect
        label="Jenis klien"
        value={isNewClient ? "new" : "existing"}
        options={[
          { value: "existing", label: "Klien terdaftar" },
          { value: "new", label: "Klien baru" },
        ]}
        onChange={(value) => onClientModeChange(value === "new")}
      />

      {isNewClient ? (
        <div className="divide-y divide-outline-variant/20">
          <FormField label="Nama Klien" required>
            <TextInput
              value={newClientName}
              onChange={onNewClientNameChange}
              placeholder="Nama lengkap klien"
            />
          </FormField>
          <FormField label="No. Telepon">
            <TextInput
              value={newClientPhone}
              onChange={onNewClientPhoneChange}
              placeholder="Telepon klien"
              inputMode="tel"
            />
          </FormField>
          <FormField label="Email" optional>
            <TextInput
              value={newClientEmail}
              onChange={onNewClientEmailChange}
              placeholder="email@domain.com"
            />
          </FormField>
          <FormField label="Alamat Klien">
            <Textarea
              value={newClientAddress}
              onChange={onNewClientAddressChange}
              placeholder="Alamat domisili klien..."
            />
          </FormField>
        </div>
      ) : (
        <SheetSelect
          label="Klien Terdaftar"
          value={clientId}
          onChange={onClientIdChange}
          options={clientOptions}
          placeholder="Pilih klien"
          required
        />
      )}
    </div>
  );
}

export function ProjectDetailFields({
  startDate,
  endDate,
  location,
  roomArea,
  projectType,
  onStartDateChange,
  onEndDateChange,
  onLocationChange,
  onRoomAreaChange,
  onProjectTypeChange,
}: {
  readonly startDate: string;
  readonly endDate: string;
  readonly location: string;
  readonly roomArea: string;
  readonly projectType: string;
  readonly onStartDateChange: (value: string) => void;
  readonly onEndDateChange: (value: string) => void;
  readonly onLocationChange: (value: string) => void;
  readonly onRoomAreaChange: (value: string) => void;
  readonly onProjectTypeChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="divide-y divide-outline-variant/20">
      <DatePickerField label="Tanggal Mulai" value={startDate} onChange={onStartDateChange} />
      <DatePickerField label="Tanggal Selesai" value={endDate} onChange={onEndDateChange} />
      <FormField label="Lokasi">
        <TextInput value={location} onChange={onLocationChange} placeholder="Menteng" />
      </FormField>
      <ComboboxField
        label="Ruangan/Area"
        value={roomArea}
        onChange={onRoomAreaChange}
        options={COMMON_ROOM_OPTIONS}
        placeholder="Pilih atau ketik area"
      />
      <ComboboxField
        label="Tipe Proyek"
        value={projectType}
        onChange={onProjectTypeChange}
        options={PROJECT_TYPE_OPTIONS}
        placeholder="Pilih atau ketik tipe"
      />
    </div>
  );
}

export function ProjectEditStateFields({
  status,
  financialHealth,
  onStatusChange,
  onFinancialHealthChange,
}: {
  readonly status: ProjectStatusOption;
  readonly financialHealth: ProjectFinancialHealthOption;
  readonly onStatusChange: (value: ProjectStatusOption) => void;
  readonly onFinancialHealthChange: (value: ProjectFinancialHealthOption) => void;
}): React.JSX.Element {
  const statusOptions = PROJECT_STATUS_OPTIONS.filter(
    (option) => option.value !== "COMPLETED" || status === "COMPLETED",
  );
  return (
    <div className="divide-y divide-outline-variant/20">
      <SheetSelect
        label="Status Proyek"
        value={status}
        onChange={(value) => onStatusChange(value as ProjectStatusOption)}
        options={statusOptions}
      />
      <SheetSelect
        label="Kesehatan Finansial"
        value={financialHealth}
        onChange={(value) => onFinancialHealthChange(value as ProjectFinancialHealthOption)}
        options={FINANCIAL_HEALTH_OPTIONS}
      />
    </div>
  );
}
