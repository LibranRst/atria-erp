"use client";

import type { TopBarSlots } from "@/components/layout/top-bar-slots";
import { TopBarControl } from "@/components/layout/app-top-bar";
import { AppIcon, IconButton } from "@/components/ui";
import * as React from "react";

/**
 * Isi slot bilah atas untuk layar asisten AI.
 *
 * Bukan sebuah bilah. Halaman ini dulu merender bilahnya sendiri, dan itu berarti
 * berpindah ke sini membongkar bilah shell lalu memasang bilah lain — tidak ada
 * instance yang bertahan, sehingga lebar pil judul patah alih-alih bermorf.
 * Sekarang bilahnya satu untuk seluruh aplikasi, dan halaman ini hanya menitipkan
 * kontrolnya.
 *
 * Tetap sebuah fungsi murni supaya bisa diuji sendiri: `AiChatView` bergantung
 * pada `useChat` dan `useRouter`, yang keduanya butuh konteks runtime dan
 * membuat isinya mustahil dipagari tanpa tiruan berlapis.
 */

type AiChatSlotOptions = {
  readonly showPicker: boolean;
  readonly isBusy: boolean;
  /** Satu tingkat ke atas: riwayat → percakapan → keluar rute. */
  readonly onBack: () => void;
  readonly onNewConversation: () => void;
  readonly onOpenPicker: () => void;
};

export function aiChatTopBarSlots({
  showPicker,
  isBusy,
  onBack,
  onNewConversation,
  onOpenPicker,
}: AiChatSlotOptions): TopBarSlots {
  return {
    /**
     * Judulnya berganti mengikuti keadaan di dalam halaman, bukan mengikuti
     * rute — satu-satunya bilah di aplikasi yang begitu, dan alasan `title`
     * bisa dititipkan sama sekali.
     */
    title: showPicker ? "Riwayat Percakapan" : "Asisten AI",

    /*
     * `key` tetap "back" walau ikonnya berganti: tombolnya benda yang sama yang
     * berganti arti, bukan tombol lain yang menggantikannya. `key` yang berubah
     * akan membuatnya keluar-lalu-masuk padahal ia tidak ke mana-mana.
     */
    left: [
      <TopBarControl key="back">
        <IconButton
          label={showPicker ? "Tutup riwayat" : "Kembali"}
          size="compact"
          // Dulu tombol silang di sisi kanan melakukan hal yang persis sama saat
          // riwayat terbuka; dua kontrol untuk satu perilaku hanya membuat
          // pengguna menebak apakah keduanya berbeda.
          onClick={onBack}
          icon={<AppIcon name={showPicker ? "close" : "chevron_left"} className="icon-md" />}
        />
      </TopBarControl>,
    ],

    // Tanpa avatar: tiga kontrol 40px di sisi kanan memaksa judul terpotong di
    // 320px, dan menu di pil tengah sudah memuat Profil Saya.
    //
    // Larik kosong, bukan `null`, saat riwayat terbuka: `null` akan jatuh ke
    // slot bawaan lewat `??` dan avatar justru muncul di halaman AI.
    right: showPicker
      ? []
      : [
          <TopBarControl key="new-conversation">
            <IconButton
              label="Percakapan baru"
              size="compact"
              disabled={isBusy}
              onClick={onNewConversation}
              icon={<AppIcon name="add" className="icon-md" />}
            />
          </TopBarControl>,
          <TopBarControl key="history">
            <IconButton
              label="Daftar riwayat"
              size="compact"
              onClick={onOpenPicker}
              icon={<AppIcon name="history" className="icon-md" />}
            />
          </TopBarControl>,
        ],
  };
}
