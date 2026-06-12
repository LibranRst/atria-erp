"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";

export default function LoginPage(): React.JSX.Element {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await authClient.signIn.email({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || "Email atau password salah.");
        setIsLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      console.error("Login unexpected error:", err);
      setError("Terjadi kesalahan internal. Silakan coba lagi.");
      setIsLoading(false);
    }
  };

  return (
    <section className="flex min-h-[calc(100dvh-5rem)] flex-col justify-between py-6 px-1 select-none">
      {/* Top Branding Spacer */}
      <div className="flex-1 flex flex-col justify-center items-center pb-8 pt-4">
        <div className="h-16 w-16 rounded-[22px] bg-primary flex items-center justify-center text-white shadow-xl border border-white/10 mb-5 animate-pulse">
          <span className="material-symbols-outlined text-white text-[32px]">account_balance</span>
        </div>
        <div className="text-center space-y-1.5">
          <p className="font-label-caps text-primary">Atria Operating System</p>
          <h1 className="font-display text-display text-primary text-[28px] tracking-tight">Atria ERP</h1>
          <p className="font-body-sm text-on-surface-variant max-w-[280px]">
            Masuk untuk mengakses control room keuangan proyek & ledger buku kas lapangan.
          </p>
        </div>
      </div>

      {/* Login Credentials Box */}
      <div className="premium-card p-md border border-outline-variant/30 space-y-md shrink-0">
        <div className="pb-sm border-b border-outline-variant/10 space-y-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-on-surface">Kredensial Masuk</h2>
            <Badge status={isLoading ? "PENDING" : "DRAFT"}>
              {isLoading ? "PROSES" : "LOGIN"}
            </Badge>
          </div>
          <p className="font-body-sm text-on-surface-variant">
            Masukkan alamat email terdaftar dan kata sandi Anda.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-md">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3.5 text-xs text-error font-medium">
              <span className="material-symbols-outlined text-error text-[18px]">error</span>
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <div className="space-y-base">
            <label
              htmlFor="email-input"
              className="font-label-caps text-[10px] text-on-surface-variant flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[14px]">mail</span>
              <span>Alamat Email</span>
            </label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              placeholder="nama@dekoria.com"
              required
              className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-50"
            />
          </div>

          <div className="space-y-base">
            <label
              htmlFor="password-input"
              className="font-label-caps text-[10px] text-on-surface-variant flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[14px]">lock</span>
              <span>Kata Sandi</span>
            </label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="••••••••"
              required
              className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 mt-2 cursor-pointer"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Memverifikasi...</span>
              </div>
            ) : (
              "Masuk Sistem"
            )}
          </button>
        </form>
      </div>

      {/* Footer Branding */}
      <div className="text-center text-[9px] text-on-surface-variant space-y-0.5 pt-6 select-none shrink-0 font-medium">
        <p>Atria ERP Enterprise Financial Core • v1.0.0</p>
        <p>© 2026 PT Dekoria Desain Estetika. All rights reserved.</p>
      </div>
    </section>
  );
}
