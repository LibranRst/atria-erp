"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  MoneyValue,
  NumberField,
  Select,
  TextArea,
  TextField,
} from "@/components/ui";
import { createProject, updateProject } from "../server/actions";
import {
  createProjectInput,
  projectDraft,
  updateProjectInput,
  validateProjectDraft,
  type EditableProject,
  type ProjectDraft,
} from "../form-model";
import type { ProjectFormOptions } from "../types";

export function ProjectForm({
  project,
  options,
  onClose,
  onSaved,
}: {
  readonly project: EditableProject | null;
  readonly options: ProjectFormOptions;
  readonly onClose: () => void;
  readonly onSaved: (projectId: string) => void;
}): React.JSX.Element {
  const [initial] = useState(() => projectDraft(project));
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [stage, setStage] = useState<"edit" | "review" | "discard">("edit");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const editing = project !== null;

  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent): void {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function patch(next: Partial<ProjectDraft>): void {
    setDraft((current) => ({ ...current, ...next }));
    setError(null);
  }
  function close(): void {
    if (pending) return;
    if (dirty) setStage("discard");
    else onClose();
  }
  function review(): void {
    const message = validateProjectDraft(draft, editing);
    if (message) setError(message);
    else {
      setError(null);
      setStage("review");
    }
  }
  async function save(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const result = project
        ? await updateProject(updateProjectInput(project.id, draft))
        : await createProject(createProjectInput(draft));
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      onSaved(result.data.id);
    } catch {
      setError("Proyek belum tersimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }
  const title =
    stage === "discard"
      ? "Buang perubahan proyek?"
      : stage === "review"
        ? "Tinjau proyek"
        : editing
          ? "Edit proyek"
          : "Proyek baru";

  return (
    <Modal>
      <Modal.Backdrop
        isOpen
        isDismissable={!pending}
        isKeyboardDismissDisabled={pending}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {error ? (
                <Alert status="danger" role="alert">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{error}</Alert.Title>
                  </Alert.Content>
                </Alert>
              ) : null}
              {stage === "discard" ? (
                <p className="text-sm text-muted">
                  Perubahan belum disimpan. Lanjutkan mengedit atau buang perubahan untuk menutup
                  form.
                </p>
              ) : stage === "review" ? (
                <div className="space-y-4">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
                    <dt className="text-muted">Nama proyek</dt>
                    <dd>{draft.name}</dd>
                    <dt className="text-muted">Klien</dt>
                    <dd>
                      {options.clients.find((item) => item.id === draft.clientId)?.name ??
                        draft.newClientName}
                    </dd>
                    <dt className="text-muted">Project Manager</dt>
                    <dd>
                      {options.users.find((item) => item.id === draft.projectManagerId)?.name ??
                        "—"}
                    </dd>
                    <dt className="text-muted">Nilai kontrak</dt>
                    <dd>
                      <MoneyValue amount={draft.totalContractValue} />
                    </dd>
                    <dt className="text-muted">Lokasi</dt>
                    <dd>{draft.location || "—"}</dd>
                    <dt className="text-muted">Periode</dt>
                    <dd>
                      {draft.startDate || "Belum ditentukan"} —{" "}
                      {draft.endDate || "Belum ditentukan"}
                    </dd>
                  </dl>
                  <Alert>
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>
                        {editing
                          ? "Penugasan PM memengaruhi akses proyek. Budget dan laporan menggunakan data terbaru setelah disimpan."
                          : "Proyek dibuat sebagai draf. Alokasi budget awal mengikuti default Settings."}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                </div>
              ) : (
                <Form
                  id="project-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    review();
                  }}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                >
                  <TextField
                    name="name"
                    isRequired
                    value={draft.name}
                    onChange={(value) => patch({ name: value })}
                    className="sm:col-span-2"
                  >
                    <Label>Nama proyek</Label>
                    <Input autoFocus />
                    <FieldError />
                  </TextField>
                  <Select
                    name="clientId"
                    value={draft.clientId || null}
                    onChange={(value) =>
                      patch({ clientId: typeof value === "string" ? value : "" })
                    }
                    placeholder="Pilih klien"
                    isRequired={editing}
                  >
                    <Label>Klien</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {options.clients.map((client) => (
                          <ListBox.Item key={client.id} id={client.id} textValue={client.name}>
                            {client.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                    <FieldError />
                  </Select>
                  <Select
                    name="projectManagerId"
                    value={draft.projectManagerId || null}
                    onChange={(value) =>
                      patch({ projectManagerId: typeof value === "string" ? value : "" })
                    }
                    placeholder="Pilih PM"
                    isRequired
                  >
                    <Label>Project Manager</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {options.users.map((manager) => (
                          <ListBox.Item key={manager.id} id={manager.id} textValue={manager.name}>
                            {manager.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                    <FieldError />
                  </Select>
                  {!editing ? (
                    <TextField
                      value={draft.newClientName}
                      onChange={(value) =>
                        patch({ newClientName: value, clientId: value ? "" : draft.clientId })
                      }
                      className="sm:col-span-2"
                    >
                      <Label>Nama klien baru</Label>
                      <Input />
                      <Description>Isi jika klien belum ada dalam pilihan di atas.</Description>
                    </TextField>
                  ) : null}
                  <NumberField
                    name="contractValue"
                    minValue={0}
                    value={draft.totalContractValue}
                    onChange={(value) => patch({ totalContractValue: value ?? 0 })}
                    formatOptions={{ style: "currency", currency: "IDR", maximumFractionDigits: 0 }}
                  >
                    <Label>Nilai kontrak</Label>
                    <NumberField.Group>
                      <NumberField.Input />
                    </NumberField.Group>
                    <FieldError />
                  </NumberField>
                  <TextField
                    value={draft.location}
                    onChange={(value) => patch({ location: value })}
                  >
                    <Label>Lokasi</Label>
                    <Input />
                  </TextField>
                  <TextField
                    type="date"
                    value={draft.startDate}
                    onChange={(value) => patch({ startDate: value })}
                  >
                    <Label>Tanggal mulai</Label>
                    <Input />
                  </TextField>
                  <TextField
                    type="date"
                    value={draft.endDate}
                    onChange={(value) => patch({ endDate: value })}
                  >
                    <Label>Tanggal selesai</Label>
                    <Input />
                  </TextField>
                  <TextField
                    value={draft.roomArea}
                    onChange={(value) => patch({ roomArea: value })}
                  >
                    <Label>Area / ruangan</Label>
                    <Input />
                  </TextField>
                  <TextField
                    value={draft.projectType}
                    onChange={(value) => patch({ projectType: value })}
                  >
                    <Label>Jenis proyek</Label>
                    <Input />
                  </TextField>
                  <TextField
                    value={draft.notes}
                    onChange={(value) => patch({ notes: value })}
                    className="sm:col-span-2"
                  >
                    <Label>Catatan</Label>
                    <TextArea rows={3} />
                  </TextField>
                </Form>
              )}
            </Modal.Body>
            <Modal.Footer>
              {stage === "discard" ? (
                <>
                  <Button size="sm" variant="secondary" onPress={() => setStage("edit")}>
                    Lanjutkan mengedit
                  </Button>
                  <Button size="sm" variant="danger" onPress={onClose}>
                    Buang perubahan
                  </Button>
                </>
              ) : stage === "review" ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={pending}
                    onPress={() => setStage("edit")}
                  >
                    Kembali ke form
                  </Button>
                  <Button size="sm" isPending={pending} onPress={() => void save()}>
                    {pending ? "Menyimpan…" : editing ? "Simpan perubahan" : "Buat proyek"}
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="tertiary" onPress={close}>
                    Batal
                  </Button>
                  <Button size="sm" type="submit" form="project-form">
                    Tinjau proyek
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
