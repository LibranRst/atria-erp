/**
 * Permukaan publik primitif UI bersama.
 *
 * Kode aplikasi (`app/**`, `features/**`, `components/layout/**`) mengimpor dari
 * `@/components/ui`. Jalur dalam seperti `@/components/ui/feedback/main-surface`
 * hanya dipakai di dalam `components/ui/**` sendiri dan oleh tesnya. Aturan ini
 * ditegakkan oleh `lib/architecture/ui-import-boundaries.test.ts`.
 *
 * Yang tidak diekspor di sini disengaja privat: helper kelas form, matematika
 * bottom sheet, dan pembantu segmented tab hanyalah detail implementasi.
 */

// Aksi dan kontrol
export { Button, ButtonLink, IconButton, IconButtonLink, SectionAction } from "./button/button";
export type {
  ButtonProps,
  ButtonLinkProps,
  ButtonSize,
  ButtonVariant,
  IconButtonProps,
  IconButtonLinkProps,
} from "./button/button";
export { AppIcon } from "./icon/app-icon";
export type { AppIconName, AppIconProps } from "./icon/app-icon";
export { DuotoneIconTile } from "./icon/icon-tile";
export type { IconTileTone } from "./icon/icon-tile";
export { UserAvatar } from "./identity/user-avatar";
export type { UserAvatarProps } from "./identity/user-avatar";

// Status, hitungan, dan metadata
export {
  Badge,
  CountBadge,
  formatStatus,
  MetadataChip,
  resolveStatusPresentation,
  SectionCountPill,
  StatusBadge,
} from "./badge/badge";
export type { BadgeStatus, BadgeVariant, StatusBadgeTone, StatusPresentation } from "./badge/badge";

// Permukaan halaman utama
export {
  DetailSection,
  FactRow,
  GroupedSurface,
  InlineStateRow,
  MainSection,
  PanelSection,
  RowGroup,
  SectionHeader,
  SheetSection,
  SummaryFact,
  SummarySurface,
} from "./feedback/main-surface";
export type { InlineStateTone, SummarySurfaceTone } from "./feedback/main-surface";
export {
  EmptyState,
  MetricGrid,
  MetricPill,
  MoneyMetricPill,
  MoneyValue,
  NativeSection,
  PageHeader,
  PillTabs,
} from "./feedback/page-primitives";
export type {
  MetricPillSurface,
  MoneyValueProps,
  MoneyValueVariant,
  PillTabOption,
} from "./feedback/page-primitives";
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card/card";
export {
  WorkspaceModuleHeader,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "./feedback/workspace-primitives";

// Indikator budget dan dampak
export { BudgetSplitIndicator } from "./feedback/budget-split-indicator";
export { UsageBlockMeter } from "./feedback/usage-block-meter";
export { MoneyImpactRow } from "./feedback/money-impact-row";

// Status runtime halaman
export { ConnectivityBanner, PageState } from "./feedback/page-state";
export type { PageStateKind, PageStateTone } from "./feedback/page-state";
export { RoutePageError, RoutePageLoading } from "./feedback/route-page-state";

// Navigasi dan filter
export { SegmentedTabs } from "./navigation/segmented-tabs";
export type { SegmentedTabOption } from "./navigation/segmented-tabs";
export { useListDetailFocus } from "./navigation/use-list-detail-focus";
export { FilterPills } from "./navigation/filter-pills";
export type { FilterPillOption } from "./navigation/filter-pills";
export { ExclusiveSearchFilterBar } from "./navigation/exclusive-search-filter-bar";
export type { SearchFilterMode } from "./navigation/exclusive-search-filter-bar";

// Overlay
export { ConfirmationModal, ConfirmationSheet, SheetActionButton } from "./overlay/bottom-sheet";
export type { ConfirmationModalTone } from "./overlay/bottom-sheet";
export { FormSheet, DetailSheet } from "./overlay/semantic-sheets";
export type {
  FormSheetDismissal,
  FormSheetProps,
  DetailSheetProps,
} from "./overlay/semantic-sheets";
export {
  CalendarDialog,
  CompactFormDialog,
  ConfirmationDialog,
  MorphDetailDialog,
  SearchDialog,
  SelectionDialog,
  SuccessDialog,
} from "./overlay/dialogs";
export type {
  ConfirmationDialogProps,
  ConfirmationDialogTone,
  DialogMorphOrigin,
  SuccessFact,
} from "./overlay/dialogs";
export { MediaPreviewDialog } from "./overlay/media-preview-dialog";
export { AnchoredFilterPanel } from "./overlay/anchored-filter-panel";
export { SheetFooterActions } from "./overlay/sheet-footer-actions";
export type { SheetFooterAction } from "./overlay/sheet-footer-actions";
export { OperationSuccessDialog, OperationSuccessSheet } from "./overlay/operation-success-dialog";
export type { OperationSuccess } from "./overlay/operation-success-dialog";
export { ActionMenu, ContextPopover, Tooltip } from "./overlay/anchored-surfaces";
export type {
  ActionMenuItem,
  AnchoredTrigger,
  ContextPopoverProps,
  TooltipProps,
} from "./overlay/anchored-surfaces";
export {
  FinanceUnsavedChangesModal,
  MaterialUnsavedChangesModal,
  UnsavedChangesModal,
} from "./overlay/unsaved-changes-modal";
export { useAnimatedSheetClose } from "./overlay/use-animated-sheet-close";
export { useSheetPresenceValue } from "./overlay/use-sheet-presence-value";

// Form
export {
  AdaptiveSelect,
  ChoiceRow,
  SwitchRow,
  COMMON_ROOM_OPTIONS,
  COMMON_UNIT_OPTIONS,
  ColorPickerField,
  CustomColorPicker,
  type ColorPresetOption,
  type CustomColorPickerProps,
  ComboboxField,
  DatePickerField,
  FormDisclosure,
  FilterSelect,
  FormSection,
  FormField,
  FormRiskNotice,
  type FormRiskTone,
  GuidedFormSection,
  GuidedFormSheet,
  InlineReviewStrip,
  MicroStatusDock,
  CompactEditableItemRow,
  MoneyInput,
  NumericInput,
  OptionChoiceGroup,
  OperationalFormSheet,
  QuantityStepper,
  SearchField,
  SearchInput,
  SheetSelect,
  SmartDefaultHint,
  Textarea,
  TextInput,
  ValuePreviewStrip,
  WorkflowFormSheet,
  type MicroStatusItem,
  type CompactEditableItemStatus,
} from "./form/form-controls";
export type { SelectOption } from "./form/form-controls";
export type { SelectPresentation } from "./form/form-controls";
export type { FormFieldLayout, FormPresentation } from "./form/form-controls";
export { useFormPresentation } from "./form/form-presentation-context";
export { useFormDirtySnapshot } from "./form/use-form-dirty-snapshot";
export { ReviewCollection, ReviewItem } from "./form/review-collection";
export { DialogOptionList } from "./form/dialog-option-list";
export type { DialogOptionListHandle } from "./form/dialog-option-list";
export { cx } from "./form/form-control-utils";

// Desktop admin: HeroUI adapters inherit Atria tokens and shared overlay ownership.
export { CashFlowTrendChart } from "./feedback/cash-flow-trend-chart";
export type { CashFlowTrendChartProps } from "./feedback/cash-flow-trend-chart";
export { DesktopUIProvider } from "./desktop/desktop-ui-provider";
export type { DesktopUIProviderProps } from "./desktop/desktop-ui-provider";
export { DesktopButton, DesktopInput, DesktopSelect } from "./desktop/desktop-controls";
export type {
  DesktopButtonProps,
  DesktopInputProps,
  DesktopSelectOption,
  DesktopSelectProps,
} from "./desktop/desktop-controls";
export { DesktopTable } from "./desktop/desktop-table";
export type { DesktopTableColumn, DesktopTableProps } from "./desktop/desktop-table";
export { useDesktopTable, desktopTablePage } from "./desktop/use-desktop-table";
export type {
  DesktopTableSort,
  DesktopTableOptions,
  DesktopTableState,
} from "./desktop/use-desktop-table";
export { DesktopTablePagination } from "./desktop/desktop-table-pagination";
export type { DesktopTablePaginationProps } from "./desktop/desktop-table-pagination";

export { DesktopButtonLink } from "./desktop/desktop-button-link";
export type { DesktopButtonLinkProps } from "./desktop/desktop-button-link";
