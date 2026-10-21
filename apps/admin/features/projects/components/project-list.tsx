"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectItem } from "@atria/core/types/projects";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  Alert,
  Button,
  Label,
  Link,
  ListBox,
  MoneyValue,
  SearchField,
  Select,
  StatusChip,
  Table,
  type SortDescriptor,
} from "@/components/ui";
import type { ProjectFormOptions, ProjectPermissions } from "../types";
import { ProjectForm } from "./project-form";

function projectSortValue(project: ProjectItem, column: string): string | number {
  if (column === "value") return project.totalContractValue;
  if (column === "budget") return project.internalBudget;
  if (column === "actual") return project.actualCost;
  if (column === "remaining") return project.remainingBudget;
  if (column === "usage") return project.usedPercentage;
  return project.name;
}

export function ProjectList({
  projects,
  permissions,
  formOptions,
}: {
  readonly projects: readonly ProjectItem[];
  readonly permissions: ProjectPermissions;
  readonly formOptions: ProjectFormOptions | null;
}): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortDescriptor>({ column: "name", direction: "ascending" });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    return projects
      .filter(
        (project) =>
          (filter === "ALL" ||
            project.status === filter ||
            (filter === "RISK" && project.effectiveHealth !== "HEALTHY")) &&
          (!needle ||
            `${project.name} ${project.clientName} ${project.pmName}`
              .toLocaleLowerCase("id-ID")
              .includes(needle)),
      )
      .sort((a, b) => {
        const first = projectSortValue(a, String(sort.column));
        const second = projectSortValue(b, String(sort.column));
        const comparison =
          typeof first === "number" && typeof second === "number"
            ? first - second
            : String(first).localeCompare(String(second), "id-ID");
        return sort.direction === "descending" ? -comparison : comparison;
      });
  }, [projects, query, filter, sort]);
  const selected = visible.find((project) => project.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyek</h1>
          <p className="mt-1 text-sm text-muted">
            Bandingkan budget, realisasi, dan risiko tiap proyek.
          </p>
        </div>
        {permissions.canCreate && formOptions ? (
          <Button
            size="sm"
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Buat proyek
          </Button>
        ) : null}
      </div>
      {message ? (
        <Alert status="success" role="status">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{message}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <SearchField value={query} onChange={setQuery} className="w-full max-w-sm">
          <Label>Cari proyek</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Nama proyek, klien, atau PM" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Select
          value={filter}
          onChange={(value) => setFilter(typeof value === "string" ? value : "ALL")}
          className="w-44"
        >
          <Label>Tampilkan</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {[
                { id: "ALL", label: "Semua proyek" },
                { id: "ACTIVE", label: "Aktif" },
                { id: "DRAFT", label: "Draf" },
                { id: "ON_HOLD", label: "Ditunda" },
                { id: "COMPLETED", label: "Selesai" },
                { id: "CANCELLED", label: "Dibatalkan" },
                { id: "RISK", label: "Perlu perhatian" },
              ].map((item) => (
                <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
                  {item.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <span className="pb-2 text-sm text-muted" aria-live="polite">
          {visible.length} dari {projects.length} proyek
        </span>
      </div>
      <div
        className={selected ? "grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]" : "min-w-0"}
      >
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Daftar proyek dan penggunaan budget"
              className="min-w-[820px]"
              selectionMode="single"
              selectedKeys={selected ? new Set([selected.id]) : new Set()}
              onSelectionChange={(keys) => {
                if (keys !== "all") {
                  const key = keys.values().next().value;
                  setSelectedId(typeof key === "string" ? key : null);
                }
              }}
              sortDescriptor={sort}
              onSortChange={setSort}
            >
              <Table.Header>
                {[
                  { id: "name", label: "Proyek" },
                  { id: "value", label: "Nilai kontrak" },
                  { id: "budget", label: "Budget" },
                  { id: "actual", label: "Terpakai" },
                  { id: "remaining", label: "Sisa budget" },
                  { id: "usage", label: "Penggunaan" },
                ].map((column) => (
                  <Table.Column
                    key={column.id}
                    id={column.id}
                    isRowHeader={column.id === "name"}
                    allowsSorting
                    textValue={column.label}
                  >
                    {({ sortDirection }) => (
                      <Table.SortableColumnHeader sortDirection={sortDirection}>
                        {column.label}
                      </Table.SortableColumnHeader>
                    )}
                  </Table.Column>
                ))}
                <Table.Column id="status">Status</Table.Column>
              </Table.Header>
              <Table.Body
                items={visible}
                renderEmptyState={() => (
                  <div className="py-12 text-center">
                    <p className="font-medium">
                      {projects.length ? "Tidak ada proyek yang cocok" : "Belum ada proyek"}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {projects.length
                        ? "Ubah pencarian atau filter untuk melihat proyek lain."
                        : "Buat proyek pertama untuk menyiapkan budget kategori."}
                    </p>
                  </div>
                )}
              >
                {(project) => (
                  <Table.Row id={project.id} textValue={project.name}>
                    <Table.Cell>
                      <div className="max-w-56">
                        <Link href={`/projects/${project.id}`} className="font-medium">
                          {project.name}
                        </Link>
                        <p className="mt-1 truncate text-xs text-muted">
                          {project.clientName} · {project.pmName}
                        </p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <MoneyValue amount={project.totalContractValue} compact />
                    </Table.Cell>
                    <Table.Cell>
                      <MoneyValue amount={project.internalBudget} compact />
                    </Table.Cell>
                    <Table.Cell>
                      <MoneyValue amount={project.actualCost} compact />
                    </Table.Cell>
                    <Table.Cell>
                      <MoneyValue
                        amount={project.remainingBudget}
                        compact
                        className={project.remainingBudget < 0 ? "text-danger" : ""}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <span className="tabular-nums">
                        {project.usedPercentage.toLocaleString("id-ID", {
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusChip status={project.status} />
                        {project.effectiveHealth !== "HEALTHY" ? (
                          <StatusChip status={project.effectiveHealth} />
                        ) : null}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
          <Table.Footer>
            <span className="text-xs text-muted">
              Pilih baris untuk ringkasan, atau buka nama proyek untuk detail.
            </span>
          </Table.Footer>
        </Table>
        {selected ? (
          <aside
            aria-label={`Ringkasan ${selected.name}`}
            className="self-start rounded-xl bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{selected.name}</h2>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => setSelectedId(null)}
                aria-label="Tutup ringkasan"
              >
                Tutup
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted">{selected.clientName}</p>
            <dl className="my-5 space-y-3 text-sm">
              {[
                { label: "Nilai kontrak", value: selected.totalContractValue },
                { label: "Budget internal", value: selected.internalBudget },
                { label: "Terpakai", value: selected.actualCost },
                { label: "Sisa budget", value: selected.remainingBudget },
              ].map((metric) => (
                <div key={metric.label} className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted">{metric.label}</dt>
                  <dd>
                    <MoneyValue amount={metric.value} compact />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="space-y-3 border-t border-border pt-4 text-sm">
              <p>{selected.pmName}</p>
              <p className="text-muted">{selected.location || "Lokasi belum diisi"}</p>
              <p className="text-muted">Budget {formatBusinessLabel(selected.budgetStatus)}</p>
              <StatusChip status={selected.effectiveHealth} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href={`/projects/${selected.id}`}>Buka proyek</Link>
              {permissions.canEdit &&
              formOptions &&
              selected.status !== "COMPLETED" &&
              selected.status !== "CANCELLED" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    setEditing(selected);
                    setFormOpen(true);
                  }}
                >
                  Edit
                </Button>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
      {formOpen && formOptions ? (
        <ProjectForm
          project={editing}
          options={formOptions}
          onClose={() => setFormOpen(false)}
          onSaved={(id) => {
            setFormOpen(false);
            setMessage(editing ? "Perubahan proyek disimpan." : "Proyek berhasil dibuat.");
            setSelectedId(id);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
