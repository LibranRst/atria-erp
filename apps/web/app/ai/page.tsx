import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveActor } from "@/server/actor";
import { actorCan } from "@/lib/auth/permissions";
import { AiChatView } from "@/features/ai-chat/components/ai-chat-view";
import { AiRestrictedAccess } from "@/features/ai-chat/components/ai-restricted-access";

export const metadata: Metadata = {
  title: "Asisten AI | Atria ERP",
  description: "Asisten cerdas keuangan dan kontrol material proyek",
};

export default async function AiPage(): Promise<React.JSX.Element> {
  const actor = await resolveActor();
  if (!actor) redirect("/login");
  if (!actorCan(actor, "use:ai_chat")) return <AiRestrictedAccess />;
  return <AiChatView />;
}
