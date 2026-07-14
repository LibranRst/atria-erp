import type { JSX } from "react";
import { Info } from "lucide-react";

type PanelEmptyStateProps = {
  readonly title: string;
  readonly description: string;
};

export function PanelEmptyState({
  title,
  description,
}: PanelEmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-outline-variant/20 bg-white px-6 py-14 text-center shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-surface-container-low text-on-surface-variant shadow-sm">
        <Info className="h-5 w-5" />
      </div>
      <p className="mt-5 text-lg font-semibold leading-6 text-on-surface">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-on-surface-variant">
        {description}
      </p>
    </div>
  );
}
