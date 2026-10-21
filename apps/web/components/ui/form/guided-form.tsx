"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { FormSheet, type FormSheetDismissal } from "../overlay/semantic-sheets";
import { cx } from "./form-control-utils";
import {
  type FormPresentation,
  FormPresentationProvider,
  useFormPresentation,
} from "./form-presentation-context";
import { SheetFooterActions } from "../overlay/sheet-footer-actions";
import type { SheetFooterAction } from "../overlay/sheet-footer-actions";
import { Button } from "../button/button";
import type { FormRiskTone } from "./form-support";
import { formatShortIdr } from "@atria/core/utils/money";
import { buttonTapActiveScale, transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { ContentReveal } from "../overlay/content-reveal";
import { ChoiceRow } from "./basic-form-controls";

export type MicroStatusItem = {
  readonly label: string;
  readonly value?: string;
  readonly amount?: number;
  readonly tone?: FormRiskTone;
};

const dotClass: Record<FormRiskTone, string> = {
  default: "bg-outline",
  warning: "bg-warning",
  danger: "bg-error",
  success: "bg-primary",
};

const textClass: Record<FormRiskTone, string> = {
  default: "text-on-surface-variant",
  warning: "text-warning",
  danger: "text-error",
  success: "text-primary",
};

export function FormSheetPresentationBoundary({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <FormPresentationProvider presentation="standalone">{children}</FormPresentationProvider>;
}

export function OperationalFormSheet({
  open,
  title,
  children,
  submitLabel,
  submittingLabel,
  primaryLabel,
  pendingLabel,
  pending,
  disabled,
  disabledReason,
  statusText,
  statusTone = "default",
  statusItems,
  review,
  action,
  error,
  danger,
  formId,
  hideSubmit,
  onClose,
  onExitComplete,
  onSubmit,
  onPrimary,
  secondary,
  dismissal,
  desktopSize,
  desktopFooterPlacement,
  desktopAsideSummary,
  sizing,
  returnFocusRef,
  fallbackFocusRef,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly submitLabel?: string;
  readonly submittingLabel?: string;
  readonly primaryLabel?: string;
  readonly pendingLabel?: string;
  readonly pending?: boolean;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly statusText?: string;
  readonly statusTone?: FormRiskTone;
  readonly statusItems?: readonly MicroStatusItem[];
  readonly review?: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly error?: React.ReactNode;
  readonly danger?: boolean;
  readonly formId?: string;
  readonly hideSubmit?: boolean;
  readonly secondary?: SheetFooterAction;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
  readonly onSubmit?: () => void;
  readonly onPrimary?: () => void;
  readonly dismissal: FormSheetDismissal;
  readonly description?: string;
  readonly completion?: readonly [number, number];
  readonly desktopSize?: "standard" | "wide";
  readonly desktopFooterPlacement?: "bottom" | "aside";
  readonly desktopAsideSummary?: React.ReactNode;
  readonly sizing?: "content" | "maximum";
  readonly returnFocusRef?: React.RefObject<HTMLElement | null>;
  readonly fallbackFocusRef?: React.RefObject<HTMLElement | null>;
}): React.JSX.Element {
  const hasSubmitAction = !hideSubmit;
  const effectiveSubmitLabel = submitLabel ?? primaryLabel ?? "Simpan";
  const effectiveSubmittingLabel = submittingLabel ?? pendingLabel ?? "Menyimpan…";
  const effectiveOnSubmit = formId ? undefined : (onSubmit ?? onPrimary);

  const footerContent =
    statusText ||
    (statusItems && statusItems.length > 0) ||
    review ||
    disabledReason ||
    hasSubmitAction ||
    secondary ? (
      <div className="space-y-2">
        {statusText ? (
          <p
            className={cx("px-1 text-support font-medium", textClass[statusTone])}
            role={statusTone === "danger" ? "alert" : "status"}
          >
            {statusText}
          </p>
        ) : statusItems && statusItems.length > 0 ? (
          <MicroStatusDock items={statusItems} />
        ) : review ? (
          review
        ) : null}
        {hasSubmitAction ? (
          <SheetFooterActions
            desktopStacked={desktopFooterPlacement === "aside"}
            primary={{
              label: effectiveSubmitLabel,
              pendingLabel: effectiveSubmittingLabel,
              pending,
              disabled,
              form: formId,
              type: formId ? "submit" : "button",
              onClick: effectiveOnSubmit,
              variant: danger ? "critical" : "primary",
            }}
            secondary={secondary}
            disabledReason={disabledReason}
          />
        ) : secondary ? (
          <div className="space-y-2">
            <Button
              type={secondary.type ?? "button"}
              form={secondary.form}
              onClick={secondary.onClick}
              disabled={secondary.disabled}
              pending={secondary.pending}
              pendingLabel={secondary.pendingLabel}
              variant={secondary.variant ?? "secondary"}
              fullWidth
              className="min-w-0"
            >
              {secondary.label}
            </Button>
            {disabledReason ? (
              <p className="px-1 text-meta font-medium text-on-surface-variant">{disabledReason}</p>
            ) : null}
          </div>
        ) : disabledReason ? (
          <p className="px-1 text-meta font-medium text-on-surface-variant">{disabledReason}</p>
        ) : null}
      </div>
    ) : undefined;

  return (
    <FormSheet
      open={open}
      title={title}
      dismissal={dismissal}
      pending={pending}
      action={action}
      onClose={onClose}
      onExitComplete={onExitComplete}
      footer={footerContent}
      desktopSize={desktopSize}
      desktopFooterPlacement={desktopFooterPlacement}
      desktopAsideSummary={desktopAsideSummary}
      sizing={sizing}
      returnFocusRef={returnFocusRef}
      fallbackFocusRef={fallbackFocusRef}
    >
      <FormSheetPresentationBoundary>
        <div className="space-y-4">
          {error}
          {children}
        </div>
      </FormSheetPresentationBoundary>
    </FormSheet>
  );
}

export function FormDisclosure({
  title,
  description,
  summary,
  icon,
  variant = "default",
  expanded,
  onToggle,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly summary?: string;
  readonly icon?: React.ReactNode;
  readonly variant?: "default" | "compact" | "plain" | "activity";
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const compact = variant !== "default";
  const plain = variant === "plain" || variant === "activity";
  const activity = variant === "activity";
  const detailsId = React.useId();

  return (
    <section className="min-w-0">
      <button
        type="button"
        onClick={onToggle}
        className={cx(
          "flex w-full items-center text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          !plain && "ring-1",
          plain
            ? "min-h-12 gap-2.5 rounded-full bg-transparent px-0 py-2 text-on-surface-variant"
            : compact
              ? "min-h-12 gap-2.5 rounded-[22px] bg-surface-container-lowest px-3 py-2.5 shadow-surface"
              : "min-h-14 gap-3 rounded-full px-3.5 py-2.5 shadow-control",
          !plain &&
            (compact
              ? expanded
                ? "text-on-surface ring-primary/18"
                : "text-on-surface ring-ring-subtle"
              : expanded
                ? "bg-primary/7 text-primary ring-primary/20"
                : "bg-surface-container-low text-on-surface ring-ring-subtle"),
        )}
        aria-expanded={expanded}
        aria-controls={detailsId}
      >
        {icon ? (
          <span
            className={cx(
              "flex shrink-0 items-center justify-center rounded-full",
              compact ? "h-8 w-8" : "h-10 w-10",
              activity
                ? "bg-transparent text-on-surface"
                : expanded
                  ? compact
                    ? "bg-primary/8 text-primary"
                    : "bg-primary text-on-primary"
                  : compact
                    ? "bg-surface-container-low text-on-surface-variant"
                    : "bg-surface text-on-surface-variant",
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2 leading-none">
            <span
              className={cx(
                "truncate font-semibold",
                activity ? "text-support leading-5" : "text-xs",
                !activity && (compact ? "leading-[1.15]" : "leading-4"),
              )}
            >
              {title}
            </span>
            {summary ? (
              <span
                className={cx(
                  "shrink-0 rounded-full px-2 py-0.5 text-[9px] leading-[1.1] font-bold",
                  compact && expanded
                    ? "bg-primary/8 text-primary"
                    : "bg-surface-container-low text-on-surface-variant",
                )}
              >
                {summary}
              </span>
            ) : null}
          </span>
          {description ? (
            <span
              className={cx(
                "mt-0.5 block truncate text-meta text-on-surface-variant",
                compact ? "leading-[1.2]" : "leading-4",
              )}
            >
              {description}
            </span>
          ) : null}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
          className={cx(
            "flex shrink-0 items-center justify-center text-on-surface-variant",
            compact ? "icon-md" : "icon-lg",
          )}
          aria-hidden="true"
        >
          <AppIcon name="expand_more" className="h-full w-full" />
        </motion.span>
      </button>
      <ContentReveal
        id={detailsId}
        expanded={expanded}
        className={activity ? "" : compact ? "pt-2.5" : "pt-3"}
      >
        {children}
      </ContentReveal>
    </section>
  );
}

export type CompactEditableItemStatus = "complete" | "warning" | "danger" | "neutral";

const compactStatusClass: Record<CompactEditableItemStatus, string> = {
  complete: "bg-primary",
  warning: "bg-warning",
  danger: "bg-error",
  neutral: "bg-outline",
};

export function CompactEditableItemRow({
  status,
  statusLabel: customStatusLabel,
  title,
  meta,
  value,
  disabled = false,
  grouped = false,
  onClick,
  selection,
}: {
  readonly status: CompactEditableItemStatus;
  readonly statusLabel?: string;
  readonly title: string;
  readonly meta: string;
  readonly value?: React.ReactNode;
  readonly disabled?: boolean;
  readonly grouped?: boolean;
  readonly onClick?: () => void;
  readonly selection?: {
    readonly checked: boolean;
    readonly disabled?: boolean;
    readonly onChange: (checked: boolean) => void;
  };
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  const statusLabel =
    customStatusLabel ??
    (status === "complete"
      ? "Lengkap"
      : status === "warning"
        ? "Perlu diperiksa"
        : status === "danger"
          ? "Bermasalah"
          : "Belum diisi");

  const rowClass = cx(
    "flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-45",
    grouped
      ? "rounded-none bg-surface-container-lowest"
      : "rounded-[22px] bg-surface-container-low/70 ring-1 ring-ring-subtle",
  );
  const content = (
    <>
      {!selection && (
        <span
          className={cx("h-2.5 w-2.5 shrink-0 rounded-full", compactStatusClass[status])}
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs leading-4 font-bold text-on-surface">{title}</span>
        <span className="mt-0.5 block text-meta text-on-surface-variant">{meta}</span>
        <span className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-meta">
          <span className="font-medium">{statusLabel}</span>
          {value ? <span className="text-on-surface">{value}</span> : null}
        </span>
      </span>
      {onClick ? (
        <AppIcon name="chevron_right" className="icon-md shrink-0 text-on-surface-variant" />
      ) : null}
    </>
  );

  const editableContent = onClick ? (
    <motion.button
      type="button"
      layout
      whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
      transition={transitionSpringSnappy}
      disabled={disabled}
      onClick={onClick}
      className={
        selection
          ? "flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pr-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-45"
          : rowClass
      }
      aria-label={`${title}. ${statusLabel}. ${meta}`}
    >
      {content}
    </motion.button>
  ) : (
    <div
      className={
        selection ? "flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pr-3" : rowClass
      }
    >
      {content}
    </div>
  );
  if (!selection) return editableContent;

  return (
    <div
      className={cx(
        "flex items-center gap-1 pl-1",
        grouped ? "bg-surface-container-lowest" : "rounded-2xl bg-surface-container-low",
      )}
    >
      <ChoiceRow
        compact
        checked={selection.checked}
        disabled={disabled || selection.disabled}
        onChange={selection.onChange}
        title={`Pilih ${title}`}
      />
      {editableContent}
    </div>
  );
}

export function FormSection({
  title,
  helper,
  action,
  children,
  className,
  contentClassName,
  presentation = "grouped",
}: {
  readonly title?: string;
  readonly helper?: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly presentation?: Exclude<FormPresentation, "standalone"> | "plain" | "embedded";
}): React.JSX.Element {
  const grouped = presentation === "grouped" || presentation === "embedded";
  const hasHeader = Boolean(title || helper || action);

  return (
    <section className={cx("min-w-0 space-y-2.5", className)}>
      {hasHeader ? (
        <div className="flex min-w-0 items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            {title ? (
              <h3 className="truncate text-meta font-bold tracking-[0.11em] text-on-surface uppercase">
                {title}
              </h3>
            ) : null}
            {helper ? (
              <p className="mt-0.5 line-clamp-2 text-meta text-on-surface-variant">{helper}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <FormPresentationProvider presentation={grouped ? "grouped" : "standalone"}>
        <div
          className={cx(
            presentation === "embedded"
              ? "min-w-0 divide-y divide-outline-variant/20"
              : grouped
                ? "min-w-0 divide-y divide-outline-variant/20 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle"
                : "space-y-2.5",
            contentClassName,
          )}
        >
          {children}
        </div>
      </FormPresentationProvider>
    </section>
  );
}

export function MicroStatusDock({
  items,
}: {
  readonly items: readonly MicroStatusItem[];
}): React.JSX.Element {
  const visibleItems = items.slice(0, 3);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-surface-container-low px-3 py-2 text-meta ring-1 ring-ring-subtle">
      {visibleItems.map((item, index) => {
        const tone = item.tone ?? "default";
        const renderedValue =
          typeof item.amount === "number" ? formatShortIdr(item.amount) : (item.value ?? "-");

        return (
          <span
            key={`${item.label}-${index}`}
            className="inline-flex max-w-full min-w-0 items-baseline gap-1.5"
          >
            <span
              className={cx("h-1.5 w-1.5 shrink-0 self-center rounded-full", dotClass[tone])}
              aria-hidden="true"
            />
            <span className="shrink-0 font-bold tracking-wide text-on-surface-variant uppercase">
              {item.label}
            </span>
            <span className={cx("min-w-0 font-semibold wrap-break-word", textClass[tone])}>
              {renderedValue}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function FieldContextLine({
  children,
  tone = "default",
}: {
  readonly children: React.ReactNode;
  readonly tone?: FormRiskTone;
}): React.JSX.Element {
  // Di dalam FormSection bergaya `grouped`, baris ini menjadi anak langsung
  // kartu ber-`rounded-3xl overflow-hidden`. Tanpa padding baris, huruf pertama
  // dan terakhir tertelan lengkung sudut kartu — terlihat pada langkah tinjau
  // Penerimaan kas termin, Mutasi rekening, dan Transfer antar rekening.
  // Padding-nya disamakan dengan baris grouped lain (`px-5`).
  const grouped = useFormPresentation() === "grouped";
  return (
    <p className={cx("min-w-0 text-meta font-medium", grouped && "px-5 py-2.5", textClass[tone])}>
      {children}
    </p>
  );
}

export function SmartDefaultHint({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="min-w-0 px-5 py-2.5">
      {/* Padding baris sudah disediakan pembungkus ini, jadi presentasi
          dikembalikan ke standalone agar tidak ter-padding dua kali. */}
      <FormPresentationProvider presentation="standalone">
        <FieldContextLine tone="success">Default: {children}</FieldContextLine>
      </FormPresentationProvider>
    </div>
  );
}

export function InlineReviewStrip({
  items,
}: {
  readonly items: readonly MicroStatusItem[];
  readonly compact?: boolean;
}): React.JSX.Element {
  return <MicroStatusDock items={items} />;
}

export const GuidedFormSheet = OperationalFormSheet;
export const GuidedFormSection = FormSection;

export function WorkflowFormSheet({
  open,
  title,
  children,
  primaryLabel,
  secondaryLabel,
  pendingLabel = "Memproses…",
  pending = false,
  disabled = false,
  secondaryDisabled = false,
  disabledReason,
  statusText,
  statusTone = "default",
  danger = false,
  onClose,
  onExitComplete,
  onPrimary,
  onSecondary,
  dismissal,
  initialExpanded,
  desktopSize,
  desktopFooterPlacement,
  desktopAsideSummary,
  sizing,
  contentKey,
  returnFocusRef,
  fallbackFocusRef,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly primaryLabel: string;
  readonly secondaryLabel?: string;
  readonly pendingLabel?: string;
  readonly pending?: boolean;
  readonly disabled?: boolean;
  readonly secondaryDisabled?: boolean;
  readonly disabledReason?: string;
  readonly statusText?: string;
  readonly statusTone?: FormRiskTone;
  readonly danger?: boolean;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
  readonly onPrimary: () => void;
  readonly onSecondary?: () => void;
  readonly dismissal: FormSheetDismissal;
  readonly initialExpanded?: boolean;
  readonly desktopSize?: "standard" | "wide";
  readonly desktopFooterPlacement?: "bottom" | "aside";
  readonly desktopAsideSummary?: React.ReactNode;
  readonly sizing?: "content" | "maximum";
  readonly contentKey?: string;
  readonly returnFocusRef?: React.RefObject<HTMLElement | null>;
  readonly fallbackFocusRef?: React.RefObject<HTMLElement | null>;
}): React.JSX.Element {
  return (
    <FormSheet
      open={open}
      title={title}
      dismissal={dismissal}
      pending={pending}
      initialExpanded={initialExpanded}
      desktopSize={desktopSize}
      desktopFooterPlacement={desktopFooterPlacement}
      desktopAsideSummary={desktopAsideSummary}
      sizing={sizing}
      contentKey={contentKey}
      onClose={onClose}
      onExitComplete={onExitComplete}
      returnFocusRef={returnFocusRef}
      fallbackFocusRef={fallbackFocusRef}
      footer={
        <SheetFooterActions
          desktopStacked={desktopFooterPlacement === "aside"}
          status={
            statusText ? (
              <p
                className={cx("text-support font-medium", textClass[statusTone])}
                role={statusTone === "danger" ? "alert" : "status"}
              >
                {statusText}
              </p>
            ) : undefined
          }
          disabledReason={disabledReason}
          secondary={
            secondaryLabel && onSecondary
              ? {
                  label: secondaryLabel,
                  onClick: onSecondary,
                  disabled: pending || secondaryDisabled,
                }
              : undefined
          }
          primary={{
            label: primaryLabel,
            pendingLabel,
            pending,
            disabled,
            onClick: onPrimary,
            variant: danger ? "critical" : "primary",
          }}
        />
      }
    >
      <FormSheetPresentationBoundary>{children}</FormSheetPresentationBoundary>
    </FormSheet>
  );
}

export function OptionChoiceGroup<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: TValue;
  readonly options: readonly {
    readonly value: TValue;
    readonly label: string;
    readonly description?: string;
  }[];
  readonly onChange: (value: TValue) => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  return (
    /*
     * `min-w-0` wajib di sini, bukan kosmetik.
     *
     * `fieldset` bawaan browser punya `min-inline-size: min-content`, dan
     * deskripsi pilihan memakai `truncate` (`white-space: nowrap`) — sehingga
     * min-content-nya menjadi selebar teks utuh. Tanpa ini, satu deskripsi
     * panjang melebarkan grup melewati sheet pada layar 320–390 px alih-alih
     * terpotong seperti yang dijanjikan `truncate`.
     */
    <fieldset className="min-w-0 space-y-2 rounded-2xl bg-surface-container-low">
      <p className="px-3 pt-3 text-xs font-semibold text-on-surface">{label}</p>
      <div className="space-y-2 px-2 pb-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <motion.button
              key={option.value}
              type="button"
              whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
              transition={transitionSpringSnappy}
              onClick={() => onChange(option.value)}
              className={cx(
                "flex min-h-12 w-full items-center gap-3 rounded-full bg-surface-container-lowest px-5 text-left shadow-control ring-1 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:z-10 active:shadow-raised",
                selected
                  ? "bg-primary/10 text-primary ring-primary/10"
                  : "bg-surface-container-low text-on-surface ring-ring-control",
              )}
              aria-pressed={selected}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-5 font-bold">{option.label}</span>
                {option.description ? (
                  <span className="block truncate text-support text-on-surface-variant">
                    {option.description}
                  </span>
                ) : null}
              </span>
              <span
                className={cx(
                  "h-4 w-4 shrink-0 rounded-full ring-2 ring-inset",
                  selected ? "bg-primary ring-primary" : "ring-ring-control",
                )}
                aria-hidden="true"
              />
            </motion.button>
          );
        })}
      </div>
    </fieldset>
  );
}
