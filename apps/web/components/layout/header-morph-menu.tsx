"use client";

import Link from "@/lib/navigation/workspace-link";
import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AppIcon } from "@/components/ui";
import {
  buttonTapActiveScale,
  transitionEaseSmooth,
  transitionSpringBouncy,
  transitionSpringSmooth,
  transitionSpringSnappy,
} from "@/lib/utils/motion";
import type { HeaderMenuItem } from "./header-menu-config";

type HeaderMorphMenuProps = {
  readonly isOpen: boolean;
  readonly items: readonly HeaderMenuItem[];
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
  readonly title: string;
  readonly onToggle: () => void;
  readonly onClose: () => void;
};

/** Tinggi pil tertutup, sama dengan kontrol lain di bilah. */
const PILL_HEIGHT_PX = 40;

/**
 * Lebar panel terbuka adalah nilai rancangan, bukan turunan — mengukurnya hanya
 * akan menurunkan ulang sebuah keputusan. Tingginya sebaliknya: ia mengikuti isi,
 * jadi ia diukur.
 */
const PANEL_OPEN_WIDTH_PX = 292;

/** `p-3` pada daftar. */
const PANEL_PADDING_PX = 12;
/** `px-5` pada tiap baris menu, dan pada pil tertutup. */
const ROW_PADDING_X_PX = 20;

export function HeaderMorphMenu({
  isOpen,
  items,
  pathname,
  searchParams,
  title,
  onToggle,
  onClose,
}: HeaderMorphMenuProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const sizerRef = React.useRef<HTMLSpanElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  const [closedWidth, setClosedWidth] = React.useState<number | null>(null);
  const [openHeight, setOpenHeight] = React.useState<number | null>(null);
  const [activeRowTop, setActiveRowTop] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  /**
   * `activeIndex` boleh -1.
   *
   * Sebelumnya nilainya dijepit `Math.max(…, 0)`, dan karena setiap rute yang
   * dirender shell kebetulan cocok dengan salah satu butir, cadangan itu tidak
   * pernah berjalan. Begitu ada rute yang tidak cocok, ia menyorot butir pertama
   * — mengaku tahu halaman mana yang sedang dibuka padahal tidak.
   */
  const activeIndex = items.findIndex((item) => item.match(pathname, searchParams));

  /**
   * Lebar pil **diukur**, tidak ditebak.
   *
   * Rumus lamanya `clamp(title.length * 8 + 56, 124, 220)` salah dua kali
   * sekaligus: 8px/karakter melebihi lebar sebenarnya pada 14px semibold, dan
   * lantai 124px menimpa hasilnya untuk setiap judul pendek. "Proyek" digambar
   * ~82px lalu dipaksa jadi 124px — 42px ruang kosong yang tidak pernah diminta
   * siapa pun.
   *
   * Yang diukur adalah salinan tak terlihat dari isi pil, lengkap dengan
   * paddingnya, dengan tipografi yang persis sama. Salinan itu juga yang
   * memberi wadahnya lebar yang benar pada cat pertama, sebelum pengukuran
   * mendarat dan tidak ada apa pun untuk dianimasikan.
   */
  React.useLayoutEffect(() => {
    const sizer = sizerRef.current;
    const wrapper = wrapperRef.current;
    if (!sizer || !wrapper) return undefined;

    /**
     * Diukur dengan melepas lebar wadah sejenak, bukan dengan membaca pengukur
     * lalu menjepitnya sendiri.
     *
     * Wadahnya sudah `max-w-full` di dalam kolom grid yang boleh menyusut, jadi
     * `max-content` di situ **sudah** berarti "selebar judulnya, atau selebar
     * ruang yang tersisa — mana yang lebih kecil". Satu bacaan memberi angka
     * yang sudah terjepit, dan tidak ada aritmetika lebar slot yang perlu
     * ditebak ulang di sini.
     */
    function measure(element: HTMLDivElement): void {
      const previous = element.style.width;
      element.style.width = "max-content";
      const width = Math.ceil(element.getBoundingClientRect().width);
      element.style.width = previous;
      setClosedWidth(width);
    }

    const remeasure = (): void => measure(wrapper);
    remeasure();

    // Pengukur ikut berubah saat font selesai dimuat; lebar yang tersisa ikut
    // berubah saat viewport berubah. Pengukur yang diamati, bukan wadahnya —
    // mengamati wadah berarti mengamati elemen yang diubah sendiri oleh
    // pengukuran ini.
    const observer = new ResizeObserver(remeasure);
    observer.observe(sizer);
    window.addEventListener("resize", remeasure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", remeasure);
    };
  }, [title]);

  /**
   * Tinggi panel dan posisi baris aktif dibaca dari daftar yang sudah terpasang.
   * Rumus lamanya, `24 + items.length * 48 + (items.length - 1) * 4`, mengunci
   * tinggi baris dan jarak antar baris sebagai angka — benar hari ini, dan salah
   * pada hari pertama sebuah label membungkus ke baris kedua.
   */
  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;

    function measure(element: HTMLDivElement): void {
      setOpenHeight(Math.ceil(element.getBoundingClientRect().height) + PANEL_PADDING_PX * 2);

      const row = activeIndex < 0 ? null : element.children[activeIndex];
      setActiveRowTop(row instanceof HTMLElement ? row.offsetTop + row.offsetHeight / 2 : null);
    }

    measure(list);
    const observer = new ResizeObserver(() => measure(list));
    observer.observe(list);

    return () => observer.disconnect();
  }, [items, activeIndex]);

  /**
   * Ke mana judul melayang saat menu terbuka: tepat menimpa label baris aktif,
   * supaya perpindahannya terbaca sebagai satu benda yang sama berpindah tempat.
   * Tanpa baris aktif — rute yang memang bukan salah satu tujuan menu — ia
   * memudar di tempat, tidak berpura-pura menuju baris mana pun.
   */
  const hasActiveRow = activeIndex >= 0 && activeRowTop !== null;
  const activeTitleY = hasActiveRow ? PANEL_PADDING_PX + activeRowTop - PILL_HEIGHT_PX / 2 : 0;
  const activeTitleX =
    hasActiveRow && closedWidth !== null
      ? PANEL_PADDING_PX +
        ROW_PADDING_X_PX +
        (closedWidth - ROW_PADDING_X_PX * 2) / 2 -
        PANEL_OPEN_WIDTH_PX / 2
      : 0;

  const openTransition = reduceMotion ? { duration: 0 } : transitionSpringBouncy;
  const closeTransition = reduceMotion ? { duration: 0 } : transitionSpringSmooth;
  const morphTransition = isOpen ? openTransition : closeTransition;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.button
            type="button"
            aria-label="Close navigation menu"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : transitionEaseSmooth}
            className="fixed inset-0 z-70 cursor-pointer bg-black/20 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      {/*
       * Wadah ini yang memberi kolom tengah lebarnya, jadi ia harus ikut
       * beranimasi: kalau lebarnya melompat sementara pilnya meluncur, titik
       * tengah tempat pil bertumpu ikut melompat dan pilnya tersentak.
       */}
      <motion.div
        ref={wrapperRef}
        initial={false}
        // Selagi pengukuran belum mendarat, lebarnya diserahkan pada CSS `w-max`
        // — bukan pada nilai animasi. Menuliskan `width: "max-content"` sebagai
        // target animasi membuat Framer memasang gaya inline yang mengalahkan
        // kelasnya, dan pada cat pertama nilainya belum bisa diselesaikan.
        animate={closedWidth === null ? undefined : { width: closedWidth }}
        transition={closeTransition}
        style={{ height: PILL_HEIGHT_PX }}
        className="pointer-events-none relative z-80 w-max max-w-full"
      >
        {/*
         * Salinan tak terlihat yang menjadi sumber ukuran, dan **tetap dalam
         * aliran**.
         *
         * Sempat dibuat `absolute` demi kemurnian pengukuran, dan itu keliru:
         * pil serta tombolnya juga `absolute`, sehingga wadah ini kehilangan
         * seluruh isi yang mengalir dan `max-content`-nya menjadi nol. Setiap
         * kali halaman dimuat, pil mulai selebar nol lalu memanjang setelah
         * pengukuran mendarat — dan selama jendela itu ketiga kolom bilah ikut
         * salah ukuran.
         *
         * `visibility: hidden` dan bukan `display: none` supaya ia tetap
         * dilayout dan bisa diukur; `w-max` + `whitespace-nowrap` supaya lebar
         * wadah yang sedang dianimasikan tidak menggencetnya balik dan
         * mencemari hasilnya.
         */}
        <span
          ref={sizerRef}
          aria-hidden="true"
          className="pointer-events-none invisible block w-max px-5 text-sm font-semibold tracking-tight whitespace-nowrap"
        >
          {title}
        </span>

        <motion.div
          initial={false}
          whileTap={
            !isOpen
              ? {
                  scale: reduceMotion ? 1 : buttonTapActiveScale,
                  transition: transitionSpringSnappy,
                }
              : undefined
          }
          animate={{
            scale: 1,
            // `100%` dan bukan `max-content` sebagai cadangan: panel ini
            // `absolute`, dan satu-satunya isi mengalirnya adalah daftar menu —
            // `max-content` di sini berarti selebar baris menu terpanjang, bukan
            // selebar judul. Persentasenya diselesaikan terhadap wadah yang
            // sudah berukuran benar sejak cat pertama.
            width: isOpen ? PANEL_OPEN_WIDTH_PX : (closedWidth ?? "100%"),
            height: isOpen ? (openHeight ?? "auto") : PILL_HEIGHT_PX,
            borderRadius: isOpen ? 28 : 20,
          }}
          transition={morphTransition}
          className={`pointer-events-auto absolute top-0 left-1/2 max-h-[calc(100dvh-5.5rem)] overflow-hidden bg-white ring-1 ring-ring-subtle active:z-10 ${isOpen ? "shadow-raised" : "shadow-control active:shadow-raised"}`}
          /*
           * `maxWidth` tetap, tidak berganti mengikuti keadaan.
           *
           * Sebelumnya ia melompat ke `100%` begitu menu ditutup, dan karena
           * `style` tidak dianimasikan, panel terjepit dari 292px ke lebar judul
           * baru dalam satu frame — tingginya bermorf, lebarnya patah. Penjepitan
           * sekarang sudah termasuk di dalam `closedWidth` yang diukur, jadi
           * tidak ada yang perlu dijepit lagi di sini.
           */
          style={{ x: "-50%", maxWidth: "calc(100vw - 2rem)" }}
        >
          <motion.button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            tabIndex={isOpen ? -1 : 0}
            onClick={onToggle}
            initial={false}
            animate={{
              opacity: isOpen ? 0 : 1,
              scale: isOpen ? 0.96 : 1,
              x: isOpen ? activeTitleX : 0,
              y: isOpen ? activeTitleY : 0,
            }}
            transition={morphTransition}
            className={`absolute inset-x-0 top-0 flex h-10 w-full cursor-pointer items-center justify-center px-5 text-center text-sm font-semibold tracking-tight text-on-surface will-change-[opacity,transform] outline-none after:absolute after:-inset-y-1 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring ${
              isOpen ? "pointer-events-none" : "pointer-events-auto"
            }`}
          >
            {/*
             * Judul lama dan baru disilang-pudarkan, tidak ditukar seketika.
             *
             * Pertukaran seketika menaruh teks baru di dalam pil yang lebarnya
             * masih dalam perjalanan, sehingga judul panjang terpotong lalu
             * "terketik" keluar mengikuti pilnya — persis efek mesin tik yang
             * tidak diinginkan. Dengan `mode="wait"` judul baru baru mulai
             * tampak setelah yang lama hilang, saat lebarnya sudah sebagian
             * besar sampai.
             *
             * Keduanya ditumpuk di satu sel grid supaya tidak ada yang bergeser
             * selama persilangan.
             */}
            <span className="grid w-full min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={title}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : transitionEaseSmooth}
                  className="col-start-1 row-start-1 block min-w-0 truncate"
                >
                  {title}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.button>

          <motion.nav
            initial={false}
            animate={{
              opacity: isOpen ? 1 : 0,
              y: isOpen ? 0 : -8,
              scale: isOpen ? 1 : 0.98,
            }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : isOpen
                  ? { ...transitionEaseSmooth, delay: 0.08, duration: 0.22 }
                  : { ...transitionEaseSmooth, duration: 0.1 }
            }
            className={`no-scrollbar max-h-[calc(100dvh-5.5rem)] overflow-y-auto p-3 will-change-[opacity,transform] ${
              isOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
            aria-hidden={!isOpen}
            aria-label="Navigasi halaman"
            role="menu"
          >
            <div ref={listRef} className="flex flex-col gap-1">
              {items.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={isActive ? "page" : undefined}
                    tabIndex={isOpen ? 0 : -1}
                    onClick={onClose}
                    className={`flex min-h-12 items-center justify-between gap-4 rounded-full px-5 text-left transition duration-150 active:z-10 active:scale-[1.05] active:shadow-raised ${
                      isActive
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                    }`}
                  >
                    <span className="min-w-0 truncate text-sm font-bold">{item.label}</span>
                    <AppIcon
                      name={item.iconName}
                      weight={isActive ? "fill" : "regular"}
                      className={`icon-md shrink-0 ${isActive ? "text-on-primary" : "text-on-surface-variant/55"}`}
                    />
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        </motion.div>
      </motion.div>
    </>
  );
}
