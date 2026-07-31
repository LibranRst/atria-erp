import React from "react";

import { SectionAction } from "@/components/ui/button/button";
import { GroupedSurface } from "@/components/ui/feedback/main-surface";

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
    <section className="space-y-2 pt-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[17px] leading-6 font-bold tracking-[-0.015em] text-on-surface max-[430px]:text-[15px] max-[430px]:leading-5">
            {title}
          </h2>
          {action}
        </div>
        <SectionAction href={href} label="Lihat semua" />
      </div>
      <GroupedSurface className={contentClassName}>{children}</GroupedSurface>
    </section>
  );
}
