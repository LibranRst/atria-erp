import { Link } from "@heroui/react";
import { LogoutButton } from "@/components/logout-button";
import { StatusPage } from "@/components/status-page";
import { atriaWebHref } from "@/components/app-links";
import { requireAdminActor } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly step?: string; readonly flow?: string }>;
}): Promise<React.JSX.Element> {
  await requireAdminActor({ allowOnboarding: true });
  const query = await searchParams;
  const target = new URL(
    query.flow === "review" ? "/onboarding/review" : "/onboarding",
    "https://atria.invalid",
  );
  if (query.step) target.searchParams.set("step", query.step);
  const path = `${target.pathname}${target.search}`;
  return (
    <StatusPage
      title={query.flow === "review" ? "Tinjau setup awal" : "Selesaikan setup Atria"}
      description={
        query.flow === "review"
          ? "Ada setup awal yang memerlukan peninjauan. Lanjutkan melalui Atria, lalu buka kembali Admin."
          : "Setup organisasi perlu diselesaikan sebelum mengelola proyek. Lanjutkan melalui Atria, lalu buka kembali Admin. Gunakan akun yang sama untuk masuk di sana."
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        <Link href={atriaWebHref(path)}>
          Lanjutkan setup
          <Link.Icon aria-hidden="true" />
        </Link>
        <Link href="/projects">Periksa kembali</Link>
        <LogoutButton />
      </div>
    </StatusPage>
  );
}
