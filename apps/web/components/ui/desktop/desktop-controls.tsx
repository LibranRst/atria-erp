"use client";

import React from "react";
import {
  Button as HeroButton,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
  type ButtonProps as HeroButtonProps,
  type Key,
  type TextFieldProps,
} from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import { buttonTapActiveScale, transitionSpringSnappy } from "@/lib/utils/motion";
import type { ButtonSize, ButtonVariant } from "../button/button";
import { AppIcon } from "../icon/app-icon";
import { cx } from "../form/form-control-utils";
import { useOverlayLayers } from "../overlay/overlay-layer-context";

const MotionHeroButton = motion.create(HeroButton);

export type DesktopButtonProps = Omit<
  HeroButtonProps,
  | "variant"
  | "size"
  | "className"
  | "children"
  | "onClick"
  | "onFocus"
  | "onBlur"
  | "onHoverStart"
  | "onHoverEnd"
  | "onAnimationStart"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "style"
> & {
  readonly style?: React.CSSProperties;
  readonly title?: string;
  readonly role?: React.AriaRole;
  readonly tabIndex?: number;
  readonly onClick?: React.MouseEventHandler<HTMLButtonElement>;
  readonly onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  readonly onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  readonly children?: React.ReactNode;
  readonly className?: string;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly disabled?: boolean;
  readonly pending?: boolean;
  readonly pendingLabel?: string;
};

export function DesktopButton({
  children,
  className,
  variant = "primary",
  size = "default",
  disabled,
  pending,
  pendingLabel = "Memproses…",
  isDisabled,
  isPending,
  fullWidth,
  id,
  onClick,
  onFocus,
  onBlur,
  type = "button",
  ...props
}: DesktopButtonProps): React.JSX.Element {
  const generatedId = React.useId();
  const reducedMotion = useReducedMotion();
  const busy = pending || isPending;
  return (
    <MotionHeroButton
      whileTap={{
        scale: reducedMotion || disabled || isDisabled || busy ? 1 : buttonTapActiveScale,
      }}
      transition={transitionSpringSnappy}
      {...props}
      id={id ?? `desktop-button-${generatedId}`}
      onClick={
        onClick
          ? (event): void => {
              const currentTarget = event.currentTarget;
              if (currentTarget instanceof HTMLButtonElement)
                onClick(Object.assign(event, { currentTarget }));
            }
          : undefined
      }
      onFocus={
        onFocus
          ? (event): void => {
              const currentTarget = event.currentTarget,
                target = event.target;
              if (currentTarget instanceof HTMLButtonElement && target instanceof HTMLButtonElement)
                onFocus(Object.assign(event, { currentTarget, target }));
            }
          : undefined
      }
      onBlur={
        onBlur
          ? (event): void => {
              const currentTarget = event.currentTarget,
                target = event.target;
              if (currentTarget instanceof HTMLButtonElement && target instanceof HTMLButtonElement)
                onBlur(Object.assign(event, { currentTarget, target }));
            }
          : undefined
      }
      type={type}
      variant="primary"
      data-atria-variant={variant}
      isDisabled={disabled || isDisabled || busy}
      isPending={busy}
      fullWidth={fullWidth}
      className={cx("atria-desktop-button", size === "default" ? "text-sm" : "text-xs", className)}
    >
      {busy ? pendingLabel : children}
    </MotionHeroButton>
  );
}

export type DesktopInputProps = Omit<TextFieldProps, "children" | "className"> & {
  readonly label: string;
  readonly placeholder?: string;
  readonly description?: string;
  readonly error?: string;
  readonly className?: string;
};

/** React Aria owns label/input/error association; no separate focus implementation. */
export function DesktopInput({
  label,
  placeholder,
  description,
  error,
  className,
  isInvalid,
  ...props
}: DesktopInputProps): React.JSX.Element {
  return (
    <TextField {...props} isInvalid={Boolean(error) || isInvalid} fullWidth className={className}>
      <Label>{label}</Label>
      <Input placeholder={placeholder} className="atria-desktop-input" />
      {description ? <Description>{description}</Description> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </TextField>
  );
}

export type DesktopSelectOption = {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly meta?: string;
  readonly disabledReason?: string;
  readonly disabled?: boolean;
};

export type DesktopSelectProps = {
  readonly id?: string;
  readonly emptyText?: string;
  readonly label: string;
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly options: readonly DesktopSelectOption[];
  readonly placeholder?: string;
  readonly name?: string;
  readonly description?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly className?: string;
};

export function DesktopSelect({
  id,
  emptyText = "Tidak ada opsi.",
  label,
  value,
  onChange,
  options,
  placeholder = "Pilih",
  name,
  description,
  error,
  disabled,
  required,
  className,
}: DesktopSelectProps): React.JSX.Element {
  const layers = useOverlayLayers();
  return (
    <Select<DesktopSelectOption>
      fullWidth
      className={className}
      name={name}
      value={value}
      onChange={(key: Key | null): void => onChange(key === null ? null : String(key))}
      placeholder={placeholder}
      isDisabled={disabled}
      isRequired={required}
      isInvalid={Boolean(error)}
    >
      <Label>{label}</Label>
      <Select.Trigger id={id} className="atria-desktop-select-trigger">
        <Select.Value />
        <Select.Indicator>
          <AppIcon name="expand_more" aria-hidden="true" />
        </Select.Indicator>
      </Select.Trigger>
      {description ? <Description>{description}</Description> : null}
      {error ? <FieldError>{error}</FieldError> : null}
      <Select.Popover style={{ zIndex: layers.anchored }}>
        <ListBox
          items={options}
          renderEmptyState={() => (
            <span className="px-4 py-3 text-support text-muted">{emptyText}</span>
          )}
          disabledKeys={options
            .filter((option: DesktopSelectOption): boolean => Boolean(option.disabled))
            .map((option: DesktopSelectOption): string => option.value)}
        >
          {(option: DesktopSelectOption): React.JSX.Element => (
            <ListBox.Item id={option.value} textValue={option.label}>
              <div className="min-w-0">
                <Label>{option.label}</Label>
                {option.description || option.meta || option.disabledReason ? (
                  <Description>
                    {[option.description, option.meta, option.disabledReason]
                      .filter(Boolean)
                      .join(" · ")}
                  </Description>
                ) : null}
              </div>
              <ListBox.ItemIndicator>
                <AppIcon name="check" aria-hidden="true" />
              </ListBox.ItemIndicator>
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
