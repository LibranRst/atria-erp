"use client";

import { Button, Link } from "@heroui/react";

export default function ErrorPage({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <div role="alert" className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-xl font-semibold">Halaman belum bisa dimuat</h1>
      <p className="text-sm leading-6 text-muted">
        Periksa koneksi lalu coba lagi. Jika masalah berlanjut, hubungi administrator Atria.
      </p>
      <div className="flex items-center gap-4">
        <Button size="sm" onPress={reset}>
          Coba lagi
        </Button>
        <Link href="/projects" className="text-sm">
          Kembali ke proyek
        </Link>
      </div>
    </div>
  );
}
