import { redirect } from "next/navigation";

import { TemporaryPasswordForm } from "@/features/administration/components/temporary-password-form";
import { requireServerSession } from "@/lib/server/session";

export default async function PasswordPage(): Promise<React.JSX.Element> {
  const session = await requireServerSession();
  if (!session.user.mustChangePassword) redirect("/");
  return <TemporaryPasswordForm />;
}
