"use client";

import React from "react";

import { AppIcon } from "../icon/app-icon";
import { Button } from "../button/button";
import { DialogFrame, type DialogMorphOrigin } from "./dialog-frame";
import { SheetFooterActions } from "./sheet-footer-actions";

type DialogShellProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly pending?: boolean;
  readonly children: React.ReactNode;
  readonly onClose: () => void;
};

export type { DialogMorphOrigin } from "./dialog-frame";

export function MorphDetailDialog({
  open,
  present,
  title,
  headerAction,
  bodyHeader,
  morphOrigin,
  morphClosedContent,
  returnFocusRef,
  children,
  onClose,
  onExitComplete,
}: {
  readonly open: boolean;
  readonly present: boolean;
  readonly title: string;
  readonly headerAction?: React.ReactNode;
  readonly bodyHeader?: React.ReactNode;
  readonly morphOrigin?: DialogMorphOrigin | null;
  readonly morphClosedContent?: React.ReactNode;
  readonly returnFocusRef?: React.RefObject<HTMLElement | null>;
  readonly children: React.ReactNode;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
}): React.JSX.Element {
  return (
    <DialogFrame
      presentation="choice"
      open={open}
      morphPresent={present}
      title={title}
      placement="top"
      topInset="header"
      showCloseButton={false}
      headerAction={headerAction}
      bodyHeader={bodyHeader}
      morphOrigin={morphOrigin}
      morphClosedContent={morphClosedContent}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
      onExitComplete={onExitComplete}
    >
      {children}
    </DialogFrame>
  );
}

export function CompactFormDialog({
  open,
  title,
  description,
  pending,
  children,
  actions,
  showCloseButton = false,
  onClose,
}: DialogShellProps & {
  readonly actions: React.ReactNode;
  readonly showCloseButton?: boolean;
}): React.JSX.Element {
  return (
    <DialogFrame
      open={open}
      title={title}
      description={description}
      pending={pending}
      showCloseButton={showCloseButton}
      footer={actions}
      onClose={onClose}
    >
      {children}
    </DialogFrame>
  );
}

export function SelectionDialog(props: DialogShellProps): React.JSX.Element {
  return <DialogFrame {...props} presentation="choice" />;
}

export function SearchDialog({
  open,
  title,
  description,
  pending,
  query,
  onQueryChange,
  searchPlaceholder = "Cari...",
  clearLabel = "Bersihkan pencarian",
  onSearchKeyDown,
  children,
  footer,
  onClose,
}: DialogShellProps & {
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly searchPlaceholder?: string;
  readonly clearLabel?: string;
  readonly onSearchKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  readonly footer?: React.ReactNode;
}): React.JSX.Element {
  return (
    <DialogFrame
      open={open}
      title={title}
      description={description}
      pending={pending}
      placement="top"
      presentation="choice"
      showCloseButton={false}
      detachedCloseButton
      utility={
        <div className="flex min-h-12 items-center gap-2 rounded-full bg-white px-4 shadow-raised ring-1 ring-ring-control focus-within:ring-2 focus-within:ring-focus-ring">
          <AppIcon name="search" className="icon-sm shrink-0 text-on-surface-variant" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoFocus
            data-dialog-autofocus="true"
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-on-surface outline-none placeholder:text-on-surface-variant/55 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant after:absolute after:-inset-2 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
              aria-label={clearLabel}
            >
              <AppIcon name="close" className="icon-sm" />
            </button>
          ) : null}
        </div>
      }
      footer={footer}
      onClose={onClose}
    >
      {children}
    </DialogFrame>
  );
}

export { CalendarDialog, type CalendarDialogProps } from "./calendar-dialog";

export type SuccessFact = {
  readonly label: string;
  readonly value: string;
};

export const SUCCESS_DIALOG_FACT_LIMIT = 4;

export function SuccessDialog({
  open,
  title,
  description,
  facts,
  primaryLabel = "Selesai",
  secondaryLabel,
  tertiaryLabel,
  onClose,
  onPrimary,
  onSecondary,
  onTertiary,
  onExitComplete,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly facts: readonly SuccessFact[];
  readonly primaryLabel?: string;
  readonly secondaryLabel?: string;
  readonly tertiaryLabel?: string;
  readonly onClose: () => void;
  readonly onPrimary?: () => void;
  readonly onSecondary?: () => void;
  readonly onTertiary?: () => void;
  readonly onExitComplete?: () => void;
}): React.JSX.Element {
  if (facts.length > SUCCESS_DIALOG_FACT_LIMIT) {
    throw new RangeError(`SuccessDialog menerima maksimal ${SUCCESS_DIALOG_FACT_LIMIT} fakta.`);
  }

  const primaryAction = onPrimary ?? onClose;
  return (
    <DialogFrame
      open={open}
      onExitComplete={onExitComplete}
      title={title}
      description={description}
      align="center"
      icon={<AppIcon name="check_circle" className="icon-xl" aria-hidden="true" />}
      showCloseButton={false}
      footer={
        secondaryLabel && onSecondary ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={onSecondary}>
                {secondaryLabel}
              </Button>
              <Button onClick={primaryAction}>{primaryLabel}</Button>
            </div>
            {tertiaryLabel && onTertiary ? (
              <Button variant="tertiary" fullWidth onClick={onTertiary}>
                {tertiaryLabel}
              </Button>
            ) : null}
          </div>
        ) : (
          <Button fullWidth onClick={primaryAction}>
            {primaryLabel}
          </Button>
        )
      }
      onClose={onClose}
    >
      {facts.length > 0 ? (
        <dl className="divide-y divide-outline-variant/15 overflow-hidden rounded-inset bg-white px-4 text-left ring-1 ring-ring-subtle">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-start justify-between gap-4 py-3.5">
              <dt className="text-support font-medium text-on-surface-variant">{fact.label}</dt>
              <dd className="text-right text-support font-bold text-on-surface">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </DialogFrame>
  );
}

export type ConfirmationDialogTone = "default" | "warning" | "danger";

type ConfirmationDialogCommonProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly tone?: ConfirmationDialogTone;
  readonly pending?: boolean;
  readonly children?: React.ReactNode;
  readonly onClose: () => void;
};

type ConfirmationDialogCustomActions = ConfirmationDialogCommonProps & {
  readonly actions: React.ReactNode;
};

type ConfirmationDialogStandardActions = ConfirmationDialogCommonProps & {
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly actionLayout?: "columns" | "adaptive";
};

export type ConfirmationDialogProps =
  ConfirmationDialogCustomActions | ConfirmationDialogStandardActions;

export function ConfirmationDialog(props: ConfirmationDialogProps): React.JSX.Element {
  const danger = "danger" in props && Boolean(props.danger);
  const tone = danger ? "danger" : (props.tone ?? "default");
  const iconName = tone === "default" ? "check" : "warning";
  const footer: React.ReactNode =
    "confirmLabel" in props ? (
      <SheetFooterActions
        layout={props.actionLayout}
        secondary={{
          label: "Batal",
          onClick: props.onClose,
          disabled: props.pending,
          variant: props.actionLayout === "adaptive" ? "quiet" : "secondary",
        }}
        primary={{
          label: props.confirmLabel,
          pending: props.pending,
          disabled: props.disabled,
          onClick: props.onConfirm,
          variant: danger ? "critical" : "primary",
        }}
      />
    ) : (
      props.actions
    );

  return (
    <DialogFrame
      open={props.open}
      title={props.title}
      description={props.description}
      pending={props.pending}
      role="alertdialog"
      align="center"
      tone={tone === "danger" ? "critical" : tone}
      icon={<AppIcon name={iconName} className="icon-xl" aria-hidden="true" />}
      showCloseButton={false}
      footer={footer}
      onClose={props.onClose}
    >
      {props.children ? (
        <div className="rounded-inset bg-white p-4 ring-1 ring-ring-subtle">{props.children}</div>
      ) : null}
    </DialogFrame>
  );
}
