import type { IconWeight } from "@phosphor-icons/react";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { FolderIcon } from "@phosphor-icons/react/dist/ssr/Folder";
import { WalletIcon } from "@phosphor-icons/react/dist/ssr/Wallet";
import { ReceiptIcon } from "@phosphor-icons/react/dist/ssr/Receipt";
import { SealCheckIcon } from "@phosphor-icons/react/dist/ssr/SealCheck";
import { PackageIcon } from "@phosphor-icons/react/dist/ssr/Package";
import { HammerIcon } from "@phosphor-icons/react/dist/ssr/Hammer";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/ssr/SlidersHorizontal";
import { QuestionIcon } from "@phosphor-icons/react/dist/ssr/Question";

// Historical comparison only. No production entry point imports this module.
const historicalIcons = {
  dashboard: SquaresFourIcon,
  folder: FolderIcon,
  account_balance_wallet: WalletIcon,
  receipt_long: ReceiptIcon,
  verified: SealCheckIcon,
  inventory: PackageIcon,
  construction: HammerIcon,
  tune: SlidersHorizontalIcon,
};

function isHistoricalName(name: string): name is keyof typeof historicalIcons {
  return Object.hasOwn(historicalIcons, name);
}

export function PhosphorReference({
  name,
  weight = "regular",
  className,
}: {
  readonly name: string;
  readonly weight?: IconWeight;
  readonly className?: string;
}): React.JSX.Element {
  const Icon = isHistoricalName(name) ? historicalIcons[name] : QuestionIcon;
  return <Icon aria-hidden="true" weight={weight} className={`scale-110 ${className ?? ""}`} />;
}
