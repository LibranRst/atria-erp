"use client";
import React from "react";
import { toast } from "sonner";

import { bootstrapFirstOwner } from "@/app/actions/administration";
import { FormField, FormSection, TextInput, Button } from "@/components/ui";

type SetupFormState = {
  readonly bootstrapSecret: string;
  readonly name: string;
  readonly email: string;
  readonly password: string;
};

const EMPTY_FORM: SetupFormState = {
  bootstrapSecret: "",
  name: "",
  email: "",
  password: "",
};

export function SetupOwnerForm(): React.JSX.Element {
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState<SetupFormState>(EMPTY_FORM);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    const result = await bootstrapFirstOwner({
      bootstrapSecret: form.bootstrapSecret,
      name: form.name,
      email: form.email,
      password: form.password,
    });
    if (!result.success) {
      setPending(false);
      toast.error(result.error.message);
      return;
    }

    // Bootstrap mengubah state global sekali jalan: empat role system, lima
    // kategori canonical, default budget, dan kunci `app_config`. Setelah itu
    // `/setup` menolak dirinya sendiri lewat `redirect("/login")` di server.
    //
    // Navigasi lunak tidak boleh dipakai di sini. `router.refresh()` memuat
    // ulang tree yang sedang aktif — masih `/setup` saat itu — sehingga RSC
    // `/setup` dirender ulang, mengembalikan redirect server, lalu berlomba
    // dengan `router.replace()` yang belum selesai. Pada `bun dev`, `/login`
    // masih harus dikompilasi on-demand sehingga jendela lomba itu melebar dan
    // halaman menggantung di status "Rendering".
    //
    // Muat ulang dokumen supaya router dan cache RSC benar-benar bersih.
    // `pending` sengaja dibiarkan true agar tombol tidak sempat aktif kembali.
    window.location.replace("/login");
  }

  return (
    <section className="flex min-h-[calc(100dvh-3rem)] flex-col justify-center py-6">
      <header className="mb-5">
        <p className="text-eyebrow font-bold tracking-[0.16em] text-primary uppercase">
          Setup production
        </p>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight text-on-surface">
          Buat Owner pertama
        </h1>
        <p className="mt-2 text-[12px] leading-5 text-on-surface-variant">
          Langkah ini hanya tersedia satu kali. Sistem juga menyiapkan role dan kategori budget
          canonical tanpa data transaksi contoh.
        </p>
      </header>
      <form onSubmit={submit} className="space-y-3">
        <FormSection title="">
          <FormField label="Bootstrap secret" required>
            <TextInput
              value={form.bootstrapSecret}
              onChange={(bootstrapSecret) =>
                setForm((current) => ({ ...current, bootstrapSecret }))
              }
              type="password"
              autoComplete="off"
              placeholder="Masukkan secret dari environment"
              disabled={pending}
              required
            />
          </FormField>
          <FormField label="Nama Owner" required>
            <TextInput
              value={form.name}
              onChange={(name) => setForm((current) => ({ ...current, name }))}
              autoComplete="name"
              placeholder="Contoh: Raden Indra"
              disabled={pending}
              required
            />
          </FormField>
          <FormField label="Email" required>
            <TextInput
              value={form.email}
              onChange={(email) => setForm((current) => ({ ...current, email }))}
              type="email"
              autoComplete="email"
              placeholder="owner@perusahaan.com"
              disabled={pending}
              required
            />
          </FormField>
          <FormField
            label="Password awal"
            helper="Minimal 12 karakter, huruf besar, huruf kecil, dan angka."
            required
          >
            <TextInput
              value={form.password}
              onChange={(password) => setForm((current) => ({ ...current, password }))}
              type="password"
              autoComplete="new-password"
              placeholder="Buat password Owner yang aman"
              disabled={pending}
              required
            />
          </FormField>
        </FormSection>
        <Button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full rounded-full bg-primary px-6 text-sm font-bold text-white disabled:opacity-50"
          variant="primary"
        >
          {pending ? "Menyiapkan…" : "Selesaikan setup"}
        </Button>
      </form>
    </section>
  );
}
