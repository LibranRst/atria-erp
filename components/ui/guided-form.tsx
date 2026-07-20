"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { BottomSheet, SheetActionButton } from "./bottom-sheet";
import { cx } from "./form-control-utils";
import {
  type FormPresentation,
  FormPresentationProvider,
} from "./form-presentation-context";
import type { FormRiskTone } from "./form-support";
import { formatShortIdr } from "@/lib/utils/money";
import {
  transitionEaseSmooth,
  transitionSpringSnappy,
} from "@/lib/utils/motion";

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
  return (
    <FormPresentationProvider presentation="standalone">
      {children}
    </FormPresentationProvider>
  );
}

export function OperationalFormSheet({
  open,
  title,
  children,
  submitLabel,
  submittingLabel,
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
  actionPlacement = "footer",
  onClose,
  onExitComplete,
  onSubmit,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly submitLabel: string;
  readonly submittingLabel?: string;
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
  readonly actionPlacement?: "header" | "footer";
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
  readonly onSubmit?: () => void;
}): React.JSX.Element {
  const submitAction =
    hideSubmit || actionPlacement === "header" ? null : (
      <motion.button
        type={formId ? "submit" : "button"}
        form={formId}
        whileTap={{ scale: 0.97 }}
        transition={transitionSpringSnappy}
        disabled={pending || disabled}
        onClick={formId ? undefined : onSubmit}
        className={cx(
          "min-h-12 w-full rounded-full px-5 text-sm font-bold text-white outline-none focus-visible:ring-2 disabled:opacity-45",
          danger
            ? "bg-error focus-visible:ring-error/30"
            : "bg-primary focus-visible:ring-primary/30",
        )}
      >
        {pending ? (submittingLabel ?? "Memproses…") : submitLabel}
      </motion.button>
    );
  const footerContent =
    statusText ||
    (statusItems && statusItems.length > 0) ||
    review ||
    disabledReason ||
    submitAction ? (
      <div className="space-y-2">
        {statusText ? (
          <p
            className={cx(
              "px-1 text-[11px] font-medium leading-4",
              textClass[statusTone],
            )}
            role={statusTone === "danger" ? "alert" : "status"}
          >
            {statusText}
          </p>
        ) : statusItems && statusItems.length > 0 ? (
          <MicroStatusDock items={statusItems} />
        ) : review ? (
          review
        ) : null}
        {disabledReason ? (
          <p className="px-1 text-[10px] font-medium leading-4 text-on-surface-variant">
            {disabledReason}
          </p>
        ) : null}
        {submitAction}
      </div>
    ) : undefined;

  return (
    <BottomSheet
      open={open}
      title={title}
      action={
        action ??
        (actionPlacement === "header" && !hideSubmit ? (
          <SheetActionButton
            label={submitLabel}
            pendingLabel={submittingLabel}
            pending={pending}
            disabled={disabled}
            danger={danger}
            form={formId}
            type={formId ? "submit" : "button"}
            onClick={formId ? undefined : onSubmit}
          />
        ) : undefined)
      }
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
    </BottomSheet>
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
          "flex w-full items-center text-left outline-none ring-1 focus-visible:ring-2 focus-visible:ring-primary/30",
          compact
            ? "min-h-12 gap-2.5 rounded-[22px] bg-surface-container-lowest px-3 py-2.5 shadow-[0_8px_24px_rgba(17,17,17,0.035)]"
            : "min-h-14 gap-3 rounded-full px-3.5 py-2.5",
          compact
            ? expanded
              ? "text-on-surface ring-primary/18"
              : "text-on-surface ring-outline-variant/15"
            : expanded
              ? "bg-primary/7 text-primary ring-primary/20"
              : "bg-surface-container-low text-on-surface ring-outline-variant/15",
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
              className={cx(
                "truncate text-xs font-bold",
                compact ? "leading-[1.15]" : "leading-4",
              )}
            >
              {title}
            </span>
            {summary ? (
              <span
                className={cx(
                  "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold leading-[1.1]",
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
                "mt-0.5 block truncate text-[10px] text-on-surface-variant",
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
            "material-symbols-outlined shrink-0 text-on-surface-variant",
            compact ? "text-[18px]" : "text-[20px]",
          )}
          aria-hidden="true"
        >
          expand_more
        </motion.span>
      </motion.button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitionEaseSmooth}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

export type CompactEditableItemStatus =
  "complete" | "warning" | "danger" | "neutral";

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
      className="flex min-h-16 w-full items-center gap-3 rounded-[22px] bg-surface-container-low/70 px-4 py-2.5 text-left outline-none ring-1 ring-outline-variant/15 focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-45"
      aria-label={`${title}. ${statusLabel}. ${meta}`}
    >
      <span
        className={cx(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          compactStatusClass[status],
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold leading-4 text-on-surface">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[10px] leading-4 text-on-surface-variant">
          {meta} · {statusLabel}
        </span>
      </span>
      {value ? (
        <span className="max-w-[36%] shrink-0 truncate text-right text-xs font-bold tabular-nums text-on-surface">
          {value}
        </span>
      ) : null}
      <span
        className="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant"
        aria-hidden="true"
      >
        chevron_right
      </span>
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
  readonly title: string;
  readonly helper?: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly presentation?: Exclude<FormPresentation, "standalone"> | "plain";
}): React.JSX.Element {
  const grouped = presentation === "grouped";
  return (
    <section className={cx("min-w-0 space-y-2.5", className)}>
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface">
            {title}
          </h3>
          {helper ? (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-on-surface-variant">
              {helper}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <FormPresentationProvider
        presentation={grouped ? "grouped" : "standalone"}
      >
        <div
          className={cx(
            grouped
              ? "min-w-0 divide-y divide-outline-variant/20 overflow-hidden rounded-[24px] bg-surface-container-lowest shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15"
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
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-surface-container-low px-3 py-2 text-[10px] leading-4 ring-1 ring-outline-variant/10">
      {visibleItems.map((item, index) => {
        const tone = item.tone ?? "default";
        const renderedValue =
          typeof item.amount === "number"
            ? formatShortIdr(item.amount)
            : (item.value ?? "-");

        return (
          <span
            key={`${item.label}-${index}`}
            className="inline-flex min-w-0 max-w-full items-baseline gap-1.5"
          >
            <span
              className={cx(
                "h-1.5 w-1.5 shrink-0 self-center rounded-full",
                dotClass[tone],
              )}
              aria-hidden="true"
            />
            <span className="shrink-0 font-bold uppercase tracking-wide text-on-surface-variant">
              {item.label}
            </span>
            <span
              className={cx(
                "min-w-0 break-words font-semibold",
                textClass[tone],
              )}
            >
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
  return (
    <p
      className={cx(
        "min-w-0 text-[10px] font-medium leading-4",
        textClass[tone],
      )}
    >
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
      <FieldContextLine tone="success">Default: {children}</FieldContextLine>
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
  actionLayout = "split",
  onClose,
  onExitComplete,
  onPrimary,
  onSecondary,
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
  readonly actionLayout?: "split" | "stacked";
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
  readonly onPrimary: () => void;
  readonly onSecondary?: () => void;
}): React.JSX.Element {
  const blocked = pending || disabled;

  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={onClose}
      onExitComplete={onExitComplete}
      footer={
        <div className="space-y-1">
          {statusText ? (
            <p
              className={cx(
                "px-1 text-[11px] font-medium leading-4",
                textClass[statusTone],
              )}
              role={statusTone === "danger" ? "alert" : "status"}
            >
              {statusText}
            </p>
          ) : null}
          {disabledReason ? (
            <p className="px-1 text-[11px] leading-4 text-on-surface-variant">
              {disabledReason}
            </p>
          ) : null}
          <div
            className={cx(
              "grid gap-2 mt-2",
              secondaryLabel && actionLayout === "split"
                ? "grid-cols-[0.8fr_1.2fr]"
                : "grid-cols-1",
            )}
          >
            {secondaryLabel && onSecondary ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                onClick={onSecondary}
                disabled={pending || secondaryDisabled}
                className="min-h-12 rounded-full bg-surface-container px-5 text-sm font-bold text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-45"
              >
                {secondaryLabel}
              </motion.button>
            ) : null}
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={onPrimary}
              disabled={blocked}
              className={cx(
                "min-h-12 rounded-full px-5 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-45",
                danger ? "bg-error" : "bg-primary",
              )}
            >
              {pending ? pendingLabel : primaryLabel}
            </motion.button>
          </div>
        </div>
      }
    >
      <FormSheetPresentationBoundary>{children}</FormSheetPresentationBoundary>
    </BottomSheet>
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
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-on-surface">{label}</legend>
      <div className="space-y-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <motion.button
              key={option.value}
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => onChange(option.value)}
              className={cx(
                "flex min-h-12 w-full items-center gap-3 rounded-full px-5 text-left outline-none ring-1 focus-visible:ring-2 focus-visible:ring-primary/30",
                selected
                  ? "bg-primary/10 text-primary ring-primary/35"
                  : "bg-surface-container-low text-on-surface ring-outline-variant/20",
              )}
              aria-pressed={selected}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-5">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="block truncate text-[11px] leading-4 text-on-surface-variant">
                    {option.description}
                  </span>
                ) : null}
              </span>
              <span
                className={cx(
                  "h-4 w-4 shrink-0 rounded-full ring-2 ring-inset",
                  selected ? "bg-primary ring-primary" : "ring-outline-variant",
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
