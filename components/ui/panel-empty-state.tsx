import type { JSX } from "react";
import { Info } from "lucide-react";

type PanelEmptyStateProps = {
  readonly title: string;
  readonly description: string;
};

export function PanelEmptyState({ title, description }: PanelEmptyStateProps): JSX.Element {
  return (
    <div className="border-outline-variant/20 flex flex-col items-center justify-center rounded-[28px] border bg-white px-6 py-14 text-center shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
      <div className="bg-surface-container-low text-on-surface-variant flex h-14 w-14 items-center justify-center rounded-3xl shadow-sm">
        <Info className="h-5 w-5" />
      </div>
      <p className="text-on-surface mt-5 text-lg leading-6 font-semibold">{title}</p>
      <p className="text-on-surface-variant mx-auto mt-2 max-w-xs text-sm leading-6">
        {description}
      </p>
    </div>
  );
}
