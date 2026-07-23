import { redirect } from "next/navigation";

import { getBootstrapStatus } from "@/app/actions/administration";
import { SetupOwnerForm } from "@/features/administration/components/forms/setup-owner-form";

export const dynamic = "force-dynamic";

export default async function SetupPage(): Promise<React.JSX.Element> {
  const status = await getBootstrapStatus();
  if (!status.success || !status.data.required) redirect("/login");
  return <SetupOwnerForm />;
}
