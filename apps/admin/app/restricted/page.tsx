import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { StatusPage } from "@/components/status-page";
import { resolveActor } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function RestrictedPage(): Promise<React.JSX.Element> {
  const actor = await resolveActor();
  if (!actor) redirect("/login");
  const canEnter = actor.permissions.includes("use:desktop_admin");
  return (
    <StatusPage
      title={canEnter ? "Akses proyek dibatasi" : "Akses Admin dibatasi"}
      description={
        canEnter
          ? "Akun Anda belum memiliki izin melihat budget proyek. Hubungi Owner untuk menyesuaikan Peran & Akses."
          : "Akun Anda belum memiliki akses ke Admin Atria. Hubungi Owner untuk menyesuaikan Peran & Akses. Anda tetap dapat menggunakan Atria sesuai izin akun."
      }
    >
      <LogoutButton />
    </StatusPage>
  );
}
