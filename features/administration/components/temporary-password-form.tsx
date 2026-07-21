"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { changeTemporaryPassword } from "@/app/actions/administration";
import { FormField, FormSection, TextInput } from "@/components/ui/form-controls";
import { authClient } from "@/lib/auth-client";
import { transitionSpringSnappy } from "@/lib/utils/motion";

export function TemporaryPasswordForm(): React.JSX.Element {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedCurrentPassword = String(formData.get("currentPassword") ?? "");
    const submittedNewPassword = String(formData.get("newPassword") ?? "");
    setPending(true);
    const result = await changeTemporaryPassword({
      currentPassword: submittedCurrentPassword,
      newPassword: submittedNewPassword,
    });
    if (!result.success) {
      setPending(false);
      toast.error(result.error.message);
      return;
    }
    await authClient.signOut();
    toast.success("Password diperbarui. Silakan login kembali.");
    router.replace("/login");
    router.refresh();
  }
  return (
    <section className="flex min-h-[calc(100dvh-3rem)] flex-col justify-center py-6">
      <header className="mb-5">
        <p className="text-[9px] font-bold tracking-[0.16em] text-primary uppercase">
          Keamanan akun
        </p>
        <h1 className="mt-1 text-[25px] font-bold tracking-tight">Ganti password sementara</h1>
        <p className="mt-2 text-[12px] leading-5 text-on-surface-variant">
          Buat password pribadi sebelum mengakses data operasional.
        </p>
      </header>
      <form onSubmit={submit} className="space-y-3">
        <FormSection
          title="Kredensial baru"
          helper="Password baru akan menggantikan password sementara."
        >
          <FormField label="Password sementara" required>
            <TextInput
              id="temporary-password-current"
              name="currentPassword"
              value={currentPassword}
              onChange={setCurrentPassword}
              type="password"
              autoComplete="current-password"
              placeholder="Masukkan password dari Owner"
              disabled={pending}
              required
            />
          </FormField>
          <FormField
            label="Password baru"
            helper="Minimal 12 karakter, huruf besar, huruf kecil, dan angka."
            required
          >
            <TextInput
              id="temporary-password-new"
              name="newPassword"
              value={newPassword}
              onChange={setNewPassword}
              type="password"
              autoComplete="new-password"
              placeholder="Buat password pribadi yang aman"
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
              className="min-h-12 w-full rounded-full bg-primary text-sm font-bold text-white disabled:opacity-50"
            >
              {pending ? "Menyimpan…" : "Simpan password baru"}
            </motion.button>
          </div>
        </FormSection>
      </form>
    </section>
  );
}
