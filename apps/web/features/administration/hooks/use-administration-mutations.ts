"use client";

import React from "react";
import { toast } from "sonner";
import {
  createStaffUser,
  getAdministrationOverview,
  saveVendor,
  setVendorActive,
  updateStaffUser,
  type AdministrationOverview,
} from "@/app/actions/administration";
import type {
  EditorMode,
  UserFormState,
  VendorFormState,
} from "../components/forms/administration-editor-types";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
type Args = {
  readonly editorMode: EditorMode;
  readonly selectedUser: AdministrationOverview["users"][number] | undefined;
  readonly selectedVendor: AdministrationOverview["vendors"][number] | undefined;
  readonly userForm: UserFormState;
  readonly vendorForm: VendorFormState;
  readonly onMutationComplete?: () => void;
  readonly setData: Setter<AdministrationOverview>;
  readonly setEditorMode: Setter<EditorMode>;
  readonly setSelectedUserId: Setter<string | null>;
  readonly setSelectedVendorId: Setter<string | null>;
};
type Result = {
  readonly pending: boolean;
  readonly submitUser: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  readonly submitVendor: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  readonly toggleSelectedUser: () => Promise<void>;
  readonly toggleSelectedVendor: () => Promise<void>;
};

export function useAdministrationMutations({
  editorMode,
  selectedUser,
  selectedVendor,
  userForm,
  vendorForm,
  onMutationComplete,
  setData,
  setEditorMode,
  setSelectedUserId,
  setSelectedVendorId,
}: Args): Result {
  const [pending, setPending] = React.useState(false);
  const refresh = async (): Promise<void> => {
    setEditorMode(null);
    setSelectedUserId(null);
    setSelectedVendorId(null);
    const result = await getAdministrationOverview();
    if (result.success) {
      setData(result.data);
      onMutationComplete?.();
      return;
    }
    toast.warning(
      "Data tersimpan, tetapi daftar terbaru belum dapat dimuat. Halaman akan dimuat ulang.",
    );
    window.location.reload();
  };
  const submitUser = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setPending(true);
    const result =
      editorMode === "EDIT_USER" && selectedUser
        ? await updateStaffUser({
            userId: selectedUser.id,
            name: userForm.name,
            roleId: userForm.roleId,
            isActive: selectedUser.isActive,
          })
        : await createStaffUser({
            name: userForm.name,
            email: userForm.email,
            roleId: userForm.roleId,
            temporaryPassword: userForm.temporaryPassword,
          });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      editorMode === "EDIT_USER" ? "User diperbarui." : "User dibuat dengan password sementara.",
    );
    await refresh();
  };
  const submitVendor = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setPending(true);
    const result = await saveVendor({
      vendorId: selectedVendor?.id,
      name: vendorForm.name,
      email: vendorForm.email,
      phone: vendorForm.phone,
      address: vendorForm.address,
      bankName: vendorForm.bankName,
      bankAccountNumber: vendorForm.bankAccountNumber,
      bankAccountHolder: vendorForm.bankAccountHolder,
      isActive: selectedVendor?.isActive ?? true,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(selectedVendor ? "Vendor diperbarui." : "Vendor dibuat.");
    await refresh();
  };
  const toggleSelectedUser = async (): Promise<void> => {
    if (!selectedUser) return;
    setPending(true);
    const result = await updateStaffUser({
      userId: selectedUser.id,
      name: selectedUser.name,
      roleId: selectedUser.roleId,
      isActive: !selectedUser.isActive,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    setData((current) => ({
      ...current,
      users: current.users.map((row) =>
        row.id === selectedUser.id ? { ...row, isActive: !row.isActive } : row,
      ),
    }));
    setEditorMode(null);
  };
  const toggleSelectedVendor = async (): Promise<void> => {
    if (!selectedVendor) return;
    setPending(true);
    const result = await setVendorActive({
      vendorId: selectedVendor.id,
      isActive: !selectedVendor.isActive,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    setData((current) => ({
      ...current,
      vendors: current.vendors.map((row) =>
        row.id === selectedVendor.id ? { ...row, isActive: !row.isActive } : row,
      ),
    }));
    setEditorMode(null);
  };
  return { pending, submitUser, submitVendor, toggleSelectedUser, toggleSelectedVendor };
}
