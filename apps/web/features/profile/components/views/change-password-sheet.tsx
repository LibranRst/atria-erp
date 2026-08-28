"use client";

import React from "react";
import { toast } from "sonner";

import { changeOwnPassword } from "@/app/actions/profile/change-own-password";
import { FormField, FormSection, OperationalFormSheet, TextInput } from "@/components/ui";
import {
  canSubmitPassword,
  getConfirmPasswordError,
  getNewPasswordError,
} from "@/features/profile/utils/profile-form";

export function ChangePasswordSheet({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): React.JSX.Element {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const newPasswordError = getNewPasswordError(currentPassword, newPassword);
  /*
   * Konfirmasi hanya hidup di klien — server tidak perlu tahu tentangnya. Ia
   * ada karena kolom kata sandi tersembunyi: salah ketik satu huruf berarti
   * terkunci dari akun sendiri, sementara sesi perangkat lain sudah dicabut.
   */
  const confirmError = getConfirmPasswordError(newPassword, confirmPassword);
  const canSubmit = canSubmitPassword({ currentPassword, newPassword, confirmPassword });

  function reset(): void {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function submit(): Promise<void> {
    if (!canSubmit) return;

    setPending(true);
    const result = await changeOwnPassword({ currentPassword, newPassword });
    setPending(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    reset();
    toast.success("Password diperbarui. Perangkat lain sudah dikeluarkan.");
    onClose();
  }

  return (
    <OperationalFormSheet
      open={open}
      title="Ganti password"
      submitLabel="Simpan password"
      submittingLabel="Menyimpan…"
      pending={pending}
      disabled={!canSubmit}
      disabledReason={canSubmit ? undefined : "Lengkapi ketiga kolom terlebih dahulu."}
      statusText="Perangkat lain akan keluar otomatis. Perangkat ini tetap masuk."
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <FormSection
        title="Password saat ini"
        helper="Diperlukan untuk memastikan perangkat ini memang milik Anda."
      >
        <FormField label="Password saat ini" htmlFor="profile-current-password" required>
          <TextInput
            id="profile-current-password"
            name="currentPassword"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            placeholder="Password yang dipakai sekarang"
          />
        </FormField>
      </FormSection>

      <FormSection title="Password baru">
        <FormField
          label="Password baru"
          htmlFor="profile-new-password"
          helper="Minimal 12 karakter, huruf besar, huruf kecil, dan angka."
          error={newPasswordError}
          required
        >
          <TextInput
            id="profile-new-password"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            aria-invalid={Boolean(newPasswordError)}
          />
        </FormField>
        <FormField
          label="Ulangi password baru"
          htmlFor="profile-confirm-password"
          error={confirmError}
          required
        >
          <TextInput
            id="profile-confirm-password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            aria-invalid={Boolean(confirmError)}
          />
        </FormField>
      </FormSection>
    </OperationalFormSheet>
  );
}
