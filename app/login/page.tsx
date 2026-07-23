"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui/icon/app-icon";

export default function LoginPage(): React.JSX.Element {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "").trim();
    const submittedPassword = String(formData.get("password") ?? "");

    setEmail(submittedEmail);
    setPassword(submittedPassword);

    if (!submittedEmail || !submittedPassword) {
      const message = "Email dan password wajib diisi.";
      setError(message);
      toast.error(message);
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
        const message = authError.message || "Email atau password salah.";
        setError(message);
        toast.error(message);
        setIsLoading(false);
      } else {
        toast.success("Login berhasil. Selamat datang kembali.");
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      console.error("Login unexpected error:", err);
      const message = "Terjadi kesalahan internal. Silakan coba lagi.";
      setError(message);
      toast.error(message);
      setIsLoading(false);
    }
  };

  return (
    <section className="flex min-h-[calc(100dvh-5rem)] flex-col justify-between px-1 py-6 select-none">
      {/* Top Branding Spacer */}
      <div className="flex flex-1 flex-col items-center justify-center pt-4 pb-8">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary text-white">
          <AppIcon name="account_balance" className="text-[32px] text-white" />
        </div>
        <div className="space-y-1.5 text-center">
          <p className="font-sans text-[8px] leading-4 font-bold tracking-wider text-primary uppercase">
            Atria Operating System
          </p>
          <h1 className="text-display font-sans text-[28px] leading-10 font-bold tracking-tight text-primary">
            Atria ERP
          </h1>
          <p className="max-w-70 font-sans text-[14px] leading-margin-mobile font-normal text-on-surface-variant">
            Kontrol budget proyek, pengeluaran, dan ketersediaan material dalam satu ruang kerja.
          </p>
        </div>
      </div>

      {/* Login Credentials Box */}
      <div className="shrink-0 space-y-md rounded-[28px] border border-outline-variant/20 bg-white p-md shadow-[0_12px_28px_rgba(17,17,17,0.035)]">
        <div className="space-y-xs border-b border-outline-variant/10 pb-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-[20px] leading-7 font-semibold text-on-surface">
              Kredensial Masuk
            </h2>
            <Badge status={isLoading ? "PENDING" : "DRAFT"}>{isLoading ? "PROSES" : "LOGIN"}</Badge>
          </div>
          <p className="font-sans text-[14px] leading-margin-mobile font-normal text-on-surface-variant">
            Masukkan alamat email terdaftar dan kata sandi Anda.
          </p>
        </div>

        <form method="post" onSubmit={handleLogin} className="space-y-md">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3.5 text-xs font-medium text-error">
              <AppIcon name="error" className="text-[18px] text-error" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <div className="space-y-base">
            <label
              htmlFor="email-input"
              className="flex items-center gap-1 font-sans text-[8px] leading-4 font-bold tracking-wider text-on-surface-variant uppercase"
            >
              <AppIcon name="mail" className="text-[14px] text-on-surface-variant" />
              <span>Alamat Email</span>
            </label>
            <input
              id="email-input"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              placeholder="nama@dekoria.com"
              autoComplete="email"
              inputMode="email"
              required
              className="min-h-12 w-full rounded-full border border-outline-variant bg-surface-container-low px-5 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-50"
            />
          </div>

          <div className="space-y-base">
            <label
              htmlFor="password-input"
              className="flex items-center gap-1 font-sans text-[8px] leading-4 font-bold tracking-wider text-on-surface-variant uppercase"
            >
              <AppIcon name="lock" className="text-[14px] text-on-surface-variant" />
              <span>Kata Sandi</span>
            </label>
            <input
              id="password-input"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="min-h-12 w-full rounded-full border border-outline-variant bg-surface-container-low px-5 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-50"
            />
          </div>

          <motion.button
            type="submit"
            disabled={isLoading}
            whileTap={isLoading ? undefined : { scale: 0.97 }}
            transition={transitionSpringSnappy}
            className="mt-2 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full bg-primary text-sm font-bold text-white disabled:opacity-50"
          >
            {isLoading ? "Memverifikasi…" : "Masuk Sistem"}
          </motion.button>
        </form>
      </div>

      {/* Footer Branding */}
      <div className="shrink-0 space-y-0.5 pt-6 text-center text-[9px] font-medium text-on-surface-variant select-none">
        <p>Atria ERP · Project Finance & Material Control</p>
        <p>© 2026 PT Dekoria Desain Estetika. All rights reserved.</p>
      </div>
    </section>
  );
}
