import type { Metadata } from "next";

import { ButtonLink, PageHeader, PageState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Tanpa koneksi",
};

/**
 * Halaman cadangan yang dilayani service worker ketika navigasi gagal karena
 * jaringan putus. Halaman ini sengaja tidak membaca sesi atau data apa pun:
 * isinya harus tetap benar untuk pemilik yang sudah login maupun yang belum,
 * dan ia harus bisa disimpan di cache saat aplikasi pertama kali dimuat.
 */
export default function OfflinePage(): React.JSX.Element {
  return (
    <section className="space-y-sm px-1 pb-8 select-none max-[430px]:-mx-1 max-[430px]:pb-6">
      <PageHeader
        title="Tanpa koneksi"
        subtitle="Perangkat ini belum dapat menjangkau server Paduna Build."
      />
      <PageState
        kind="offline"
        title="Halaman belum dapat dimuat"
        description="Saldo, budget, dan stok dibaca langsung dari server setiap kali dibuka. Paduna Build tidak menyimpan salinan halaman keuangan di perangkat, jadi angka lama tidak pernah ditampilkan seolah-olah angka terkini."
      />
      <ButtonLink href="/" fullWidth variant="secondary">
        Coba lagi
      </ButtonLink>
    </section>
  );
}
