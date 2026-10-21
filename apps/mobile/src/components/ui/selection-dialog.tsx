import { useMemo, useRef, useState } from "react";
import { StyleSheet, TextInput as NativeTextInput, View, useWindowDimensions } from "react-native";
import { ChoiceList } from "./choice-list";
import { DialogFrame } from "./dialog-frame";
import { SheetOptionRow } from "./sheet-select";
import type { SelectOption } from "./sheet-select";
import { TextInput } from "./text-input";
import { FormPresentationProvider } from "./form-presentation-context";
import {
  canUseCustomSelectValue,
  filterSelectOptions,
} from "@atria/core/presentation/select-surface-policy";

export type SelectionDialogProps = {
  readonly visible: boolean;
  readonly title: string;
  readonly options: readonly SelectOption[];
  readonly value: string;
  readonly onSelect: (value: string) => void;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
  readonly returnFocusField?: string;
  readonly emptyText?: string;
  readonly onCreateAction?: () => void;
  readonly createActionLabel?: string;
  readonly onCreate?: () => void;
  readonly createLabel?: string;
  readonly allowCustom?: boolean;
  readonly customValueDescription?: string;
};

export function SelectionDialog(props: SelectionDialogProps): React.JSX.Element {
  return <ChoiceDialog {...props} searchable={false} />;
}
export function SearchDialog(props: SelectionDialogProps): React.JSX.Element {
  return <ChoiceDialog {...props} searchable />;
}

function ChoiceDialog({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  onExitComplete,
  returnFocusField,
  emptyText,
  onCreateAction,
  createActionLabel,
  onCreate,
  createLabel,
  allowCustom = false,
  customValueDescription,
  searchable,
}: SelectionDialogProps & { readonly searchable: boolean }): React.JSX.Element {
  const [query, setQuery] = useState("");
  const viewport = useWindowDimensions();
  const search = useRef<NativeTextInput>(null);
  const [previousVisible, setPreviousVisible] = useState(visible);
  if (visible !== previousVisible) {
    setPreviousVisible(visible);
    if (visible) setQuery("");
  }
  const filtered = useMemo(() => filterSelectOptions(options, query), [query, options]);
  const custom = query.trim();
  const useCustom = allowCustom && canUseCustomSelectValue(options, custom);
  const create = onCreateAction ?? onCreate;
  const pick = (selected: string): void => {
    onSelect(selected);
    onClose();
  };
  const extra = (
    <>
      {useCustom ? (
        <SheetOptionRow
          active={false}
          option={{
            value: custom,
            label: `Gunakan “${custom}”`,
            description: customValueDescription ?? "Pakai nilai yang diketik.",
          }}
          onPress={() => pick(custom)}
        />
      ) : null}
      {create ? (
        <SheetOptionRow
          active={false}
          option={{
            value: "__create__",
            label: createActionLabel ?? createLabel ?? "Tambah pilihan baru",
          }}
          onPress={() => {
            onClose();
            create();
          }}
        />
      ) : null}
    </>
  );
  return (
    <DialogFrame
      visible={visible}
      onClose={onClose}
      onExitComplete={onExitComplete}
      title={title}
      returnFocusField={returnFocusField}
      topBiased={searchable}
      scroll={false}
      presentation="choice"
      onShow={() => {
        if (searchable) search.current?.focus();
      }}
      utility={
        searchable ? (
          <View style={styles.search}>
            <FormPresentationProvider presentation="standalone">
              <TextInput
                ref={search}
                accessibilityLabel={`Cari ${title.toLocaleLowerCase("id-ID")}`}
                placeholder="Cari pilihan…"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                returnKeyType="search"
              />
            </FormPresentationProvider>
          </View>
        ) : undefined
      }
    >
      <ChoiceList
        options={filtered}
        value={value}
        onSelect={pick}
        maxHeight={Math.min(420, Math.max(112, viewport.height * (searchable ? 0.38 : 0.55)))}
        emptyText={emptyText}
        extra={useCustom || create ? extra : undefined}
      />
    </DialogFrame>
  );
}
const styles = StyleSheet.create({ search: { flex: 1, minWidth: 0 } });
