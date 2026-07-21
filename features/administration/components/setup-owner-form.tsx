"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { bootstrapFirstOwner } from "@/app/actions/administration";
import { FormField, FormSection, TextInput } from "@/components/ui/form-controls";
import { transitionSpringSnappy } from "@/lib/utils/motion";

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
  const router = useRouter();
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
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Owner pertama dan default ERP berhasil dibuat.");
    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="flex min-h-[calc(100dvh-3rem)] flex-col justify-center py-6">
      <header className="mb-5 px-1">
        <p className="text-[9px] font-bold tracking-[0.16em] text-primary uppercase">
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
        <FormSection
          title="Akun Owner"
          helper="Gunakan identitas aktif. Secret hanya dipakai untuk setup pertama."
        >
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
              placeholder="owner@dekoria.com"
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
          <div className="bg-white p-3.5">
            <motion.button
              type="submit"
              disabled={pending}
              whileTap={pending ? undefined : { scale: 0.97 }}
              transition={transitionSpringSnappy}
              className="min-h-12 w-full rounded-full bg-primary px-6 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending ? "Menyiapkan…" : "Selesaikan setup"}
            </motion.button>
          </div>
        </FormSection>
      </form>
    </section>
  );
}
