import { PageState } from "@/components/ui";
import React from "react";

export const dynamic = "force-dynamic";

export default function NotFoundPage(): React.JSX.Element {
  return (
    <section className="space-y-sm select-none">
      <PageState
        kind="filtered-empty"
        title="Halaman tidak ditemukan"
        description="Halaman yang Anda cari tidak ditemukan atau telah dipindahkan."
      />
    </section>
  );
}
