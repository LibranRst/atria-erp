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
export { Button, ButtonLink, IconButton, SectionAction } from "./button/button";
export type {
  ButtonProps,
  ButtonLinkProps,
  ButtonSize,
  ButtonVariant,
  IconButtonProps,
} from "./button/button";
export { AppIcon } from "./icon/app-icon";
export type { AppIconName, AppIconProps } from "./icon/app-icon";

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
  MoneyValueVariant,
  PillTabOption,
} from "./feedback/page-primitives";
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card/card";

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
export { FilterPills } from "./navigation/filter-pills";
export type { FilterPillOption } from "./navigation/filter-pills";
export { ExclusiveSearchFilterBar } from "./navigation/exclusive-search-filter-bar";
export type { SearchFilterMode } from "./navigation/exclusive-search-filter-bar";

// Overlay
export {
  BottomSheet,
  ConfirmationModal,
  ConfirmationSheet,
  SheetActionButton,
} from "./overlay/bottom-sheet";
export type { ConfirmationModalTone } from "./overlay/bottom-sheet";
export { SheetFooterActions } from "./overlay/sheet-footer-actions";
export { OperationSuccessSheet } from "./overlay/operation-success-sheet";
export type { OperationSuccess } from "./overlay/operation-success-sheet";
export {
  FinanceUnsavedChangesModal,
  MaterialUnsavedChangesModal,
  UnsavedChangesModal,
} from "./overlay/unsaved-changes-modal";
export { useAnimatedSheetClose } from "./overlay/use-animated-sheet-close";
export { useSheetPresenceValue } from "./overlay/use-sheet-presence-value";

// Form
export {
  ChoiceRow,
  SwitchRow,
  COMMON_ROOM_OPTIONS,
  COMMON_UNIT_OPTIONS,
  ComboboxField,
  DatePickerField,
  FieldContextLine,
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
export type { FormFieldLayout, FormPresentation } from "./form/form-controls";
export { useFormPresentation } from "./form/form-presentation-context";
export { cx } from "./form/form-control-utils";
