"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Loader2, AlertCircle, Lock, Mail } from "lucide-react";

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
    <section className="flex min-h-[calc(100dvh-3rem)] flex-col justify-center py-6">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="text-center space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Atria ERP
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Masuk ke Control Room
          </h1>
          <p className="text-xs text-secondary font-medium">
            Gunakan kredensial akun untuk mengelola keuangan proyek
          </p>
        </div>

        <Card className="rounded-3xl p-2 shadow-[0_16px_40px_rgba(0,0,0,0.22)] border-border bg-surface">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Kredensial Masuk</CardTitle>
            <CardDescription className="text-xs">
              Masukkan alamat email dan kata sandi Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-critical/30 bg-critical-light/15 p-3 text-xs text-critical font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 text-critical" />
                  <div>{error}</div>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email-input"
                  className="text-xs font-semibold uppercase tracking-wider text-secondary flex items-center gap-1.5"
                >
                  <Mail className="h-3 w-3" /> Email Address
                </label>
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  placeholder="name@dekoria.com"
                  required
                  className="h-12 w-full rounded-xl border border-border bg-elevated px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password-input"
                  className="text-xs font-semibold uppercase tracking-wider text-secondary flex items-center gap-1.5"
                >
                  <Lock className="h-3 w-3" /> Password
                </label>
                <input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="••••••••"
                  required
                  className="h-12 w-full rounded-xl border border-border bg-elevated px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-text-primary shadow-lg transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 mt-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memproses Masuk...
                  </>
                ) : (
                  "Masuk Sistem"
                )}
              </button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-[10px] text-muted space-y-1">
          <p>Atria ERP v1.0.0 • Interior Contractor Finance System</p>
          <p>© 2026 PT Dekoria Desain Estetika. All rights reserved.</p>
        </div>
      </div>
    </section>
  );
}
