"use client";

import { AppIcon, Button } from "@/components/ui";
import { transitionSpringSnappy, buttonTapActiveScale } from "@/lib/utils/motion";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

/**
 * Daftar percakapan tersimpan.
 *
 * Muncul menggantikan aliran pesan, bukan sebagai lapisan mengambang di atasnya —
 * sheet chat sudah menjadi permukaan mengambang, dan menumpuk overlay kedua di
 * atasnya akan melanggar hierarki z-index yang berlaku di aplikasi.
 */

export type ConversationSummary = {
  readonly id: string;
  readonly title: string | null;
  readonly updatedAt: string;
};

type ConversationPickerProps = {
  readonly conversations: readonly ConversationSummary[];
  readonly activeId: string | null;
  readonly loading: boolean;
  readonly onSelect: (conversationId: string) => void;
  readonly onDelete: (conversationId: string) => void;
};

export function ConversationPicker({
  conversations,
  activeId,
  loading,
  onSelect,
  onDelete,
}: ConversationPickerProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Memuat daftar percakapan">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-14 rounded-inset bg-surface-container" aria-hidden="true" />
        ))}
        <span className="sr-only">Daftar percakapan sedang disiapkan.</span>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="text-support font-semibold text-on-surface-variant">
        Belum ada percakapan tersimpan.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-black/5.5 overflow-hidden rounded-owner bg-white shadow-surface ring-1 ring-ring-subtle">
      {conversations.map((conversation) => {
        const isActive = conversation.id === activeId;
        const isPendingDelete = conversation.id === pendingDeleteId;

        return (
          <li key={conversation.id}>
            {isPendingDelete ? (
              <div className="space-y-2.5 px-3.5 py-3">
                <p className="text-support font-semibold text-on-surface">
                  Hapus percakapan ini? Pengeluaran yang sudah tercatat tidak ikut terhapus.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="critical"
                    className="flex-1"
                    onClick={() => {
                      setPendingDeleteId(null);
                      onDelete(conversation.id);
                    }}
                  >
                    Hapus
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setPendingDeleteId(null)}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1 pr-2">
                <motion.button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  whileTap={reduceMotion ? undefined : { scale: buttonTapActiveScale }}
                  transition={transitionSpringSnappy}
                  className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
                  aria-current={isActive ? "true" : undefined}
                >
                  <AppIcon
                    name={isActive ? "check_circle" : "sparkle"}
                    aria-hidden="true"
                    className={`icon-sm shrink-0 ${isActive ? "text-on-surface" : "text-on-surface-variant"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-row font-semibold text-on-surface">
                      {conversation.title ?? "Percakapan baru"}
                    </span>
                    <span className="block text-meta font-semibold text-on-surface-variant">
                      {formatUpdatedAt(conversation.updatedAt)}
                      {isActive ? " · sedang dibuka" : ""}
                    </span>
                  </span>
                </motion.button>
                {/* Ikon telanjang, bukan kapsul: baris ini sudah berada di dalam
                    permukaan grouped, dan kontrol berkapsul di dalamnya akan
                    menumpuk lift di atas lift. Target sentuhnya tetap 48px lewat
                    pseudo-element, walaupun ikonnya digambar lebih kecil. */}
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(conversation.id)}
                  aria-label={`Hapus percakapan ${conversation.title ?? "baru"}`}
                  className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors duration-200 after:absolute after:-inset-1.5 after:content-[''] hover:text-critical focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none active:z-10 active:scale-[1.05] active:shadow-raised"
                >
                  <AppIcon name="delete" aria-hidden="true" className="icon-sm" />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Waktu ditulis relatif untuk rentang pendek karena itu yang menjawab
 * "yang mana yang barusan", lalu beralih ke tanggal untuk yang lebih lama.
 */
export function formatUpdatedAt(isoDate: string, now: Date = new Date()): string {
  const updated = new Date(isoDate);
  const minutes = Math.floor((now.getTime() - updated.getTime()) / 60_000);

  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Kemarin";
  if (days < 7) return `${days} hari lalu`;

  return updated.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
