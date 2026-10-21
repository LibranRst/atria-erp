"use client";

import { useState, type FormEvent } from "react";
import { Button, FieldError, Form, Input, Label, Spinner, TextField } from "@heroui/react";
import { useRouter } from "next/navigation";
import { updateAccount } from "@/app/(workspace)/account/actions";

export function AccountForm({ initialName }: { readonly initialName: string }): React.JSX.Element {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending || name.trim() === savedName) return;
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const result = await updateAccount({ name });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSavedName(name.trim());
      setName(name.trim());
      setMessage("Nama akun diperbarui.");
      router.refresh();
    } catch {
      setError("Nama belum tersimpan. Periksa koneksi lalu coba lagi.");
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
      <TextField
        name="name"
        value={name}
        onChange={setName}
        isDisabled={pending}
        isRequired
        minLength={2}
        maxLength={80}
        autoComplete="name"
        validate={(value: string): string | null =>
          value.trim().length < 2 ? "Nama minimal 2 karakter." : null
        }
      >
        <Label>Nama</Label>
        <Input />
        <FieldError />
      </TextField>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-success">
          {message}
        </p>
      ) : null}
      <Button type="submit" size="sm" isPending={pending} isDisabled={name.trim() === savedName}>
        {pending ? <Spinner size="sm" color="current" /> : null}
        {pending ? "Menyimpan…" : "Simpan nama"}
      </Button>
    </Form>
  );
}
