import type { ComponentPropsWithoutRef, ComponentType } from "react";
import * as Phosphor from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils/cn";

type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

type PhosphorIcon = ComponentType<
  ComponentPropsWithoutRef<"svg"> & { readonly weight?: IconWeight }
>;

const componentNameByLegacyName = {
  account_balance: "BankIcon",
  account_balance_wallet: "WalletIcon",
  add: "PlusIcon",
  add_box: "PlusSquareIcon",
  add_circle: "PlusCircleIcon",
  add_location_alt: "MapPinPlusIcon",
  analytics: "ChartBarIcon",
  approval: "SealCheckIcon",
  architecture: "BlueprintIcon",
  arrow_back: "ArrowLeftIcon",
  arrow_downward: "ArrowDownIcon",
  arrow_forward: "ArrowRightIcon",
  arrow_upward: "ArrowUpIcon",
  cancel: "XCircleIcon",
  category: "TagIcon",
  check: "CheckIcon",
  check_circle: "CheckCircleIcon",
  chevron_left: "CaretLeftIcon",
  chevron_right: "CaretRightIcon",
  close: "XIcon",
  cloud_off: "CloudSlashIcon",
  code: "CodeIcon",
  construction: "HammerIcon",
  contactless: "BroadcastIcon",
  content_copy: "CopyIcon",
  database: "DatabaseIcon",
  dashboard: "SquaresFourIcon",
  data_alert: "WarningCircleIcon",
  delete: "TrashIcon",
  description: "FileTextIcon",
  developer_mode: "CodeIcon",
  done: "CheckIcon",
  domain: "BuildingsIcon",
  edit_note: "NotePencilIcon",
  engineering: "HardHatIcon",
  error: "WarningCircleIcon",
  event: "CalendarIcon",
  event_available: "CalendarCheckIcon",
  event_busy: "CalendarXIcon",
  event_upcoming: "CalendarDotsIcon",
  expand_more: "CaretDownIcon",
  fact_check: "ClipboardTextIcon",
  filter_alt_off: "FunnelXIcon",
  folder: "FolderIcon",
  folder_open: "FolderOpenIcon",
  format_list_bulleted: "ListBulletsIcon",
  handshake: "HandshakeIcon",
  history: "ClockCounterClockwiseIcon",
  hourglass_top: "HourglassIcon",
  image: "ImageIcon",
  inbox: "TrayIcon",
  info: "InfoIcon",
  inventory: "PackageIcon",
  inventory_2: "ArchiveBoxIcon",
  keyboard_arrow_down: "CaretDownIcon",
  link: "LinkIcon",
  list: "ListBulletsIcon",
  local_shipping: "TruckIcon",
  location_on: "MapPinIcon",
  lock: "LockIcon",
  logout: "SignOutIcon",
  mail: "EnvelopeIcon",
  monitoring: "ChartLineUpIcon",
  more_horiz: "DotsThreeIcon",
  north_east: "ArrowUpRightIcon",
  notes: "NoteIcon",
  notification_important: "BellRingingIcon",
  password: "KeyIcon",
  payments: "MoneyIcon",
  person: "UserIcon",
  person_play: "UserCheckIcon",
  photo_camera: "CameraIcon",
  photo_library: "ImageIcon",
  playlist_add: "ListPlusIcon",
  priority_high: "WarningIcon",
  production_quantity_limits: "PackageIcon",
  progress_activity: "CircleNotchIcon",
  publish: "FileArrowUpIcon",
  receipt_long: "ReceiptIcon",
  refresh: "ArrowClockwiseIcon",
  report: "WarningOctagonIcon",
  report_problem: "WarningIcon",
  request_quote: "FileTextIcon",
  resume: "PlayIcon",
  schedule: "ClockIcon",
  search_off: "MagnifyingGlassMinusIcon",
  send: "PaperPlaneRightIcon",
  shield: "ShieldIcon",
  shopping_cart_checkout: "ShoppingCartIcon",
  south_west: "ArrowDownLeftIcon",
  space_dashboard: "SquaresFourIcon",
  swap_horiz: "ArrowsLeftRightIcon",
  sync: "ArrowsClockwiseIcon",
  sync_alt: "ArrowsLeftRightIcon",
  sync_problem: "WarningCircleIcon",
  task_alt: "CheckCircleIcon",
  trending_up: "TrendUpIcon",
  tune: "SlidersHorizontalIcon",
  undo: "ArrowUUpLeftIcon",
  upload_file: "FileArrowUpIcon",
  verified: "SealCheckIcon",
  verified_user: "ShieldCheckIcon",
  warning: "WarningIcon",
  warehouse: "WarehouseIcon",
} as const;

export type AppIconName = keyof typeof componentNameByLegacyName;
export type AppIconProps = Omit<ComponentPropsWithoutRef<"svg">, "children"> & {
  readonly name: AppIconName | string;
  readonly weight?: IconWeight;
};

const phosphorIcons = Phosphor as unknown as Record<string, PhosphorIcon>;

export function AppIcon({
  name,
  weight = "regular",
  className = "",
  ...props
}: AppIconProps): React.JSX.Element {
  const componentName = componentNameByLegacyName[name as AppIconName];
  const Icon =
    (componentName ? phosphorIcons[componentName] : undefined) ?? phosphorIcons.QuestionIcon;
  return (
    <Icon aria-hidden="true" weight={weight} className={cn("scale-110", className)} {...props} />
  );
}
