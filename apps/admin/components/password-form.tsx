"use client";

import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Link,
  Spinner,
  TextField,
} from "@heroui/react";
import { changePassword } from "@/app/change-password/actions";
import { authClient } from "@/lib/auth-client";
import { passwordFieldErrors } from "./password-validation";

export function PasswordForm({ temporary }: { readonly temporary: boolean }): React.JSX.Element {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const errors = passwordFieldErrors(
      { currentPassword, newPassword, confirmPassword },
      temporary,
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setError(null);
    setPending(true);
    try {
      const result = await changePassword({ currentPassword, newPassword });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (result.requiresLogin) {
        await authClient.signOut();
        window.location.replace("/login?changed=true");
      } else setSaved(true);
    } catch {
      setError("Kata sandi belum tersimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  if (saved)
    return (
      <div className="space-y-4">
        <Alert status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Kata sandi diperbarui</Alert.Title>
            <Alert.Description>
              Perangkat lain telah dikeluarkan. Perangkat ini tetap masuk.
            </Alert.Description>
          </Alert.Content>
        </Alert>
        <Link href="/projects">
          Kembali ke proyek
          <Link.Icon aria-hidden="true" />
        </Link>
      </div>
    );

  return (
    <Form
      className="space-y-4"
      validationBehavior="aria"
      validationErrors={fieldErrors}
      onSubmit={(event: FormEvent<HTMLFormElement>): void => {
        void submit(event);
      }}
    >
      {error ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Belum bisa mengganti kata sandi</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <TextField
        name="currentPassword"
        type="password"
        value={currentPassword}
        onChange={setCurrentPassword}
        isDisabled={pending}
        isRequired
        autoComplete="current-password"
      >
        <Label>{temporary ? "Kata sandi sementara" : "Kata sandi saat ini"}</Label>
        <Input autoFocus />
        <FieldError />
      </TextField>
      <TextField
        name="newPassword"
        type="password"
        value={newPassword}
        onChange={setNewPassword}
        isDisabled={pending}
        isRequired
        autoComplete="new-password"
      >
        <Label>Kata sandi baru</Label>
        <Input />
        <Description>Minimal 12 karakter, dengan huruf besar, huruf kecil, dan angka.</Description>
        <FieldError />
      </TextField>
      <TextField
        name="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        isDisabled={pending}
        isRequired
        autoComplete="new-password"
      >
        <Label>Konfirmasi kata sandi baru</Label>
        <Input />
        <FieldError />
      </TextField>
      <p className="text-xs text-muted">
        {temporary
          ? "Setelah disimpan, masuk kembali dengan kata sandi baru."
          : "Sesi pada perangkat lain akan dikeluarkan setelah disimpan."}
      </p>
      <Button type="submit" fullWidth size="md" isPending={pending}>
        {pending ? <Spinner size="sm" color="current" /> : null}
        {pending ? "Menyimpan…" : "Simpan kata sandi"}
      </Button>
      {!temporary ? (
        <Link href="/account" className="text-sm">
          Kembali ke akun
        </Link>
      ) : null}
    </Form>
  );
}
