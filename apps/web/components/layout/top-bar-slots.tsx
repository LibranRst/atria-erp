"use client";

import * as React from "react";

/**
 * Cara sebuah rute menitipkan isi slot ke bilah atas yang dirender shell.
 *
 * Sebelumnya halaman asisten AI merender bilahnya sendiri, dan itu berarti
 * menyeberangi batas rute membongkar satu komponen lalu memasang komponen lain.
 * Tidak ada instance yang bertahan, sehingga lebar pil judul **patah** alih-alih
 * bermorf — tidak ada yang bisa dianimasikan antara dua benda yang tidak pernah
 * hidup bersamaan.
 *
 * Dengan satu bilah untuk semua rute, `HeaderMorphMenu` tetap satu instance dan
 * lebarnya bergerak dari judul lama ke judul baru. Yang berpindah tinggal isi
 * slotnya, dan itulah yang dititipkan lewat context ini.
 */
export type TopBarSlots = {
  /** Judul yang tidak bisa diturunkan dari rute — misalnya keadaan dalam halaman. */
  readonly title?: string;
  readonly left?: React.ReactNode;
  readonly right?: React.ReactNode;
};

const TopBarSlotsValue = React.createContext<TopBarSlots | null>(null);
const TopBarSlotsSetter = React.createContext<(slots: TopBarSlots | null) => void>(() => {});

export function TopBarSlotsProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const [slots, setSlots] = React.useState<TopBarSlots | null>(null);

  return (
    <TopBarSlotsSetter.Provider value={setSlots}>
      <TopBarSlotsValue.Provider value={slots}>{children}</TopBarSlotsValue.Provider>
    </TopBarSlotsSetter.Provider>
  );
}

/** Dibaca oleh perakit bilah; `null` berarti rute ini memakai slot bawaan. */
export function useTopBarSlots(): TopBarSlots | null {
  return React.useContext(TopBarSlotsValue);
}

/**
 * Dipakai rute yang perlu mengisi slot bilah dengan kontrolnya sendiri.
 *
 * Sengaja `useLayoutEffect`: ia berjalan sebelum browser melukis, jadi kontrol
 * bawaan tidak sempat terlihat sekejap sebelum ditukar.
 */
export function useProvideTopBarSlots(build: () => TopBarSlots, deps: React.DependencyList): void {
  const setSlots = React.useContext(TopBarSlotsSetter);

  React.useLayoutEffect(() => {
    setSlots(build());
    return () => setSlots(null);
    // `build` sengaja tidak masuk daftar: ia dibentuk ulang setiap render, dan
    // pemanggilnya yang menyebutkan nilai apa saja yang benar-benar berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSlots, ...deps]);
}
