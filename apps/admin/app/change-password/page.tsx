import { AuthFrame } from "@/components/auth-frame";
import { PasswordForm } from "@/components/password-form";
import { requireAdminActor } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage(): Promise<React.JSX.Element> {
  const actor = await requireAdminActor({ allowPasswordChange: true, allowOnboarding: true });
  const temporary = actor.mustChangePassword && !actor.developerActorUserId;
  return (
    <AuthFrame
      title={temporary ? "Buat kata sandi pribadi" : "Ganti kata sandi"}
      description={
        temporary
          ? "Ganti kata sandi sementara sebelum membuka Admin."
          : "Gunakan kata sandi yang kuat untuk akun Atria Anda."
      }
    >
      <PasswordForm temporary={temporary} />
    </AuthFrame>
  );
}
