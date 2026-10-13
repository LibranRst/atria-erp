"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { transitionSpringBouncy, transitionSpringSnappy } from "@/lib/utils/motion";
import * as React from "react";

/**
 * Bilah atas bersama untuk seluruh aplikasi.
 *
 * Sebelumnya ada dua: satu di shell dan satu lagi di halaman asisten AI. Secara
 * rancangan keduanya sama — kepingan putih bundar mengambang di atas isi yang
 * bergulir, dengan pil judul di tengah — tetapi ditulis dua kali dan meleset 4px
 * satu sama lain. Yang berbeda hanyalah cara penulisannya, jadi yang dibagi di
 * sini adalah geometri, penengahan, dan topeng; isi slotnya tetap milik
 * masing-masing perakit.
 */

/** Tinggi pita bilah. Kontrol 40px duduk di tengahnya, yakni y 8–48. */
export const TOP_BAR_BAND_PX = 56;

/**
 * Topeng menjorok melewati ujung pita. Kalau berhenti tepat di situ, baris teks
 * bertabrakan dengan kepingan mengambang pada opasitas penuh; jarak inilah yang
 * melarutkannya lebih dulu.
 */
export const TOP_BAR_FADE_PX = 24;

/**
 * Jarak aman isi halaman dari tepi atas — satu-satunya angka yang dipakai
 * halaman biasa maupun halaman AI.
 *
 * Nilainya sengaja jatuh di 80px, sama dengan `pt-20` yang sudah dipakai shell,
 * supaya penyatuan ini tidak menggeser setiap halaman aplikasi sebagai efek
 * samping. Dulu ada tiga angka untuk satu maksud: `pt-20` (80) di shell,
 * `TOP_INSET_PX` (72) di bilah AI, dan `STREAM_TOP_INSET_PX` (72) yang
 * dinyatakan ulang di hook gulir — lengkap dengan komentar yang menyebut
 * geometri yang sudah tidak berlaku.
 */
export const TOP_BAR_INSET_PX = TOP_BAR_BAND_PX + TOP_BAR_FADE_PX;

/**
 * Kolom tepi tidak pernah menyusut di bawah isinya, kolom tengah boleh menyusut
 * sampai nol.
 *
 * Kontrol adalah sasaran sentuh 48px dan tidak bisa ditawar, jadi ketika ruang
 * habis judullah satu-satunya yang boleh mengalah. `1fr` pada kedua tepi menjaga
 * keduanya selebar sama selagi ruang masih ada — itulah yang membuat pil tengah
 * benar-benar berada di tengah bilah, bukan sekadar di tengah sisa ruangnya.
 */
const GRID_TEMPLATE =
  "grid-cols-[minmax(max-content,1fr)_minmax(0,max-content)_minmax(max-content,1fr)]";

/**
 * Satu kontrol di dalam slot bilah, lengkap dengan koreografi datang-perginya.
 *
 * Setiap kontrol dibungkus ini dan **diberi `key` yang stabil**, karena itulah
 * yang membuat `AnimatePresence` bisa membedakan "tombol yang sama berpindah
 * tempat" dari "tombol lain menggantikannya".
 *
 * **Ref-nya wajib diteruskan.** `mode="popLayout"` mengambil simpul DOM anaknya
 * lewat `children.props.ref`, lalu mengukurnya di `getSnapshotBeforeUpdate`
 * untuk mengeluarkannya dari aliran. Komponen fungsi biasa yang mengabaikan
 * `ref` membuat bacaan itu `null`, pengukuran dilewati diam-diam, dan popLayout
 * tidak melakukan apa pun — kontrol yang pergi tetap memakan ruangnya sampai
 * benar-benar dilepas, dan tetangganya menunggu. Itulah jedanya.
 */
export const TopBarControl = React.forwardRef<
  HTMLDivElement,
  {
    readonly children: React.ReactNode;
    /**
     * Apakah kontrol ini ikut bergeser saat tetangganya datang atau pergi.
     *
     * Avatar mematikannya: ia satu-satunya penghuni slot kanan pada rute biasa,
     * jadi ia tidak pernah "berpindah tempat" — ia digantikan. Menggesernya
     * membuat pergantian terbaca seolah benda yang sama pindah, padahal bukan.
     */
    readonly reflow?: boolean;
  }
>(function TopBarControl({ children, reflow = true }, ref): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      /*
       * `layout="position"` dan bukan `layout`: yang pertama melarang skala, dan
       * skala pada pembungkus akan ikut meregangkan ikon di dalamnya. Semua
       * kontrol di bilah berukuran 40px tetap, jadi tidak ada ukuran yang perlu
       * dianimasikan — hanya tempatnya.
       */
      layout={reduceMotion || !reflow ? false : "position"}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
      // Pergeseran tempat memakai pegas yang lebih tegas daripada datang-perginya:
      // ia mengisi ruang yang baru saja kosong, dan itu harus terbaca segera.
      transition={
        reduceMotion
          ? { duration: 0 }
          : { ...transitionSpringBouncy, layout: transitionSpringSnappy }
      }
      /*
       * `flex`, bukan blok bawaan. Kontrolnya `inline-flex`, dan di dalam blok
       * ia membuat kotak baris — menambah 6px sisa turunan huruf di bawah tombol
       * 40px. popLayout mengukur pembungkus itu apa adanya, lalu memakunya
       * dengan `height: 46px` dan `top: 0`, sehingga kontrol yang pergi bergeser
       * ke atas selagi memudar.
       */
      className="flex"
    >
      {children}
    </motion.div>
  );
});

/**
 * Slot berisi kontrol yang datang dan pergi.
 *
 * `mode="popLayout"` yang menjadi kuncinya. Dengan mode bawaan, kontrol yang
 * sedang keluar **tetap memakan ruang flex** sampai animasi keluarnya selesai —
 * sehingga tetangganya diam di tempat, lalu melompat begitu simpulnya benar-benar
 * dilepas. Persis keluhan yang muncul saat tombol kembali menghilang: tombol
 * chat menunggu, lalu pindah tanpa animasi.
 *
 * `popLayout` mengeluarkan kontrol yang pergi dari aliran seketika, jadi
 * tetangganya mulai bergeser pada frame yang sama saat yang pergi mulai memudar.
 *
 * `initial={false}` menahan animasi masuk pada pemasangan pertama: bilah yang
 * baru dimuat tidak boleh terlihat merakit dirinya sendiri.
 *
 * `anchorX` harus menyebut tepi tempat slotnya dipaku. Saat sebuah kontrol
 * dikeluarkan dari aliran, popLayout memakunya dengan `left` atau `right` — dan
 * memilih yang salah membuatnya hanyut mengikuti tepi yang justru bergerak.
 * Slot kanan `justify-self-end`: tepi kanannya diam, tepi kirinya melebar ke
 * kiri saat isinya bertambah. Dipaku dengan `left` — bawaannya — avatar yang
 * sedang pergi ikut terseret ke kiri mengejar tombol yang baru datang.
 */
function TopBarSlot({
  children,
  className,
  anchorX,
}: {
  readonly children: React.ReactNode;
  readonly className: string;
  readonly anchorX: "left" | "right";
}): React.JSX.Element {
  return (
    <div className={`pointer-events-auto relative flex items-center gap-1.5 ${className}`}>
      <AnimatePresence initial={false} mode="popLayout" anchorX={anchorX}>
        {children}
      </AnimatePresence>
    </div>
  );
}

type AppTopBarProps = {
  readonly left: React.ReactNode;
  readonly center: React.ReactNode;
  readonly right: React.ReactNode;
  /**
   * Menaikkan bilah di atas seluruh isi halaman selagi menunya terbuka. Latar
   * gelap menu dirender di dalam bilah, jadi tanpa ini ia terkurung dalam
   * konteks penumpukan bilah dan tidak bisa menutupi apa pun di luarnya.
   */
  readonly elevated?: boolean;
};

export function AppTopBar({
  left,
  center,
  right,
  elevated = false,
}: AppTopBarProps): React.JSX.Element {
  return (
    <>
      <div
        aria-hidden="true"
        style={{ height: TOP_BAR_INSET_PX + TOP_BAR_FADE_PX }}
        className="scroll-edge-scrim pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto w-full max-w-md"
      />

      {/*
       * `layoutScroll` DAN `layoutRoot` — keduanya, karena bilahnya
       * `position: fixed`.
       *
       * Proyeksi Framer mencatat kotak anak dalam koordinat halaman, yaitu
       * termasuk `scrollY`. Untuk elemen fixed itu keliru: ia tidak ikut
       * bergulir. Ketika perpindahan rute mengembalikan gulir ke nol — dari
       * daftar proyek yang sudah digulir 2400px ke halaman detail — cuplikan
       * "sebelum" terekam 2408 sementara "sesudah" terukur 8, dan tombol chat
       * terbang dari dasar layar ke tempatnya.
       *
       * Diukur: puncak `top` 2408px sebelum, 8px sesudah, sementara geseran
       * mendatarnya (48 → 94px saat tombol kembali muncul) tetap utuh.
       *
       * `layoutRoot` saja TIDAK cukup — sudah dicoba dan tombolnya masih
       * terbang. `layoutScroll` yang membuat Framer membaca gulir bilah ini
       * sendiri, yang selalu nol, alih-alih mewarisi gulir halaman.
       */}
      <motion.header
        layoutScroll
        layoutRoot
        style={{ height: TOP_BAR_BAND_PX }}
        className={`pointer-events-none fixed inset-x-0 top-0 mx-auto grid w-full max-w-md items-center gap-2 px-margin-mobile select-none ${GRID_TEMPLATE} ${
          elevated ? "z-90" : "z-50"
        }`}
      >
        <TopBarSlot className="justify-self-start" anchorX="left">
          {left}
        </TopBarSlot>

        <div className="pointer-events-auto flex min-w-0 items-center justify-center">{center}</div>

        {/* Menempel ke tepi layar, bukan di tengah slotnya: tepi luar itulah yang
            membuat kontrol kiri dan kanan terbaca simetris. */}
        <TopBarSlot className="justify-self-end" anchorX="right">
          {right}
        </TopBarSlot>
      </motion.header>
    </>
  );
}
