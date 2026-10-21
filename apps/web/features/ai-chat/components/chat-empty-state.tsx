"use client";

import { getAiCapabilities } from "@/app/actions/ai/preferences";
import { useCurrentUserProfile, usePermissions } from "@/components/auth/permissions-provider";
import { AppIcon, Button, type AppIconName } from "@/components/ui";
import * as React from "react";

type Starter = {
  readonly tool: string;
  readonly icon: AppIconName;
  readonly title: string;
  readonly prompt: string;
};
const STARTERS: readonly Starter[] = [
  {
    tool: "proposeMaterialMaster",
    icon: "upload_file",
    title: "Impor Material Master",
    prompt:
      "Bantu saya menambahkan Material Master dari file atau gambar. Saya akan mengunggah sumbernya untuk ditinjau sebelum disimpan.",
  },
  {
    tool: "proposeCreateProject",
    icon: "folder_open",
    title: "Siapkan proyek",
    prompt: "Bantu saya buat proyek baru dengan budget awal mengikuti Pengaturan ERP.",
  },
  {
    tool: "proposeExpenseDraft",
    icon: "receipt_long",
    title: "Catat pengeluaran",
    prompt: "Bantu saya menyiapkan pengeluaran proyek untuk ditinjau.",
  },
  {
    tool: "getMaterialCatalog",
    icon: "inventory_2",
    title: "Cek material dan stok",
    prompt: "Tampilkan ringkasan Material Master dan ketersediaan stok yang bisa saya akses.",
  },
  {
    tool: "getBankBalances",
    icon: "account_balance",
    title: "Ringkasan kas",
    prompt: "Tampilkan ringkasan saldo rekening yang bisa saya akses.",
  },
];
export function ChatEmptyState({
  onSelect,
  disabled,
}: {
  readonly onSelect: (question: string) => void;
  readonly disabled: boolean;
}): React.JSX.Element {
  const user = useCurrentUserProfile();
  const permissions = usePermissions();
  const signature = permissions.join("|");
  const [available, setAvailable] = React.useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const [retry, setRetry] = React.useState(0);
  const [loadedFor, setLoadedFor] = React.useState("");
  const identity = `${user?.id ?? ""}:${signature}:${retry}`;
  React.useEffect(() => {
    let current = true;
    void getAiCapabilities()
      .then((result) => {
        if (!current) return;
        setLoadedFor(identity);
        setFailed(!result.success);
        if (result.success) setAvailable(new Set(result.data.map((item) => item.tool)));
        else setFailed(true);
        setLoading(false);
      })
      .catch(() => {
        if (current) {
          setLoadedFor(identity);
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, [identity]);
  return (
    <section className="space-y-5 py-8">
      <div className="space-y-2">
        <h2 className="text-section font-semibold text-on-surface">Mau cek atau siapkan apa?</h2>
        <p className="max-w-120 text-support leading-relaxed text-on-surface-variant">
          Tanyakan soal proyek, transaksi, atau material. Saran di bawah mengikuti akses Anda; data
          tetap ditinjau sebelum disimpan.
        </p>
      </div>
      {loading || loadedFor !== identity ? (
        <div role="status" aria-label="Memuat kemampuan asisten" className="flex flex-wrap gap-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-10 w-40 rounded-full bg-surface-container" />
          ))}
        </div>
      ) : failed ? (
        <div role="alert" className="flex items-center gap-3 text-support text-on-surface-variant">
          <span>Saran belum dimuat.</span>
          <Button variant="secondary" size="compact" onClick={() => setRetry((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {STARTERS.filter((item) => available.has(item.tool)).map((item) => (
            <Button
              key={item.tool}
              variant="secondary"
              size="compact"
              disabled={disabled}
              className="bg-surface-container-lowest! text-on-surface!"
              onClick={() => onSelect(item.prompt)}
            >
              <AppIcon name={item.icon} className="icon-sm" />
              {item.title}
            </Button>
          ))}
        </div>
      )}
      <Button
        variant="tertiary"
        size="compact"
        disabled={disabled}
        className="bg-transparent! text-on-surface-variant! shadow-none!"
        onClick={() => onSelect("Apa saja yang bisa Anda bantu sesuai akses saya?")}
      >
        Lihat kemampuan asisten
        <AppIcon name="arrow_forward" className="icon-sm" />
      </Button>
    </section>
  );
}
