"use client";

import React from "react";
import {
  Autocomplete,
  Description,
  FieldError,
  Label,
  ListBox,
  SearchField,
  Select,
  type Key,
} from "@heroui/react";
import { motion } from "framer-motion";
import { DesktopButton, DesktopSelectOptions, type DesktopSelectProps } from "./desktop-controls";
import {
  DesktopPopoverBoundary,
  useDesktopPopoverMotion,
  useDesktopSelectPopover,
} from "./desktop-popover-motion";
import { useOverlayLayers } from "../overlay/overlay-layer-context";
import { AppIcon } from "../icon/app-icon";

/** HeroUI's searchable select: typing filters choices; only explicit selection
 * or the custom/create action commits anything to the parent form. */
export function DesktopSearchSelect({
  id,
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
  emptyText = "Tidak ada opsi.",
  searchPlaceholder,
  createActionLabel,
  createActionDescription,
  onCreateAction,
  allowCustomValue,
  customDescription,
}: DesktopSelectProps): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const afterClose = React.useCallback((): void => setQuery(""), []);
  const customKey = React.useId();
  const layers = useOverlayLayers();
  const { open, isExiting, setOpen, surfaceRef, queueAction } = useDesktopSelectPopover(afterClose);
  const popoverMotion = useDesktopPopoverMotion(open);
  const selected = options.find((option) => option.value === value);
  const normalized = query.trim().toLocaleLowerCase("id-ID");
  const custom = Boolean(
    allowCustomValue &&
    normalized &&
    !options.some((option) => option.label.toLocaleLowerCase("id-ID") === normalized),
  );
  const displayed = custom
    ? [
        ...options,
        { value: customKey, label: `Gunakan “${query.trim()}”`, description: customDescription },
      ]
    : options;
  return (
    <DesktopPopoverBoundary open={open || isExiting}>
      <Select
        fullWidth
        allowsEmptyCollection
        className={className}
        name={name}
        value={value}
        placeholder={placeholder}
        isOpen={open}
        onOpenChange={(next: boolean): void => {
          setOpen(next);
        }}
        onChange={(key: Key | null): void => {
          if (key === null) return;
          const value = String(key) === customKey ? query.trim() : String(key);
          if (displayed.find((option) => option.value === String(key))?.action)
            queueAction(() => onChange(value));
          else {
            onChange(value);
            setOpen(false);
          }
        }}
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
              <AppIcon name="expand_more" className="icon-sm" aria-hidden="true" />
            </motion.span>
          </Select.Indicator>
        </Select.Trigger>
        {description ? <Description>{description}</Description> : null}
        {error ? <FieldError>{error}</FieldError> : null}
        <Select.Popover
          ref={surfaceRef}
          isExiting={isExiting}
          className="autocomplete__popover"
          style={{ zIndex: layers.anchored }}
          data-atria-popover-surface=""
        >
          <Autocomplete.Filter
            inputValue={query}
            onInputChange={setQuery}
            filter={(text: string, input: string): boolean => {
              const option = displayed.find((item) => (item.action?.label ?? item.label) === text);
              if (option?.action) return true;
              return [text, option?.meta, option?.description, option?.group]
                .join(" ")
                .toLocaleLowerCase("id-ID")
                .includes(input.trim().toLocaleLowerCase("id-ID"));
            }}
          >
            <SearchField autoFocus aria-label={`Cari ${label}`}>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  placeholder={searchPlaceholder ?? `Cari ${label.toLocaleLowerCase("id-ID")}…`}
                />
                <SearchField.ClearButton aria-label="Bersihkan pencarian" />
              </SearchField.Group>
            </SearchField>
            <ListBox
              aria-label={label}
              disabledKeys={options
                .filter((option) => option.disabled || option.disabledReason)
                .map((option) => option.value)}
              renderEmptyState={(): React.JSX.Element => (
                <p className="px-4 py-3 text-support text-muted">{emptyText}</p>
              )}
            >
              <DesktopSelectOptions options={displayed} />
            </ListBox>
          </Autocomplete.Filter>
          {createActionLabel && onCreateAction ? (
            <div className="border-t border-outline-variant/20 p-2">
              <DesktopButton
                fullWidth
                size="compact"
                variant="tertiary"
                onPress={(): void => {
                  queueAction(onCreateAction);
                }}
              >
                <AppIcon name="add" className="icon-sm" />
                <span className="min-w-0 text-start">
                  <span className="block">{createActionLabel}</span>
                  {createActionDescription ? (
                    <span className="block text-meta text-muted">{createActionDescription}</span>
                  ) : null}
                </span>
              </DesktopButton>
            </div>
          ) : null}
        </Select.Popover>
      </Select>
    </DesktopPopoverBoundary>
  );
}
