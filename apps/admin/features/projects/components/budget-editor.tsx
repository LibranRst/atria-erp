"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Label,
  Link,
  ListBox,
  Modal,
  MoneyValue,
  NumberField,
  Select,
  TextArea,
  TextField,
} from "@/components/ui";
import type { ProjectBudget, ProjectPermissions } from "../types";
import {
  approveBudget,
  createBudget,
  rejectBudget,
  submitBudget,
  updateCategoryAllocation,
} from "../server/actions";
import { BudgetSummary } from "./budget-summary";
import { useUnsavedChanges } from "@/components/unsaved-changes";

type ReviewAction = "submit" | "approve" | "reject" | "allocation" | "create";

export function BudgetEditor({
  projectId,
  projectName,
  contractValue,
  initialBudget,
  permissions,
  locked,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly contractValue: number;
  readonly initialBudget: ProjectBudget | null;
  readonly permissions: ProjectPermissions;
  readonly locked: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const [budget, setBudget] = useState(initialBudget);
  const [serverBudget, setServerBudget] = useState(initialBudget);
  const [categoryId, setCategoryId] = useState(initialBudget?.categories[0]?.id ?? "");
  const [amount, setAmount] = useState(initialBudget?.categories[0]?.allocatedAmount ?? 0);
  const [newContract, setNewContract] = useState(contractValue);
  const [approvedRab, setApprovedRab] = useState(contractValue);
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<ReviewAction | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const category = budget?.categories.find((item) => item.id === categoryId);
  const dirty = budget
    ? amount !== category?.allocatedAmount
    : newContract !== contractValue || approvedRab !== contractValue;
  const canEdit = permissions.canEdit && !locked && budget?.status !== "PENDING_APPROVAL";
  useUnsavedChanges({ dirty, pending, label: "budget proyek" });
  if (initialBudget !== serverBudget) {
    setServerBudget(initialBudget);
    if (!dirty && !pending) {
      setBudget(initialBudget);
      const next =
        initialBudget?.categories.find((item) => item.id === categoryId) ??
        initialBudget?.categories[0];
      setCategoryId(next?.id ?? "");
      setAmount(next?.allocatedAmount ?? 0);
    }
  }

  function selectCategory(id: string): void {
    if (dirty) return;
    const next = budget?.categories.find((item) => item.id === id);
    setCategoryId(id);
    setAmount(next?.allocatedAmount ?? 0);
    setError(null);
  }
  function requestReview(action: ReviewAction): void {
    if (action === "allocation" && (!Number.isFinite(amount) || amount < 0)) {
      setError("Alokasi harus berupa nominal yang tidak negatif.");
      return;
    }
    if (
      action === "create" &&
      (!Number.isFinite(newContract) ||
        !Number.isFinite(approvedRab) ||
        newContract < 0 ||
        approvedRab < 0)
    ) {
      setError("Nilai kontrak dan RAB tidak boleh negatif.");
      return;
    }
    setError(null);
    setReview(action);
  }
  async function commit(): Promise<void> {
    if (!review) return;
    if (review === "reject" && reason.trim().length < 3) {
      setError("Isi alasan revisi minimal 3 karakter.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      let result: ActionResponse<ProjectBudget>;
      if (review === "create")
        result = await createBudget({
          projectId,
          contractValue: newContract,
          approvedRabValue: approvedRab,
        });
      else if (!budget) return;
      else if (review === "allocation")
        result = await updateCategoryAllocation({
          projectBudgetCategoryId: categoryId,
          allocatedAmount: amount,
        });
      else if (review === "submit") result = await submitBudget(budget.budgetId);
      else if (review === "approve") result = await approveBudget(budget.budgetId);
      else result = await rejectBudget(budget.budgetId, reason);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setBudget(result.data);
      const updatedCategory =
        result.data.categories.find((item) => item.id === categoryId) ?? result.data.categories[0];
      setCategoryId(updatedCategory?.id ?? "");
      setAmount(updatedCategory?.allocatedAmount ?? 0);
      setSuccess(
        review === "approve"
          ? "Budget disetujui."
          : review === "reject"
            ? "Budget dikembalikan untuk revisi."
            : review === "submit"
              ? "Budget diajukan untuk persetujuan."
              : review === "create"
                ? "Budget dibuat dari default Settings."
                : "Alokasi kategori disimpan.",
      );
      setReview(null);
      setReason("");
      router.refresh();
    } catch {
      setError("Perubahan belum tersimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }
  const reviewTitle =
    review === "approve"
      ? "Setujui budget proyek?"
      : review === "reject"
        ? "Minta revisi budget"
        : review === "submit"
          ? "Ajukan budget untuk persetujuan?"
          : review === "create"
            ? "Buat budget proyek?"
            : "Simpan alokasi kategori?";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/projects/${projectId}`} className="mb-2 text-sm">
            Kembali ke proyek
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Budget · {projectName}</h1>
          <p className="mt-1 text-sm text-muted">Tinjau alokasi dan persetujuan budget internal.</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={dirty || pending}
          onPress={() => router.refresh()}
        >
          Muat ulang
        </Button>
      </div>
      {success ? (
        <Alert status="success" role="status">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{success}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {error && !review ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {locked ? (
        <Alert>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Proyek terkunci</Alert.Title>
            <Alert.Description>
              Budget proyek yang selesai atau dibatalkan ditampilkan untuk peninjauan.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {budget ? (
        <>
          <BudgetSummary budget={budget} />
          {canEdit ? (
            <section className="rounded-xl bg-surface p-5">
              <h2 className="mb-4 font-semibold">Ubah alokasi kategori</h2>
              <Form
                className="flex flex-wrap items-end gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  requestReview("allocation");
                }}
              >
                <Select
                  value={categoryId}
                  onChange={(value) => {
                    if (typeof value === "string") selectCategory(value);
                  }}
                  isDisabled={dirty || pending}
                  className="w-52"
                >
                  <Label>Kategori</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {budget.categories.map((item) => (
                        <ListBox.Item key={item.id} id={item.id} textValue={item.name}>
                          {item.name}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <NumberField
                  value={amount}
                  onChange={(value) => setAmount(value ?? 0)}
                  minValue={0}
                  isRequired
                  className="w-64"
                  formatOptions={{ style: "currency", currency: "IDR", maximumFractionDigits: 0 }}
                >
                  <Label>Nominal alokasi</Label>
                  <NumberField.Group>
                    <NumberField.Input />
                  </NumberField.Group>
                  <FieldError />
                </NumberField>
                <div className="flex gap-2 pb-1">
                  <Button size="sm" type="submit" isDisabled={!dirty || pending}>
                    Tinjau perubahan
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    isDisabled={!dirty || pending}
                    onPress={() => setAmount(category?.allocatedAmount ?? 0)}
                  >
                    Batalkan
                  </Button>
                </div>
              </Form>
              <p className="mt-3 text-xs text-muted">
                Simpan atau batalkan perubahan sebelum memilih kategori lain. Alokasi mengikuti
                aturan budget proyek.
              </p>
            </section>
          ) : null}
          {!locked && budget.status === "DRAFT" && permissions.canEdit ? (
            <div className="flex items-center gap-3">
              <Button size="sm" isDisabled={dirty} onPress={() => requestReview("submit")}>
                Ajukan persetujuan
              </Button>
              <p className="text-sm text-muted">
                Pastikan plafon dan seluruh alokasi sudah sesuai.
              </p>
            </div>
          ) : null}
          {!locked && budget.status === "PENDING_APPROVAL" ? (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Menunggu persetujuan</Alert.Title>
                <Alert.Description>
                  Alokasi tidak diedit selama budget sedang ditinjau.
                </Alert.Description>
                {permissions.canApproveBudget ? (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onPress={() => requestReview("approve")}>
                      Setujui budget
                    </Button>
                    <Button size="sm" variant="secondary" onPress={() => requestReview("reject")}>
                      Minta revisi
                    </Button>
                  </div>
                ) : null}
              </Alert.Content>
            </Alert>
          ) : null}
        </>
      ) : (
        <section className="rounded-xl bg-surface p-5">
          <h2 className="font-semibold">Budget belum tersedia</h2>
          <p className="mt-1 text-sm text-muted">
            Alokasi awal mengikuti Budget Allocation dan Expense Categories di Settings.
          </p>
          {permissions.canCreateBudget && !locked ? (
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                requestReview("create");
              }}
              className="mt-5 flex flex-wrap items-end gap-4"
            >
              <NumberField
                value={newContract}
                onChange={(value) => setNewContract(value ?? 0)}
                minValue={0}
                isRequired
                formatOptions={{ style: "currency", currency: "IDR", maximumFractionDigits: 0 }}
                className="w-64"
              >
                <Label>Nilai kontrak</Label>
                <NumberField.Group>
                  <NumberField.Input />
                </NumberField.Group>
                <FieldError />
              </NumberField>
              <NumberField
                value={approvedRab}
                onChange={(value) => setApprovedRab(value ?? 0)}
                minValue={0}
                formatOptions={{ style: "currency", currency: "IDR", maximumFractionDigits: 0 }}
                className="w-64"
              >
                <Label>Nilai RAB disetujui</Label>
                <NumberField.Group>
                  <NumberField.Input />
                </NumberField.Group>
                <FieldError />
              </NumberField>
              <Button size="sm" type="submit" className="mb-1">
                Tinjau budget baru
              </Button>
            </Form>
          ) : null}
        </section>
      )}
      <Modal>
        <Modal.Backdrop
          isOpen={review !== null}
          isDismissable={!pending}
          isKeyboardDismissDisabled={pending}
          onOpenChange={(open) => {
            if (!open && !pending) {
              setReview(null);
              setError(null);
            }
          }}
        >
          <Modal.Container size="sm" placement="center">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{reviewTitle}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  {review === "allocation"
                    ? `Alokasi ${category?.name ?? "kategori"} akan diperbarui setelah disimpan.`
                    : review === "create"
                      ? "Budget dibuat sebagai draf dengan alokasi dari Settings yang aktif."
                      : review === "approve"
                        ? "Budget ini menjadi baseline yang disetujui untuk kontrol biaya proyek."
                        : review === "submit"
                          ? "Budget dikirim ke pengguna berizin untuk ditinjau."
                          : "Budget kembali ke draf agar tim dapat memperbaikinya."}
                </p>
                {review === "allocation" ? (
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Alokasi saat ini</dt>
                      <dd>
                        <MoneyValue amount={category?.allocatedAmount ?? 0} />
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Alokasi baru</dt>
                      <dd className="font-semibold">
                        <MoneyValue amount={amount} />
                      </dd>
                    </div>
                  </dl>
                ) : review === "create" ? (
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Nilai kontrak</dt>
                      <dd>
                        <MoneyValue amount={newContract} />
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">RAB disetujui</dt>
                      <dd>
                        <MoneyValue amount={approvedRab} />
                      </dd>
                    </div>
                  </dl>
                ) : budget && review !== "reject" ? (
                  <p className="mt-4 text-sm">
                    Budget internal <MoneyValue amount={budget.internalBudget} /> untuk{" "}
                    {projectName}.
                  </p>
                ) : null}
                {review === "reject" ? (
                  <TextField value={reason} onChange={setReason} isRequired className="mt-4">
                    <Label>Alasan revisi</Label>
                    <TextArea autoFocus rows={3} />
                    <Description>Jelaskan bagian yang perlu diperbaiki.</Description>
                    <FieldError />
                  </TextField>
                ) : null}
                {error ? (
                  <p role="alert" className="text-danger mt-3 text-sm">
                    {error}
                  </p>
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  size="sm"
                  variant="tertiary"
                  isDisabled={pending}
                  onPress={() => {
                    setReview(null);
                    setError(null);
                  }}
                >
                  Batal
                </Button>
                <Button size="sm" isPending={pending} onPress={() => void commit()}>
                  {pending
                    ? "Memproses…"
                    : review === "approve"
                      ? "Setujui"
                      : review === "reject"
                        ? "Kirim revisi"
                        : review === "submit"
                          ? "Ajukan"
                          : "Simpan"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
