"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { AppIcon, Button, FormField, FormSection, TextInput } from "@/components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage(): React.JSX.Element {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function updateEmail(value: string): void {
    setEmail(value);
    setError(null);
  }

  function updatePassword(value: string): void {
    setPassword(value);
    setError(null);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "").trim();
    const submittedPassword = String(formData.get("password") ?? "");

    setEmail(submittedEmail);
    setPassword(submittedPassword);

    if (!submittedEmail || !submittedPassword) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }

    if (!EMAIL_PATTERN.test(submittedEmail)) {
      setError("Format email belum benar.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: authError } = await authClient.signIn.email({
        email: submittedEmail,
        password: submittedPassword,
      });

      if (authError) {
        setError("Email atau kata sandi belum sesuai.");
        setIsLoading(false);
        return;
      }

      toast.success("Berhasil masuk.");
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      console.error("Login unexpected error:", err);
      setError("Atria belum dapat memverifikasi akun. Coba lagi.");
      setIsLoading(false);
    }
  }

  return (
    <section className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <div className="flex flex-1 items-center py-8">
        <div className="w-full space-y-2">
          <header>
            <h1 className="text-center text-[28px] leading-9 font-extrabold tracking-[-0.035em] text-on-surface">
              Atria
            </h1>
          </header>

          <form method="post" noValidate aria-busy={isLoading} onSubmit={handleLogin}>
            <FormSection>
              <FormField label="Email" htmlFor="email-input" required>
                <TextInput
                  id="email-input"
                  name="email"
                  type="email"
                  value={email}
                  onChange={updateEmail}
                  disabled={isLoading}
                  placeholder="nama@dekoria.com"
                  autoComplete="email"
                  inputMode="email"
                  autoFocus
                  required
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={Boolean(error)}
                />
              </FormField>

              <FormField label="Kata sandi" htmlFor="password-input" required>
                <TextInput
                  id="password-input"
                  name="password"
                  type="password"
                  value={password}
                  onChange={updatePassword}
                  disabled={isLoading}
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  required
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={Boolean(error)}
                />
              </FormField>
            </FormSection>

            <div className="min-h-5 px-1" aria-live="polite">
              {error ? (
                <p
                  id="login-error"
                  role="alert"
                  className="flex items-start gap-2 text-[11px] leading-5 font-semibold text-error"
                >
                  <AppIcon name="error" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </p>
              ) : null}
            </div>

            <Button type="submit" fullWidth pending={isLoading} pendingLabel="Memverifikasi…">
              Masuk
            </Button>
          </form>
        </div>
      </div>

      <p className="shrink-0 pb-1 text-center text-[9px] font-semibold tracking-[0.04em] text-on-surface-variant/70">
        Atria · Project Finance &amp; Material Control
      </p>
    </section>
  );
}
