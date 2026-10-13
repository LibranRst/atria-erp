"use client";

import { I18nProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import { UnsavedChangesProvider } from "./unsaved-changes";

export function AppProviders({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  return (
    <I18nProvider locale="id-ID">
      <UnsavedChangesProvider navigate={(href: string): void => router.push(href)}>
        {children}
      </UnsavedChangesProvider>
    </I18nProvider>
  );
}
