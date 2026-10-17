"use client";

import { PageState } from "@/components/ui";
import { useRouter } from "@/lib/navigation/workspace-navigation";

export function MaterialLoadState({
  restricted,
  message,
}: {
  readonly restricted: boolean;
  readonly message: string;
}): React.JSX.Element {
  const router = useRouter();
  return (
    <PageState
      kind={restricted ? "restricted" : "error"}
      title={restricted ? "Akses material dibatasi" : "Material belum dapat dimuat"}
      description={message}
      actionLabel={restricted ? undefined : "Coba lagi"}
      onAction={restricted ? undefined : () => router.refresh()}
    />
  );
}
