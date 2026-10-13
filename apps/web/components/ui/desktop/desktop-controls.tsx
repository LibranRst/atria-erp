"use client";

import React from "react";
import {
  Button as HeroButton,
  Switch as HeroSwitch,
  Description,
  FieldError,
  Header,
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
import { buttonVariants } from "@heroui/styles";
import { buttonTapActiveScale, transitionSpringSnappy } from "@/lib/utils/motion";
import type { ButtonSize, ButtonVariant } from "../button/button";
import { AppIcon } from "../icon/app-icon";
import { cx } from "../form/form-control-utils";
import { useOverlayLayers } from "../overlay/overlay-layer-context";
import {
  DesktopPopoverBoundary,
  useDesktopPopoverMotion,
  useDesktopSelectPopover,
} from "./desktop-popover-motion";
import { DesktopSearchSelect } from "./desktop-search-select";

const MotionHeroButton = motion.create(HeroButton);
const MotionHeroSwitchThumb = motion.create(HeroSwitch.Thumb);

/** FLIP follows HeroUI's size/RTL layout; Atria owns the motion after CSS transitions are scoped out. */
export function DesktopSwitchThumb({ checked }: { readonly checked: boolean }): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  return (
    <MotionHeroSwitchThumb
      initial={false}
      layout={reducedMotion ? false : "position"}
      layoutDependency={checked}
      transition={reducedMotion ? { duration: 0 } : transitionSpringSnappy}
    />
  );
}

// Native field semantics are composed by shared FormField; Hero imports stay here.
export {
  Input as DesktopInputControl,
  TextArea as DesktopTextAreaControl,
  Switch as DesktopSwitchControl,
} from "@heroui/react";

/** Shared sizes retain their meaning while desktop uses HeroUI's native density. */
export const desktopButtonSize: Record<ButtonSize, "sm" | "md"> = {
  default: "md",
  compact: "sm",
  mini: "sm",
};
export const desktopButtonVariant: Record<ButtonVariant, HeroButtonProps["variant"]> = {
  primary: "primary",
  secondary: "secondary",
  tertiary: "tertiary",
  quiet: "tertiary",
  critical: "danger",
  criticalQuiet: "danger-soft",
};

export function desktopButtonClasses({
  variant,
  size,
  className,
  isIconOnly,
}: {
  readonly variant: ButtonVariant;
  readonly size: ButtonSize;
  readonly className?: string;
  readonly isIconOnly?: boolean;
}): string {
  return buttonVariants({
    variant: desktopButtonVariant[variant],
    size: desktopButtonSize[size],
    isIconOnly,
    className: cx("atria-desktop-button", className),
  });
}

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
  const [pressed, setPressed] = React.useState(false);
  const busy = pending || isPending;
  const pressBlocked =
    disabled ||
    isDisabled ||
    busy ||
    props["aria-disabled"] === true ||
    props["aria-disabled"] === "true";
  return (
    <MotionHeroButton
      {...props}
      animate={{ scale: reducedMotion || pressBlocked || !pressed ? 1 : buttonTapActiveScale }}
      whileTap={{ scale: reducedMotion || pressBlocked ? 1 : buttonTapActiveScale }}
      transition={reducedMotion ? { duration: 0 } : transitionSpringSnappy}
      onPressStart={(event): void => {
        setPressed(true);
        props.onPressStart?.(event);
      }}
      onPressEnd={(event): void => {
        setPressed(false);
        props.onPressEnd?.(event);
      }}
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
      variant={desktopButtonVariant[variant]}
      size={desktopButtonSize[size]}
      data-atria-variant={variant}
      data-atria-size={size}
      isDisabled={disabled || isDisabled || busy}
      isPending={busy}
      fullWidth={fullWidth}
      className={cx("atria-desktop-button", fullWidth && "w-full", className)}
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

export function desktopOptionGroups(options: readonly DesktopSelectOption[]): readonly {
  readonly label: string;
  readonly options: readonly DesktopSelectOption[];
}[] {
  const groups = new Map<string, DesktopSelectOption[]>();
  for (const option of options) {
    const key = option.group ?? "";
    const items = groups.get(key) ?? [];
    items.push(option);
    groups.set(key, items);
  }
  return Array.from(groups, ([label, items]) => ({ label, options: items }));
}

export function DesktopSelectOptionContent({
  option,
}: {
  readonly option: DesktopSelectOption;
}): React.JSX.Element {
  return (
    <>
      {option.action ? (
        <AppIcon name="add" className="icon-sm shrink-0 text-accent" aria-hidden="true" />
      ) : null}
      <div className="min-w-0 flex-1">
        <Label className={option.action ? "block font-semibold text-accent!" : "block"}>
          {option.action?.label ?? option.label}
        </Label>
        {option.description || option.disabledReason ? (
          <Description className="mt-0.5 block">
            {[option.description, option.disabledReason].filter(Boolean).join(" · ")}
          </Description>
        ) : null}
      </div>
      {option.meta ? (
        <span className="shrink-0 text-support text-on-surface-variant tabular-nums">
          {option.meta}
        </span>
      ) : null}
      <ListBox.ItemIndicator />
    </>
  );
}

export function DesktopSelectOptions({
  options,
}: {
  readonly options: readonly DesktopSelectOption[];
}): React.JSX.Element {
  function renderOption(option: DesktopSelectOption): React.JSX.Element {
    return (
      <ListBox.Item
        key={option.value}
        id={option.value}
        textValue={option.action?.label ?? option.label}
        className={
          option.action
            ? "relative mt-2 before:pointer-events-none before:absolute before:inset-x-1 before:-top-1 before:border-t before:border-ring-subtle"
            : undefined
        }
      >
        <DesktopSelectOptionContent option={option} />
      </ListBox.Item>
    );
  }
  return (
    <>
      {desktopOptionGroups(options).map((group) =>
        group.label ? (
          <ListBox.Section key={group.label}>
            <Header>{group.label}</Header>
            {group.options.map(renderOption)}
          </ListBox.Section>
        ) : (
          group.options.map(renderOption)
        ),
      )}
    </>
  );
}

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
  readonly group?: string;
  readonly action?: { readonly kind: "create"; readonly label: string };
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
  readonly searchable?: boolean;
  readonly searchPlaceholder?: string;
  readonly createActionLabel?: string;
  readonly createActionDescription?: string;
  readonly onCreateAction?: () => void;
  readonly customDescription?: string;
  readonly allowCustomValue?: boolean;
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
  ...choiceProps
}: DesktopSelectProps): React.JSX.Element {
  const layers = useOverlayLayers();
  const { open, isExiting, setOpen, surfaceRef, queueAction } = useDesktopSelectPopover();
  const popoverMotion = useDesktopPopoverMotion(open);
  const selected = options.find((option) => option.value === value);
  if (choiceProps.searchable || choiceProps.onCreateAction || choiceProps.allowCustomValue) {
    return (
      <DesktopSearchSelect
        {...choiceProps}
        id={id}
        emptyText={emptyText}
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        name={name}
        description={description}
        error={error}
        disabled={disabled}
        required={required}
        className={className}
      />
    );
  }
  return (
    <DesktopPopoverBoundary open={open || isExiting}>
      <Select<DesktopSelectOption>
        fullWidth
        allowsEmptyCollection
        className={className}
        name={name}
        value={value}
        isOpen={open}
        onOpenChange={setOpen}
        onChange={(key: Key | null): void => {
          const value = key === null ? null : String(key);
          if (options.find((option) => option.value === value)?.action)
            queueAction(() => onChange(value));
          else onChange(value);
        }}
        placeholder={placeholder}
        isDisabled={disabled}
        disabledKeys={options
          .filter((option) => option.disabled || option.disabledReason)
          .map((option) => option.value)}
        isRequired={required}
        isInvalid={Boolean(error)}
      >
        <Label>{label}</Label>
        <Select.Trigger id={id} className="atria-desktop-select-trigger">
          <Select.Value>
            {({ isPlaceholder }): React.JSX.Element => (
              <span className="atria-desktop-select-value">
                <span className="min-w-0 truncate">
                  {isPlaceholder ? placeholder : selected?.label}
                </span>
                {!isPlaceholder && selected?.meta ? (
                  <span className="shrink-0 text-support text-on-surface-variant tabular-nums">
                    {selected.meta}
                  </span>
                ) : null}
              </span>
            )}
          </Select.Value>
          <Select.Indicator>
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={popoverMotion.transition}
              className="flex"
            >
              <AppIcon name="expand_more" aria-hidden="true" />
            </motion.span>
          </Select.Indicator>
        </Select.Trigger>
        {description ? <Description>{description}</Description> : null}
        {error ? <FieldError>{error}</FieldError> : null}
        <Select.Popover
          ref={surfaceRef}
          isExiting={isExiting}
          style={{ zIndex: layers.anchored }}
          data-atria-popover-surface=""
        >
          <ListBox
            aria-label={label}
            renderEmptyState={() => (
              <span className="px-4 py-3 text-support text-muted">{emptyText}</span>
            )}
            disabledKeys={options
              .filter((option: DesktopSelectOption): boolean =>
                Boolean(option.disabled || option.disabledReason),
              )
              .map((option: DesktopSelectOption): string => option.value)}
          >
            <DesktopSelectOptions options={options} />
          </ListBox>
        </Select.Popover>
      </Select>
    </DesktopPopoverBoundary>
  );
}
