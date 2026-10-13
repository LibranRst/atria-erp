"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProjectSchema } from "@atria/core/validations/project";
import { Alert, Button, Link, MoneyValue, StatusChip } from "@/components/ui";
import type { ProjectDetailPayload, ProjectFormOptions, ProjectPermissions } from "../types";
import type { EditableProject } from "../form-model";
import { BudgetSummary } from "./budget-summary";
import { ProjectForm } from "./project-form";

function isoDate(date: Date | null | undefined): string {
  return date instanceof Date ? date.toISOString().slice(0, 10) : "";
}

function editableProject(data: ProjectDetailPayload): EditableProject | null {
  const project = data.project;
  const parsed = updateProjectSchema
    .pick({ status: true, financialHealth: true })
    .safeParse(project);
  if (!parsed.success) return null;
  return {
    id: project.id,
    name: project.name,
    clientId: project.clientId,
    projectManagerId: project.projectManagerId,
    ...parsed.data,
    totalContractValue: Number(project.totalContractValue),
    startDate: isoDate(project.startDate),
    endDate: isoDate(project.endDate),
    location: project.location,
    roomArea: project.roomArea,
    projectType: project.projectType,
    coverImageUrl: project.coverImageUrl,
    notes: project.notes,
  };
}

export function ProjectDetail({
  data,
  permissions,
  formOptions,
}: {
  readonly data: ProjectDetailPayload;
  readonly permissions: ProjectPermissions;
  readonly formOptions: ProjectFormOptions | null;
}): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const project = data.project;
  const editable = editableProject(data);
  const locked = project.status === "COMPLETED" || project.status === "CANCELLED";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/projects" className="mb-2 text-sm">
            Semua proyek
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {project.client?.name ?? "Klien belum diisi"} ·{" "}
            {project.projectManager?.name ?? "PM belum ditugaskan"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip status={project.status} />
          {permissions.canEdit && formOptions && editable && !locked ? (
            <Button size="sm" variant="secondary" onPress={() => setFormOpen(true)}>
              Edit proyek
            </Button>
          ) : null}
          <Link href={`/projects/${project.id}/budget`}>Kelola budget</Link>
        </div>
      </div>
      {saved ? (
        <Alert status="success" role="status">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Perubahan proyek disimpan.</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {data.projectBudgetDashboard ? (
        <BudgetSummary budget={data.projectBudgetDashboard} />
      ) : (
        <Alert>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Budget belum tersedia</Alert.Title>
            <Alert.Description>
              Nilai kontrak <MoneyValue amount={Number(project.totalContractValue)} />. Buat budget
              untuk melihat alokasi kategori dan margin.
            </Alert.Description>
            <Link href={`/projects/${project.id}/budget`} className="mt-2">
              Buka setup budget
            </Link>
          </Alert.Content>
        </Alert>
      )}
      <section aria-labelledby="project-information" className="rounded-xl bg-surface p-5">
        <h2 id="project-information" className="mb-4 font-semibold">
          Informasi proyek
        </h2>
        <dl className="grid gap-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Lokasi", value: project.location || "Belum diisi" },
            { label: "Area / ruangan", value: project.roomArea || "Belum diisi" },
            { label: "Jenis proyek", value: project.projectType || "Belum diisi" },
            {
              label: "Periode",
              value: `${isoDate(project.startDate) || "Belum ditentukan"} — ${isoDate(project.endDate) || "Belum ditentukan"}`,
            },
          ].map((fact) => (
            <div key={fact.label}>
              <dt className="mb-1 text-muted">{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        {project.notes ? (
          <p className="mt-5 border-t border-border pt-4 text-sm whitespace-pre-wrap text-muted">
            {project.notes}
          </p>
        ) : null}
      </section>
      {formOpen && formOptions && editable ? (
        <ProjectForm
          project={editable}
          options={formOptions}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            setSaved(true);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
