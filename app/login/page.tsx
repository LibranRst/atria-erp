"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { transitionSpringSnappy } from "@/lib/utils/motion";

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
    <section className="flex min-h-[calc(100dvh-5rem)] flex-col justify-between py-6 px-1 select-none">
      {/* Top Branding Spacer */}
      <div className="flex-1 flex flex-col justify-center items-center pb-8 pt-4">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary text-white">
          <span className="material-symbols-outlined text-white text-[32px]">account_balance</span>
        </div>
        <div className="text-center space-y-1.5">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">Atria Operating System</p>
          <h1 className="font-sans text-[32px] leading-[40px] tracking-tight font-bold text-display text-primary text-[28px] tracking-tight">Atria ERP</h1>
          <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant max-w-[280px]">
            Kontrol budget proyek, pengeluaran, dan ketersediaan material dalam satu ruang kerja.
          </p>
        </div>
      </div>

      {/* Login Credentials Box */}
      <div className="shrink-0 space-y-md rounded-[28px] border border-outline-variant/20 bg-white p-md shadow-[0_12px_28px_rgba(17,17,17,0.035)]">
        <div className="pb-sm border-b border-outline-variant/10 space-y-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-[20px] leading-[28px] font-semibold text-on-surface">Kredensial Masuk</h2>
            <Badge status={isLoading ? "PENDING" : "DRAFT"}>
              {isLoading ? "PROSES" : "LOGIN"}
            </Badge>
          </div>
          <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">
            Masukkan alamat email terdaftar dan kata sandi Anda.
          </p>
        </div>

        <form method="post" onSubmit={handleLogin} className="space-y-md">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3.5 text-xs text-error font-medium">
              <span className="material-symbols-outlined text-error text-[18px]">error</span>
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <div className="space-y-base">
            <label
              htmlFor="email-input"
              className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[14px]">mail</span>
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
              className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[14px]">lock</span>
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
      <div className="text-center text-[9px] text-on-surface-variant space-y-0.5 pt-6 select-none shrink-0 font-medium">
        <p>Atria ERP · Project Finance & Material Control</p>
        <p>© 2026 PT Dekoria Desain Estetika. All rights reserved.</p>
      </div>
    </section>
  );
}
