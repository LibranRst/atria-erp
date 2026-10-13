import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { LoginForm } from "@/components/login-form";
import { safeAdminReturnTo } from "@/lib/auth/policy";
import { requireAdminActor, resolveActor } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly returnTo?: string; readonly changed?: string }>;
}): Promise<React.JSX.Element> {
  const query = await searchParams;
  const destination = safeAdminReturnTo(query.returnTo);
  if (await resolveActor()) {
    await requireAdminActor({ returnTo: destination });
    redirect(destination);
  }
  return (
    <AuthFrame
      title="Masuk ke Admin"
      description="Gunakan akun Atria Anda untuk mengelola proyek dan budget."
    >
      <LoginForm destination={destination} passwordChanged={query.changed === "true"} />
    </AuthFrame>
  );
}
