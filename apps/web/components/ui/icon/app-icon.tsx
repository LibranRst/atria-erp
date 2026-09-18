import type { ComponentPropsWithoutRef, ComponentType } from "react";
import { ArchiveIcon } from "@phosphor-icons/react/dist/ssr/Archive";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowCounterClockwise";
import { ArrowDownIcon } from "@phosphor-icons/react/dist/ssr/ArrowDown";
import { ArrowDownLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowDownLeft";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { ArrowUUpLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowUUpLeft";
import { ArrowUpIcon } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise";
import { ArrowsLeftRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowsLeftRight";
import { BankIcon } from "@phosphor-icons/react/dist/ssr/Bank";
import { BellIcon } from "@phosphor-icons/react/dist/ssr/Bell";
import { BellRingingIcon } from "@phosphor-icons/react/dist/ssr/BellRinging";
import { BlueprintIcon } from "@phosphor-icons/react/dist/ssr/Blueprint";
import { BoxArrowDownIcon } from "@phosphor-icons/react/dist/ssr/BoxArrowDown";
import { BroadcastIcon } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { BuildingsIcon } from "@phosphor-icons/react/dist/ssr/Buildings";
import { CalendarIcon } from "@phosphor-icons/react/dist/ssr/Calendar";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/ssr/CalendarCheck";
import { CalendarDotsIcon } from "@phosphor-icons/react/dist/ssr/CalendarDots";
import { CalendarXIcon } from "@phosphor-icons/react/dist/ssr/CalendarX";
import { CameraIcon } from "@phosphor-icons/react/dist/ssr/Camera";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { ChartBarIcon } from "@phosphor-icons/react/dist/ssr/ChartBar";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/ssr/ChartLineUp";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/ssr/ChatCircle";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/ssr/ClipboardText";
import { ClockIcon } from "@phosphor-icons/react/dist/ssr/Clock";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";
import { CloudSlashIcon } from "@phosphor-icons/react/dist/ssr/CloudSlash";
import { CodeIcon } from "@phosphor-icons/react/dist/ssr/Code";
import { CopyIcon } from "@phosphor-icons/react/dist/ssr/Copy";
import { DatabaseIcon } from "@phosphor-icons/react/dist/ssr/Database";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/ssr/DeviceMobile";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/ssr/DotsThree";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { EnvelopeIcon } from "@phosphor-icons/react/dist/ssr/Envelope";
import { EyeIcon } from "@phosphor-icons/react/dist/ssr/Eye";
import { FileArrowUpIcon } from "@phosphor-icons/react/dist/ssr/FileArrowUp";
import { FileMagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/FileMagnifyingGlass";
import { FileTextIcon } from "@phosphor-icons/react/dist/ssr/FileText";
import { FloppyDiskIcon } from "@phosphor-icons/react/dist/ssr/FloppyDisk";
import { FolderIcon } from "@phosphor-icons/react/dist/ssr/Folder";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/ssr/FolderOpen";
import { FunnelXIcon } from "@phosphor-icons/react/dist/ssr/FunnelX";
import { HammerIcon } from "@phosphor-icons/react/dist/ssr/Hammer";
import { HandshakeIcon } from "@phosphor-icons/react/dist/ssr/Handshake";
import { HardHatIcon } from "@phosphor-icons/react/dist/ssr/HardHat";
import { HourglassIcon } from "@phosphor-icons/react/dist/ssr/Hourglass";
import { ImageIcon } from "@phosphor-icons/react/dist/ssr/Image";
import { ImageSquareIcon } from "@phosphor-icons/react/dist/ssr/ImageSquare";
import { InfoIcon } from "@phosphor-icons/react/dist/ssr/Info";
import { KeyIcon } from "@phosphor-icons/react/dist/ssr/Key";
import { LinkIcon } from "@phosphor-icons/react/dist/ssr/Link";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/ssr/ListBullets";
import { ListPlusIcon } from "@phosphor-icons/react/dist/ssr/ListPlus";
import { LockIcon } from "@phosphor-icons/react/dist/ssr/Lock";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { MagnifyingGlassMinusIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlassMinus";
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import { MapPinPlusIcon } from "@phosphor-icons/react/dist/ssr/MapPinPlus";
import { PaletteIcon } from "@phosphor-icons/react/dist/ssr/Palette";
import { MinusIcon } from "@phosphor-icons/react/dist/ssr/Minus";
import { MoneyIcon } from "@phosphor-icons/react/dist/ssr/Money";
import { NoteIcon } from "@phosphor-icons/react/dist/ssr/Note";
import { NotePencilIcon } from "@phosphor-icons/react/dist/ssr/NotePencil";
import { PackageIcon } from "@phosphor-icons/react/dist/ssr/Package";
import { PaperclipIcon } from "@phosphor-icons/react/dist/ssr/Paperclip";
import { PaperPlaneRightIcon } from "@phosphor-icons/react/dist/ssr/PaperPlaneRight";
import { PencilRulerIcon } from "@phosphor-icons/react/dist/ssr/PencilRuler";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr/PencilSimple";
import { PlayIcon } from "@phosphor-icons/react/dist/ssr/Play";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { PlusCircleIcon } from "@phosphor-icons/react/dist/ssr/PlusCircle";
import { PlusSquareIcon } from "@phosphor-icons/react/dist/ssr/PlusSquare";
import { QuestionIcon } from "@phosphor-icons/react/dist/ssr/Question";
import { ReceiptIcon } from "@phosphor-icons/react/dist/ssr/Receipt";
import { RobotIcon } from "@phosphor-icons/react/dist/ssr/Robot";
import { SealCheckIcon } from "@phosphor-icons/react/dist/ssr/SealCheck";
import { ShieldIcon } from "@phosphor-icons/react/dist/ssr/Shield";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { ShoppingCartIcon } from "@phosphor-icons/react/dist/ssr/ShoppingCart";
import { SignOutIcon } from "@phosphor-icons/react/dist/ssr/SignOut";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/ssr/SlidersHorizontal";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { StackIcon } from "@phosphor-icons/react/dist/ssr/Stack";
import { TagIcon } from "@phosphor-icons/react/dist/ssr/Tag";
import { TrashIcon } from "@phosphor-icons/react/dist/ssr/Trash";
import { TrayIcon } from "@phosphor-icons/react/dist/ssr/Tray";
import { TrayArrowDownIcon } from "@phosphor-icons/react/dist/ssr/TrayArrowDown";
import { TrayArrowUpIcon } from "@phosphor-icons/react/dist/ssr/TrayArrowUp";
import { TrendUpIcon } from "@phosphor-icons/react/dist/ssr/TrendUp";
import { TruckIcon } from "@phosphor-icons/react/dist/ssr/Truck";
import { UserIcon } from "@phosphor-icons/react/dist/ssr/User";
import { UserCheckIcon } from "@phosphor-icons/react/dist/ssr/UserCheck";
import { UserPlusIcon } from "@phosphor-icons/react/dist/ssr/UserPlus";
import { UsersIcon } from "@phosphor-icons/react/dist/ssr/Users";
import { WalletIcon } from "@phosphor-icons/react/dist/ssr/Wallet";
import { WarehouseIcon } from "@phosphor-icons/react/dist/ssr/Warehouse";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { WarningOctagonIcon } from "@phosphor-icons/react/dist/ssr/WarningOctagon";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { XCircleIcon } from "@phosphor-icons/react/dist/ssr/XCircle";
import { cn } from "@/lib/utils/cn";

type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

type PhosphorIcon = ComponentType<
  ComponentPropsWithoutRef<"svg"> & { readonly weight?: IconWeight }
>;

/**
 * Setiap ikon diimpor dari modulnya sendiri, bukan lewat `import * as` dari barrel
 * `@phosphor-icons/react/ssr`. Barrel itu mengimpor 1.513 modul ikon secara statis,
 * dan karena komponennya dipilih lewat lookup runtime, bundler tidak bisa
 * membuangnya — graf modul dev maupun bundle produksi ikut menanggung semuanya.
 */
const iconByLegacyName = {
  account_balance: BankIcon,
  account_balance_wallet: WalletIcon,
  add: PlusIcon,
  add_box: PlusSquareIcon,
  add_circle: PlusCircleIcon,
  add_location_alt: MapPinPlusIcon,
  add_photo: ImageSquareIcon,
  alert_circle: WarningCircleIcon,
  analytics: ChartBarIcon,
  approval: SealCheckIcon,
  architecture: BlueprintIcon,
  archive: ArchiveIcon,
  attach_file: PaperclipIcon,
  arrow_back: ArrowLeftIcon,
  arrow_downward: ArrowDownIcon,
  arrow_forward: ArrowRightIcon,
  arrow_upward: ArrowUpIcon,
  assignment_late: ClipboardTextIcon,
  assignment_return: ArrowUUpLeftIcon,
  bell: BellIcon,
  bell_ringing: BellRingingIcon,
  cancel: XCircleIcon,
  category: TagIcon,
  chat: ChatCircleIcon,
  check: CheckIcon,
  check_circle: CheckCircleIcon,
  chevron_left: CaretLeftIcon,
  chevron_right: CaretRightIcon,
  close: XIcon,
  cloud_off: CloudSlashIcon,
  code: CodeIcon,
  construction: HammerIcon,
  contactless: BroadcastIcon,
  content_copy: CopyIcon,
  copy: CopyIcon,
  dashboard: SquaresFourIcon,
  data_alert: WarningCircleIcon,
  database: DatabaseIcon,
  delete: TrashIcon,
  delete_sweep: TrashIcon,
  description: FileTextIcon,
  design_services: PencilRulerIcon,
  developer_mode: CodeIcon,
  device_mobile: DeviceMobileIcon,
  domain: BuildingsIcon,
  done: CheckIcon,
  edit: PencilSimpleIcon,
  edit_note: NotePencilIcon,
  email: EnvelopeIcon,
  engineering: HardHatIcon,
  download: DownloadSimpleIcon,
  error: WarningCircleIcon,
  event: CalendarIcon,
  event_available: CalendarCheckIcon,
  event_busy: CalendarXIcon,
  event_upcoming: CalendarDotsIcon,
  expand_more: CaretDownIcon,
  fact_check: ClipboardTextIcon,
  file_search: FileMagnifyingGlassIcon,
  filter_alt_off: FunnelXIcon,
  folder: FolderIcon,
  folder_open: FolderOpenIcon,
  format_list_bulleted: ListBulletsIcon,
  group: UsersIcon,
  handshake: HandshakeIcon,
  history: ClockCounterClockwiseIcon,
  hourglass_top: HourglassIcon,
  image: ImageIcon,
  inbox: TrayIcon,
  info: InfoIcon,
  inventory: PackageIcon,
  inventory_2: BoxArrowDownIcon,
  keyboard_arrow_down: CaretDownIcon,
  layers: StackIcon,
  link: LinkIcon,
  list: ListBulletsIcon,
  local_shipping: TruckIcon,
  location_on: MapPinIcon,
  lock: LockIcon,
  logout: SignOutIcon,
  mail: EnvelopeIcon,
  monitoring: ChartLineUpIcon,
  more_horiz: DotsThreeIcon,
  move_to_inbox: TrayArrowDownIcon,
  north_east: ArrowUpRightIcon,
  notes: NoteIcon,
  notification_important: BellRingingIcon,
  notifications: BellIcon,
  notifications_none: BellIcon,
  open_in_new: ArrowSquareOutIcon,
  outbox: TrayArrowUpIcon,
  password: KeyIcon,
  paperclip: PaperclipIcon,
  payments: MoneyIcon,
  person: UserIcon,
  person_add: UserPlusIcon,
  person_play: UserCheckIcon,
  photo_camera: CameraIcon,
  palette: PaletteIcon,
  photo_library: ImageIcon,
  playlist_add: ListPlusIcon,
  priority_high: WarningIcon,
  production_quantity_limits: PackageIcon,
  progress_activity: CircleNotchIcon,
  publish: FileArrowUpIcon,
  receipt_long: ReceiptIcon,
  refresh: ArrowClockwiseIcon,
  remove: MinusIcon,
  report: WarningOctagonIcon,
  report_problem: WarningIcon,
  request_quote: FileTextIcon,
  restore: ArrowCounterClockwiseIcon,
  resume: PlayIcon,
  robot: RobotIcon,
  save: FloppyDiskIcon,
  schedule: ClockIcon,
  search: MagnifyingGlassIcon,
  search_off: MagnifyingGlassMinusIcon,
  send: PaperPlaneRightIcon,
  shield: ShieldIcon,
  shopping_cart_checkout: ShoppingCartIcon,
  smart_toy: RobotIcon,
  smartphone: DeviceMobileIcon,
  south_west: ArrowDownLeftIcon,
  space_dashboard: SquaresFourIcon,
  sparkle: SparkleIcon,
  sparkles: SparkleIcon,
  swap_horiz: ArrowsLeftRightIcon,
  sync: ArrowsClockwiseIcon,
  sync_alt: ArrowsLeftRightIcon,
  sync_problem: WarningCircleIcon,
  task_alt: CheckCircleIcon,
  trending_up: TrendUpIcon,
  tune: SlidersHorizontalIcon,
  undo: ArrowUUpLeftIcon,
  upload_file: FileArrowUpIcon,
  verified: SealCheckIcon,
  verified_user: ShieldCheckIcon,
  warehouse: WarehouseIcon,
  visibility: EyeIcon,
  warning: WarningIcon,
} satisfies Record<string, PhosphorIcon>;
export type AppIconName = keyof typeof iconByLegacyName;
export type AppIconProps = Omit<ComponentPropsWithoutRef<"svg">, "children"> & {
  readonly name: AppIconName | string;
  readonly weight?: IconWeight;
};

export function AppIcon({
  name,
  weight = "regular",
  className = "",
  ...props
}: AppIconProps): React.JSX.Element {
  const Icon: PhosphorIcon = Object.hasOwn(iconByLegacyName, name)
    ? iconByLegacyName[name as AppIconName]
    : QuestionIcon;
  return (
    <Icon aria-hidden="true" weight={weight} className={cn("scale-110", className)} {...props} />
  );
}
