"use client";

import React from "react";
import { toast } from "sonner";

import { createFirstProjectQuickStart } from "@/app/actions/quick-start";
import {
  AdaptiveSelect,
  AppIcon,
  Button,
  FormField,
  FormSection,
  FactRow,
  GroupedSurface,
  MoneyInput,
  MoneyValue,
  SegmentedTabs,
  SmartDefaultHint,
  TextInput,
} from "@/components/ui";
import type { QuickStartWorkspaceData } from "@/features/onboarding/server/get-quick-start-workspace-data";

export type CreatedFirstProjectSummary = {
  readonly id: string;
  readonly name: string;
  readonly contractValue: number;
  readonly approvedRabValue: number;
  readonly internalBudget: number;
  readonly targetGross: number;
};

export function FirstProjectPanel({
  data,
  onCreated,
}: {
  readonly data: Extract<NonNullable<QuickStartWorkspaceData["project"]>, { status: "ready" }>;
  readonly onCreated: (summary: CreatedFirstProjectSummary) => void;
}): React.JSX.Element {
  const [clientMode, setClientMode] = React.useState<"EXISTING" | "NEW">(
    data.clients.length > 0 ? "EXISTING" : "NEW",
  );
  const [name, setName] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [newClientName, setNewClientName] = React.useState("");
  const [projectManagerId, setProjectManagerId] = React.useState("");
  const [contractValue, setContractValue] = React.useState("");
  const [approvedRabValue, setApprovedRabValue] = React.useState("");
  const [rabEdited, setRabEdited] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const contract = Number(contractValue || 0);
  const approvedRab = Number(approvedRabValue || 0);
  const internalBudget = contract * data.allocation.budgetCapRatio;
  const targetGross = contract - internalBudget;
  const targetMargin = contract > 0 ? (targetGross / contract) * 100 : 0;
  const allocatedRatio = data.allocation.categories.reduce(
    (sum, category) => sum + category.ratioPercentage,
    0,
  );
  const bufferRatio = Math.max(0, 1 - allocatedRatio);
  const clientReady = clientMode === "EXISTING" ? Boolean(clientId) : Boolean(newClientName.trim());
  const ready = Boolean(name.trim() && clientReady && contract > 0 && approvedRab > 0);

  function changeContractValue(value: string): void {
    setContractValue(value);
    if (!rabEdited) setApprovedRabValue(value);
  }

  function submit(): void {
    if (!ready) {
      toast.error("Lengkapi nama, klien, nilai project, dan RAB disetujui.");
      return;
    }
    startTransition(async () => {
      const result = await createFirstProjectQuickStart({
        name: name.trim(),
        clientId: clientMode === "EXISTING" ? clientId : undefined,
        newClientName: clientMode === "NEW" ? newClientName.trim() : undefined,
        projectManagerId: projectManagerId || null,
        totalContractValue: contract,
        approvedRabValue: approvedRab,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      onCreated({
        id: result.data.projectId,
        name: name.trim(),
        contractValue: contract,
        approvedRabValue: approvedRab,
        internalBudget,
        targetGross,
      });
    });
  }

  return (
    <div className="space-y-4">
      <FormSection title="Identitas project" helper="Data minimum untuk membuat Draft yang nyata.">
        <FormField label="Nama project" required>
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Misal: Renovasi Residence Menteng"
          />
        </FormField>
        <div className="px-4 py-3">
          <SegmentedTabs
            value={clientMode}
            onChange={setClientMode}
            ariaLabel="Sumber data klien"
            density="compact"
            options={[
              {
                value: "EXISTING",
                label: "Klien tersimpan",
                disabled: data.clients.length === 0,
              },
              { value: "NEW", label: "Klien baru" },
            ]}
          />
        </div>
        {clientMode === "EXISTING" ? (
          <AdaptiveSelect
            label="Klien"
            value={clientId}
            onChange={setClientId}
            options={data.clients.map((client) => ({ value: client.id, label: client.name }))}
            placeholder={data.clients.length ? "Pilih klien" : "Belum ada klien tersimpan"}
            required
          />
        ) : (
          <FormField label="Nama klien baru" required>
            <TextInput
              value={newClientName}
              onChange={setNewClientName}
              placeholder="Nama individu atau perusahaan"
            />
          </FormField>
        )}
        <AdaptiveSelect
          label="Project Manager"
          value={projectManagerId}
          onChange={setProjectManagerId}
          options={[
            { value: "", label: "Belum ditugaskan" },
            ...data.projectManagers.map((manager) => ({ value: manager.id, label: manager.name })),
          ]}
          placeholder="Belum ditugaskan"
        />
        {!projectManagerId ? (
          <SmartDefaultHint>
            Project tetap Draft. Project Manager aktif wajib ditugaskan sebelum aktivasi.
          </SmartDefaultHint>
        ) : null}
      </FormSection>

      <FormSection
        title="Nilai dan baseline"
        helper="RAB disetujui mengikuti nilai project sampai Anda mengubahnya."
      >
        <FormField label="Nilai project" required>
          <MoneyInput value={contractValue} onChange={changeContractValue} />
        </FormField>
        <FormField label="RAB disetujui" required>
          <MoneyInput
            value={approvedRabValue}
            onChange={(value) => {
              setRabEdited(true);
              setApprovedRabValue(value);
            }}
          />
        </FormField>
      </FormSection>

      <section className="space-y-2" aria-labelledby="quick-start-budget-preview">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 id="quick-start-budget-preview" className="text-section font-bold text-on-surface">
            Preview budget awal
          </h2>
          <span className="text-meta font-semibold text-on-surface-variant">
            Cap {Math.round(data.allocation.budgetCapRatio * 100)}%
          </span>
        </div>
        <GroupedSurface>
          <div className="grid grid-cols-2 gap-2 p-2">
            <div className="rounded-inset bg-surface-container-low p-3">
              <p className="text-meta font-semibold text-on-surface-variant">Budget internal</p>
              <MoneyValue amount={internalBudget} variant="compact" size="sm" />
            </div>
            <div className="rounded-inset bg-surface-container-low p-3">
              <p className="text-meta font-semibold text-on-surface-variant">Target gross</p>
              <MoneyValue amount={targetGross} variant="compact" size="sm" />
              <p className="mt-1 text-meta font-bold text-on-surface">{targetMargin.toFixed(1)}%</p>
            </div>
          </div>
          <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
            <FactRow
              label={`Buffer belum dialokasikan (${(bufferRatio * 100).toFixed(1)}%)`}
              value={
                <MoneyValue
                  amount={internalBudget * bufferRatio}
                  variant="compact"
                  size="sm"
                  align="right"
                />
              }
            />
            {data.allocation.categories.map((category) => (
              <div
                key={category.expenseCategoryId}
                className="flex min-h-14 items-center gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-row font-bold text-on-surface">{category.name}</span>
                  <span className="block text-meta text-on-surface-variant">
                    {Math.round(category.ratioPercentage * 100)}% dari budget internal
                  </span>
                </span>
                <MoneyValue
                  amount={internalBudget * category.ratioPercentage}
                  variant="compact"
                  size="sm"
                  align="right"
                />
              </div>
            ))}
          </div>
        </GroupedSurface>
      </section>

      <Button
        type="button"
        fullWidth
        pending={pending}
        pendingLabel="Membuat project…"
        disabled={!ready}
        onClick={submit}
        trailingIcon={<AppIcon name="arrow_forward" className="icon-sm" />}
      >
        Buat project Draft
      </Button>
    </div>
  );
}
