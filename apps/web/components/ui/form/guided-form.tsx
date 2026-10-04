"use client";

import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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
import { buttonTapActiveScale, transitionEaseSmooth, transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui/icon/app-icon";

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
  readonly variant?: "default" | "compact";
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const compact = variant === "compact";

  return (
    <section className={cx("min-w-0", compact ? "space-y-2.5" : "space-y-3")}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        transition={transitionSpringSnappy}
        onClick={onToggle}
        className={cx(
          "flex w-full items-center text-left ring-1 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          compact
            ? "min-h-12 gap-2.5 rounded-[22px] bg-surface-container-lowest px-3 py-2.5 shadow-surface"
            : "min-h-14 gap-3 rounded-full px-3.5 py-2.5",
          compact
            ? expanded
              ? "text-on-surface ring-primary/18"
              : "text-on-surface ring-ring-subtle"
            : expanded
              ? "bg-primary/7 text-primary ring-primary/20"
              : "bg-surface-container-low text-on-surface ring-ring-subtle",
        )}
        aria-expanded={expanded}
      >
        {icon ? (
          <span
            className={cx(
              "flex shrink-0 items-center justify-center rounded-full",
              compact ? "h-8 w-8" : "h-10 w-10",
              expanded
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
              className={cx("truncate text-xs font-bold", compact ? "leading-[1.15]" : "leading-4")}
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
          transition={transitionSpringSnappy}
          className={cx(
            "flex shrink-0 items-center justify-center text-on-surface-variant",
            compact ? "icon-md" : "icon-lg",
          )}
          aria-hidden="true"
        >
          <AppIcon name="expand_more" className="h-full w-full" />
        </motion.span>
      </motion.button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0, overflow: "hidden" }}
            animate={{
              opacity: 1,
              height: "auto",
              transitionEnd: { overflow: "visible" },
            }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={transitionEaseSmooth}
            className="min-w-0"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
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
  title,
  meta,
  value,
  disabled = false,
  onClick,
}: {
  readonly status: CompactEditableItemStatus;
  readonly title: string;
  readonly meta: string;
  readonly value?: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}): React.JSX.Element {
  const statusLabel =
    status === "complete"
      ? "Lengkap"
      : status === "warning"
        ? "Perlu diperiksa"
        : status === "danger"
          ? "Bermasalah"
          : "Belum diisi";

  return (
    <motion.button
      type="button"
      layout
      whileTap={{ scale: 0.985 }}
      transition={transitionSpringSnappy}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 rounded-[22px] bg-surface-container-low/70 px-4 py-2.5 text-left ring-1 ring-ring-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-45"
      aria-label={`${title}. ${statusLabel}. ${meta}`}
    >
      <span
        className={cx("h-2.5 w-2.5 shrink-0 rounded-full", compactStatusClass[status])}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs leading-4 font-bold text-on-surface">{title}</span>
        <span className="mt-0.5 block truncate text-meta text-on-surface-variant">
          {meta} · {statusLabel}
        </span>
      </span>
      {value ? (
        <span className="max-w-[36%] shrink-0 truncate text-right text-xs font-bold text-on-surface tabular-nums">
          {value}
        </span>
      ) : null}
      <AppIcon name="chevron_right" className="icon-md shrink-0 text-on-surface-variant" />
    </motion.button>
  );
}

export function FormSection({
  title,
  helper,
  action,
  children,
  className,
  presentation = "grouped",
}: {
  readonly title?: string;
  readonly helper?: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly presentation?: Exclude<FormPresentation, "standalone"> | "plain";
}): React.JSX.Element {
  const grouped = presentation === "grouped";
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
            grouped
              ? "min-w-0 divide-y divide-outline-variant/20 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle"
              : "space-y-2.5",
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
}): React.JSX.Element {
  return (
    <FormSheet
      open={open}
      title={title}
      dismissal={dismissal}
      pending={pending}
      onClose={onClose}
      onExitComplete={onExitComplete}
      footer={
        <SheetFooterActions
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
                "flex min-h-12 w-full items-center gap-3 rounded-xl bg-surface-container-lowest px-5 text-left ring-1 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:shadow-raised active:z-10",
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
