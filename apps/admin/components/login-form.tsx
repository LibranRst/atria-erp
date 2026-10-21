"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, FieldError, Form, Input, Label, Spinner, TextField } from "@heroui/react";
import { authClient } from "@/lib/auth-client";

export function LoginForm({
  destination,
  passwordChanged = false,
}: {
  readonly destination: string;
  readonly passwordChanged?: boolean;
}): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(
          result.error.status === 429
            ? "Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi."
            : "Email atau kata sandi tidak sesuai. Periksa lalu coba lagi.",
        );
        return;
      }
      // A document request reads the new cookie and runs all server access gates.
      window.location.replace(destination);
    } catch {
      setError("Server Atria tidak dapat dijangkau. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Form
      className="space-y-4"
      onSubmit={(event: FormEvent<HTMLFormElement>): void => {
        void submit(event);
      }}
    >
      {passwordChanged ? (
        <Alert status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Kata sandi diperbarui</Alert.Title>
            <Alert.Description>Masuk dengan kata sandi baru Anda.</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {error ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Belum bisa masuk</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <TextField
        name="email"
        type="email"
        value={email}
        onChange={setEmail}
        isRequired
        isDisabled={pending}
        autoComplete="username"
        validate={(value: string): string | null =>
          !value.trim()
            ? "Email wajib diisi."
            : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
              ? null
              : "Masukkan alamat email yang valid."
        }
      >
        <Label>Email</Label>
        <Input autoFocus placeholder="nama@dekoria.com" />
        <FieldError />
      </TextField>
      <TextField
        name="password"
        type="password"
        value={password}
        onChange={setPassword}
        isRequired
        isDisabled={pending}
        autoComplete="current-password"
        validate={(value: string): string | null => (value ? null : "Kata sandi wajib diisi.")}
      >
        <Label>Kata sandi</Label>
        <Input />
        <FieldError />
      </TextField>
      <Button type="submit" fullWidth size="md" isPending={pending}>
        {pending ? <Spinner size="sm" color="current" /> : null}
        {pending ? "Memeriksa…" : "Masuk"}
      </Button>
    </Form>
  );
}
