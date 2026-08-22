import type { Metadata } from "next";
import { AiChatView } from "@/features/ai-chat/components/ai-chat-view";

export const metadata: Metadata = {
  title: "Asisten AI | Atria ERP",
  description: "Asisten Cerdas Keuangan dan Kontrol Material Proyek Dekoria",
};

export default function AiPage(): React.JSX.Element {
  return <AiChatView />;
}
