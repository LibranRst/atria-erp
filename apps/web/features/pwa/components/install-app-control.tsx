"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button, DuotoneIconTile, GroupedSurface, StatusBadge } from "@/components/ui";
import {
  promptInstall,
  readInstallEnvironment,
  resolveInstallSurface,
  watchInstallPrompt,
  watchStandaloneChange,
  type InstallEnvironment,
  type InstallSurfaceState,
} from "@/lib/pwa/install";

type SurfaceCopy = {
  readonly badgeTone: "healthy" | "neutral" | "pending";
  readonly badgeLabel: string;
  readonly title: string;
  readonly description: string;
};

const SURFACE_COPY: Record<Exclude<InstallSurfaceState, "unavailable">, SurfaceCopy> = {
  installed: {
    badgeTone: "healthy",
    badgeLabel: "Terpasang",
    title: "Aplikasi",
    description: "Atria terpasang di perangkat ini dan dibuka penuh layar tanpa bilah peramban.",
  },
  prompt: {
    badgeTone: "neutral",
    badgeLabel: "Tersedia",
    title: "Aplikasi",
    description:
      "Pasang Atria ke Layar Utama agar terbuka penuh layar dan dapat menerima notifikasi.",
  },
  "ios-steps": {
    badgeTone: "pending",
    badgeLabel: "Belum dipasang",
    title: "Aplikasi",
    description:
      "iOS hanya mengizinkan notifikasi setelah Atria dipasang. Di Safari, ketuk Bagikan lalu pilih Tambahkan ke Layar Utama.",
  },
  "browser-menu": {
    badgeTone: "pending",
    badgeLabel: "Belum dipasang",
    title: "Aplikasi",
    description:
      "Pasang Atria lewat menu peramban ini — pilih “Pasang aplikasi” atau “Tambahkan ke Layar Utama”.",
  },
};

/**
 * Permukaan pemasangan aplikasi.
 *
 * Ini prasyarat push di iOS — Safari tidak pernah mengekspos `PushManager`
 * sebelum aplikasi dipasang — jadi bentuknya mengikuti baris `WebPushControl`
 * tepat di atasnya: satu permukaan grouped, kepingan ikon, judul, badge status,
 * dan satu tombol mini.
 *
 * Keputusan tampilannya datang dari `resolveInstallSurface` yang murni dan
 * teruji; komponen ini hanya membaca lingkungan peramban dan merendernya.
 */
export function InstallAppControl({
  embedded = false,
}: {
  readonly embedded?: boolean;
} = {}): React.JSX.Element | null {
  const [environment, setEnvironment] = React.useState<InstallEnvironment | null>(null);
  const [pending, startTransition] = React.useTransition();
  const canPromptInstall = React.useRef(false);

  React.useEffect(() => {
    const refresh = (): void => setEnvironment(readInstallEnvironment(canPromptInstall.current));
    refresh();
    const stopPromptWatch = watchInstallPrompt((next) => {
      canPromptInstall.current = next;
      refresh();
    });
    const stopStandaloneWatch = watchStandaloneChange(refresh);
    return () => {
      stopPromptWatch();
      stopStandaloneWatch();
    };
  }, []);

  function install(): void {
    startTransition(async () => {
      const outcome = await promptInstall();
      if (outcome === "accepted") {
        toast.success("Atria dipasang di perangkat ini.");
        return;
      }
      if (outcome === "dismissed") {
        toast("Pemasangan dibatalkan.");
        return;
      }
      toast.error("Peramban ini tidak menyediakan pemasangan otomatis.");
    });
  }

  /*
   * Lingkungan dibaca setelah mount, bukan saat render server: keputusannya
   * bergantung pada peramban pengguna, dan merendernya di server hanya akan
   * menghasilkan markup yang salah.
   */
  if (!environment) return null;
  const state = resolveInstallSurface(environment);
  if (state === "unavailable") return null;
  const copy = SURFACE_COPY[state];

  const content = (
    <>
      <DuotoneIconTile name="smartphone" tone="primary" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-support font-bold text-on-surface">{copy.title}</p>
          <StatusBadge tone={copy.badgeTone} label={copy.badgeLabel} />
        </div>
        <p className="mt-0.5 text-meta leading-4 text-on-surface-variant">{copy.description}</p>
      </div>
      {state === "prompt" ? (
        <Button size="mini" pending={pending} onClick={install}>
          Pasang aplikasi
        </Button>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="flex min-h-16 items-center gap-3 px-3.5 py-3">{content}</div>;
  }

  return <GroupedSurface className="flex items-center gap-3 p-4">{content}</GroupedSurface>;
}
