"use client";

import React from "react";
import { Autocomplete, Label, ListBox, SearchField, Select, type Key } from "@heroui/react";
import type { SelectOption } from "../form/form-control-types";
import { AppIcon } from "../icon/app-icon";
import { useOverlayLayers } from "../overlay/overlay-layer-context";
import { DesktopPopoverBoundary, useDesktopSelectPopover } from "./desktop-popover-motion";

export type DesktopFilterSelectProps = {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly searchable: boolean;
};

/** A filter is an inline choice, not a full form field. RAC retains ownership
 * of selection/focus; the positioned popup uses the same spring as FAB menus. */
export function DesktopFilterSelect({
  label,
  value,
  options,
  onChange,
  searchable,
}: DesktopFilterSelectProps): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const selected = options.find((option) => option.value === value);
  const layers = useOverlayLayers();
  const afterClose = React.useCallback((): void => setQuery(""), []);
  const { open, isExiting, setOpen, surfaceRef } = useDesktopSelectPopover(afterClose);

  const list = (
    <ListBox
      aria-label={label}
      disabledKeys={options
        .filter((option) => option.disabled || option.disabledReason)
        .map((option) => option.value)}
      renderEmptyState={(): React.JSX.Element => (
        <p className="px-3 py-3 text-support text-muted">Tidak ada pilihan yang cocok.</p>
      )}
    >
      {options.map((option) => (
        <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
          <div className="min-w-0 flex-1">
            <span className="block text-row">{option.label}</span>
            {option.description || option.disabledReason ? (
              <span className="mt-0.5 block text-support text-muted">
                {[option.description, option.disabledReason].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </div>
          {option.meta ? (
            <span className="shrink-0 text-support text-muted tabular-nums">{option.meta}</span>
          ) : null}
          <ListBox.ItemIndicator />
        </ListBox.Item>
      ))}
    </ListBox>
  );

  return (
    <DesktopPopoverBoundary open={open || isExiting}>
      <Select
        allowsEmptyCollection
        className="atria-desktop-filter min-w-0"
        value={value}
        isOpen={open}
        disabledKeys={options
          .filter((option) => option.disabled || option.disabledReason)
          .map((option) => option.value)}
        onOpenChange={(next: boolean): void => {
          setOpen(next);
        }}
        onChange={(key: Key | null): void => {
          if (key !== null) onChange(String(key));
        }}
      >
        <Label className="sr-only">{label}</Label>
        <Select.Trigger className="atria-desktop-filter-trigger">
          <Select.Value>
            <span className="inline-flex min-w-0 items-center gap-3">
              <span className="truncate">{selected?.label ?? label}</span>
              {selected?.meta ? (
                <span className="shrink-0 text-support text-muted tabular-nums">
                  {selected.meta}
                </span>
              ) : null}
            </span>
          </Select.Value>
          <Select.Indicator>
            <AppIcon name="expand_more" className="icon-sm" aria-hidden="true" />
          </Select.Indicator>
        </Select.Trigger>
        <Select.Popover
          ref={surfaceRef}
          isExiting={isExiting}
          data-atria-popover-surface=""
          className={`atria-desktop-filter-popover ${searchable ? "autocomplete__popover" : ""}`}
          style={{ zIndex: layers.anchored }}
        >
          {searchable ? (
            <Autocomplete.Filter
              inputValue={query}
              onInputChange={setQuery}
              filter={(text: string, input: string): boolean =>
                text.toLocaleLowerCase("id-ID").includes(input.trim().toLocaleLowerCase("id-ID"))
              }
            >
              <SearchField autoFocus aria-label={`Cari ${label}`}>
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder={`Cari ${label.toLocaleLowerCase("id-ID")}…`} />
                  <SearchField.ClearButton aria-label="Bersihkan pencarian" />
                </SearchField.Group>
              </SearchField>
              {list}
            </Autocomplete.Filter>
          ) : (
            list
          )}
        </Select.Popover>
      </Select>
    </DesktopPopoverBoundary>
  );
}
