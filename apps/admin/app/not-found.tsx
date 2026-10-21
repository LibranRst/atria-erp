import { Link } from "@heroui/react";
import { StatusPage } from "@/components/status-page";

export default function NotFound(): React.JSX.Element {
  return (
    <StatusPage
      title="Halaman tidak ditemukan"
      description="Alamat ini tidak tersedia di Admin Atria."
    >
      <Link href="/projects">
        Kembali ke proyek
        <Link.Icon aria-hidden="true" />
      </Link>
    </StatusPage>
  );
}
