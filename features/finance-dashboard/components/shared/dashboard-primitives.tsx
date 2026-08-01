import React from "react";

import { DetailSection } from "@/components/ui/feedback/main-surface";

/**
 * Seksi pratinjau di tab Ringkasan Dashboard: sama persis dengan `DetailSection`
 * global, hanya selalu membawa aksi "Lihat semua" dan sedikit jarak atas.
 */
export function OverviewPreviewSection({
  title,
  href,
  action,
  children,
  contentClassName = "",
}: {
  readonly title: string;
  readonly href: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly contentClassName?: string;
}): React.JSX.Element {
  return (
    <DetailSection
      title={title}
      titleAction={action}
      href={href}
      contentClassName={contentClassName}
    >
      {children}
    </DetailSection>
  );
}
