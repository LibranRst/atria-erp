"use client";

import {
  deleteAiConversation,
  listAiConversations,
  renameAiConversation,
  type ConversationPagePayload,
} from "@/app/actions/ai/chat-history";
import { getAiPreference, resetAiPreference, saveAiPreference } from "@/app/actions/ai/preferences";
import { useCan } from "@/components/auth/permissions-provider";
import {
  ActionMenu,
  AppIcon,
  Button,
  ChoiceRow,
  CompactFormDialog,
  ConfirmationDialog,
  FormField,
  FormSection,
  GroupedSurface,
  FactRow,
  IconButton,
  OperationalFormSheet,
  SearchInput,
  SegmentedTabs,
  SheetFooterActions,
  TextInput,
  Textarea,
} from "@/components/ui";
import {
  AI_PRIMARY_FOCUS_CONFIG,
  DEFAULT_AI_PREFERENCE,
  getAvailableFocusOptions,
  sanitizePrimaryFocus,
  type AiPreferenceInput,
  type AiResponseStyle,
} from "@atria/core/validations/ai-preference";
import * as React from "react";
import { toast } from "sonner";

import { formatUpdatedAt } from "./conversation-picker";

type Conversation = ConversationPagePayload["items"][number];
type Group = { readonly label: string; readonly items: readonly Conversation[] };

export function groupConversations(
  items: readonly Conversation[],
  now = new Date(),
): readonly Group[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today);
  week.setDate(week.getDate() - 7);

  const groups: Record<"today" | "yesterday" | "week" | "older", Conversation[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };

  for (const item of items) {
    const time = new Date(item.updatedAt);
    if (time >= today) {
      groups.today.push(item);
    } else if (time >= yesterday) {
      groups.yesterday.push(item);
    } else if (time >= week) {
      groups.week.push(item);
    } else {
      groups.older.push(item);
    }
  }

  const result: Group[] = [];
  if (groups.today.length) result.push({ label: "Hari ini", items: groups.today });
  if (groups.yesterday.length) result.push({ label: "Kemarin", items: groups.yesterday });
  if (groups.week.length) result.push({ label: "7 hari terakhir", items: groups.week });
  if (groups.older.length) result.push({ label: "Lebih lama", items: groups.older });
  return result;
}

const STYLE_OPTIONS: readonly { value: AiResponseStyle; label: string }[] = [
  { value: "STANDARD", label: "Standard Paduna Build" },
  { value: "VERY_CONCISE", label: "Sangat ringkas" },
  { value: "DETAILED", label: "Lebih rinci" },
];

export function ConversationHistoryWorkspace({
  activeId,
  onSelect,
  onNewConversation,
  onActiveDeleted,
  compact = false,
  refreshKey,
  localDrafts = [],
  onTitleChange,
}: {
  readonly activeId: string | null;
  readonly onSelect: (id: string, title?: string) => void;
  readonly onNewConversation: () => void;
  readonly onActiveDeleted: () => void;
  readonly compact?: boolean;
  readonly refreshKey?: string;
  readonly localDrafts?: readonly {
    readonly id: string;
    readonly title: string;
    readonly updatedAt: number;
  }[];
  readonly onTitleChange?: (id: string, title: string) => void;
}): React.JSX.Element {
  const can = useCan();
  const [items, setItems] = React.useState<readonly Conversation[]>([]);
  const [query, setQuery] = React.useState("");
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState("");
  const [actionTarget, setActionTarget] = React.useState<Conversation | null>(null);
  const [renameTitle, setRenameTitle] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Conversation | null>(null);
  const [pending, setPending] = React.useState(false);
  const [preference, setPreference] = React.useState<AiPreferenceInput>(DEFAULT_AI_PREFERENCE);
  const [preferenceDraft, setPreferenceDraft] =
    React.useState<AiPreferenceInput>(DEFAULT_AI_PREFERENCE);
  const [preferenceOpen, setPreferenceOpen] = React.useState(false);
  const requestId = React.useRef(0);

  const availableFocusOptions = React.useMemo(() => getAvailableFocusOptions(can), [can]);

  const load = React.useCallback(async (search: string, cursor?: string): Promise<void> => {
    const id = ++requestId.current;
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setLoadError("");
    try {
      const response = await listAiConversations({ query: search || undefined, cursor, limit: 30 });
      if (id !== requestId.current) return;
      if (response.success) {
        setHasLoaded(true);
        setItems((current) =>
          cursor ? [...current, ...response.data.items] : response.data.items,
        );
        setNextCursor(response.data.nextCursor);
      } else {
        setLoadError(response.error.message);
      }
    } catch {
      if (id === requestId.current) setLoadError("Riwayat belum dapat dimuat. Coba lagi.");
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(query), 250);
    return () => window.clearTimeout(timer);
  }, [load, query, refreshKey]);

  React.useEffect(() => {
    void getAiPreference().then((response) => {
      if (response.success) {
        setPreference(response.data);
        setPreferenceDraft(response.data);
      }
    });
  }, []);

  async function savePreference(): Promise<void> {
    setPending(true);
    const sanitizedDraft: AiPreferenceInput = {
      ...preferenceDraft,
      primaryFocus: sanitizePrimaryFocus(preferenceDraft.primaryFocus, can),
    };
    const response = await saveAiPreference(sanitizedDraft);
    setPending(false);
    if (!response.success) {
      toast.error(response.error.message);
      return;
    }
    setPreference(response.data);
    setPreferenceDraft(response.data);
    setPreferenceOpen(false);
    toast.success("Preferensi asisten disimpan.");
  }

  async function resetPreference(): Promise<void> {
    setPending(true);
    const response = await resetAiPreference();
    setPending(false);
    if (!response.success) {
      toast.error(response.error.message);
      return;
    }
    setPreference(response.data);
    setPreferenceDraft(response.data);
    toast.success("Preferensi dikembalikan ke default.");
  }

  async function rename(): Promise<void> {
    if (!actionTarget) return;
    setPending(true);
    const response = await renameAiConversation({
      conversationId: actionTarget.id,
      title: renameTitle,
    });
    setPending(false);
    if (!response.success) {
      toast.error(response.error.message);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === actionTarget.id ? { ...item, title: response.data.title } : item,
      ),
    );
    setActionTarget(null);
    onTitleChange?.(actionTarget.id, response.data.title);
    toast.success("Judul percakapan diperbarui.");
  }

  async function remove(): Promise<void> {
    if (!deleteTarget) return;
    setPending(true);
    const response = await deleteAiConversation(deleteTarget.id);
    setPending(false);
    if (!response.success) {
      toast.error(response.error.message);
      return;
    }
    setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
    if (deleteTarget.id === activeId) onActiveDeleted();
    setDeleteTarget(null);
    toast.success("Percakapan dihapus.");
  }

  const groups = groupConversations(items);
  const effectiveFocus = sanitizePrimaryFocus(preference.primaryFocus, can);
  const styleLabel = STYLE_OPTIONS.find(
    (option) => option.value === preference.responseStyle,
  )?.label;
  const focusLabel = AI_PRIMARY_FOCUS_CONFIG[effectiveFocus]?.label ?? "Otomatis";

  const activeDraftFocus = sanitizePrimaryFocus(preferenceDraft.primaryFocus, can);
  const customNoteLength = preferenceDraft.customNote?.length ?? 0;
  const visibleLocalDrafts = localDrafts.filter((item) =>
    item.title.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")),
  );

  return (
    <div
      className={compact ? "space-y-3 pb-4" : "space-y-md pt-2 pb-6"}
      aria-busy={loading || loadingMore}
    >
      <div className="flex min-h-10 items-center justify-between gap-2">
        {compact ? (
          <h2 className="px-2 text-support font-semibold">Riwayat percakapan</h2>
        ) : (
          <Button
            variant="primary"
            className="min-w-0 flex-1"
            aria-label="Mulai percakapan baru"
            onClick={onNewConversation}
          >
            <AppIcon name="add" className="icon-sm shrink-0" />
            Percakapan baru
          </Button>
        )}
        <IconButton
          label={`Preferensi asisten · ${styleLabel} · ${focusLabel}`}
          icon={<AppIcon name="tune" className="icon-md" />}
          variant="tertiary"
          size="compact"
          aria-haspopup="dialog"
          aria-expanded={preferenceOpen}
          className="shrink-0 bg-transparent! text-on-surface-variant! shadow-none!"
          onClick={() => {
            setPreferenceDraft(preference);
            setPreferenceOpen(true);
          }}
        />
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Cari judul percakapan"
        ariaLabel="Cari judul percakapan"
        showClear={false}
      />
      {visibleLocalDrafts.length ? (
        <section className="space-y-1">
          <h3 className="px-2 text-meta font-semibold text-on-surface-variant">Belum dikirim</h3>
          {visibleLocalDrafts.map((item) => (
            <Button
              key={item.id}
              variant="tertiary"
              fullWidth
              className="justify-start! bg-transparent! text-start! text-on-surface! shadow-none!"
              onClick={() => onSelect(item.id)}
            >
              <AppIcon name="edit" className="icon-sm" />
              <span className="min-w-0 truncate">{item.title}</span>
            </Button>
          ))}
        </section>
      ) : null}
      {loadError ? (
        <div role="alert" className="space-y-2 px-2 py-3">
          <p className="text-support text-on-surface-variant">{loadError}</p>
          <Button variant="secondary" size="compact" onClick={() => void load(query)}>
            Coba lagi
          </Button>
        </div>
      ) : null}
      {loading && !hasLoaded ? (
        <div className="space-y-2" role="status" aria-label="Memuat riwayat">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-16 rounded-inset bg-surface-container" />
          ))}
        </div>
      ) : !hasLoaded ? null : items.length === 0 && visibleLocalDrafts.length === 0 ? (
        <div className="py-12 text-center text-on-surface-variant">
          <p className="text-support font-semibold">
            {query.trim() ? "Judul tidak ditemukan" : "Belum ada percakapan"}
          </p>
          <p className="text-meta">
            {query.trim()
              ? "Coba kata lain atau kosongkan pencarian."
              : "Mulai percakapan baru untuk bertanya."}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="space-y-2">
            <h3 className="px-1 text-meta font-bold text-on-surface-variant">{group.label}</h3>
            <ul
              className={
                compact
                  ? "space-y-1"
                  : "divide-y divide-ring-subtle overflow-hidden rounded-owner bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle"
              }
            >
              {group.items.map((conversation) => {
                const isActive = conversation.id === activeId;
                return (
                  <li
                    key={conversation.id}
                    className={`group flex min-h-16 items-center gap-1 pr-1 transition-colors hover:bg-surface-container ${compact ? "rounded-2xl" : ""} ${
                      isActive
                        ? "bg-surface-container-high"
                        : compact
                          ? "bg-transparent"
                          : "bg-surface-container-lowest"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(conversation.id, conversation.title ?? undefined)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex min-h-16 min-w-0 flex-1 cursor-pointer items-center gap-2 ${compact ? "px-2" : "px-4"} text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset`}
                    >
                      {!compact ? (
                        <AppIcon
                          name={isActive ? "check_circle" : "sparkle"}
                          className={`icon-sm shrink-0 ${
                            isActive ? "text-accent" : "text-on-surface-variant"
                          }`}
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`${compact ? "line-clamp-2 text-support" : "truncate text-row"} font-semibold ${
                            isActive ? "font-bold text-on-surface" : "text-on-surface"
                          }`}
                        >
                          {conversation.title ?? "Percakapan baru"}
                        </p>
                        <p className="truncate text-meta font-semibold text-on-surface-variant">
                          {conversation.messageCount} pesan ·{" "}
                          {formatUpdatedAt(conversation.updatedAt)}
                          {isActive ? " · sedang dibuka" : ""}
                        </p>
                      </div>
                    </button>
                    <div className="shrink-0">
                      <ActionMenu
                        label={`Aksi percakapan ${conversation.title ?? "baru"}`}
                        trigger={
                          <IconButton
                            label={`Aksi percakapan ${conversation.title ?? "baru"}`}
                            size="compact"
                            variant="tertiary"
                            icon={<AppIcon name="more_horiz" className="icon-md" />}
                            className="bg-transparent! text-on-surface-variant! shadow-none! group-hover:text-on-surface"
                          />
                        }
                        items={[
                          {
                            id: "rename",
                            label: "Ganti judul…",
                            icon: "edit",
                            onSelect: () => {
                              setActionTarget(conversation);
                              setRenameTitle(conversation.title ?? "");
                            },
                          },
                          {
                            id: "delete",
                            label: "Hapus percakapan…",
                            icon: "delete",
                            tone: "critical",
                            onSelect: () => setDeleteTarget(conversation),
                          },
                        ]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {nextCursor ? (
        <Button
          variant="secondary"
          fullWidth
          pending={loadingMore}
          disabled={loading}
          onClick={() => void load(query, nextCursor)}
        >
          Muat lebih banyak
        </Button>
      ) : null}

      <CompactFormDialog
        open={actionTarget !== null}
        title="Ganti judul"
        onClose={() => setActionTarget(null)}
        actions={
          <SheetFooterActions
            secondary={{ label: "Batal", onClick: () => setActionTarget(null) }}
            primary={{
              label: "Simpan",
              pending,
              disabled: renameTitle.trim().length === 0,
              onClick: () => void rename(),
            }}
          />
        }
      >
        <FormField label="Judul percakapan">
          <TextInput
            autoFocus
            value={renameTitle}
            onChange={(value) => setRenameTitle(value.slice(0, 80))}
          />
        </FormField>
      </CompactFormDialog>
      <ConfirmationDialog
        open={deleteTarget !== null}
        title="Hapus Percakapan?"
        description="Riwayat chat akan dihapus. Dokumen yang sudah tercatat tidak ikut terhapus."
        confirmLabel="Hapus Percakapan"
        danger
        pending={pending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
      />

      <OperationalFormSheet
        dismissal={{
          mode: "confirm",
          dirty: JSON.stringify(preferenceDraft) !== JSON.stringify(preference),
          onDiscard: () => setPreferenceDraft(preference),
          description: "Perubahan preferensi asisten yang belum disimpan akan hilang.",
        }}
        open={preferenceOpen}
        title="Preferensi asisten"
        desktopSize="wide"
        desktopFooterPlacement="aside"
        sizing="content"
        desktopAsideSummary={
          <GroupedSurface>
            <div className="divide-y divide-ring-subtle">
              <FactRow
                label="Gaya jawaban"
                wrapLabel
                value={
                  STYLE_OPTIONS.find((option) => option.value === preferenceDraft.responseStyle)
                    ?.label
                }
              />
              <FactRow
                label="Fokus utama"
                wrapLabel
                value={
                  availableFocusOptions.find((option) => option.value === activeDraftFocus)?.label
                }
              />
              <div className="px-4 py-3 text-support text-on-surface-variant">
                Hanya memengaruhi gaya dan peristilahan, bukan izin atau fakta.
              </div>
            </div>
          </GroupedSurface>
        }
        onClose={() => setPreferenceOpen(false)}
        onSubmit={() => void savePreference()}
        submitLabel="Simpan"
        pending={pending}
        secondary={{ label: "Reset", pending, onClick: () => void resetPreference() }}
      >
        <div className="space-y-5">
          <FormSection title="Gaya jawaban" presentation="plain">
            <SegmentedTabs
              ariaLabel="Gaya jawaban"
              value={preferenceDraft.responseStyle}
              onChange={(value) =>
                setPreferenceDraft((current) => ({ ...current, responseStyle: value }))
              }
              options={STYLE_OPTIONS}
              fillAvailableSpace
            />
          </FormSection>

          <FormSection title="Fokus utama" presentation="grouped">
            <div
              role="radiogroup"
              aria-label="Fokus utama"
              className="divide-y divide-outline-variant/20"
            >
              {availableFocusOptions.map((option) => (
                <ChoiceRow
                  key={option.value}
                  selectionMode="radio"
                  checked={activeDraftFocus === option.value}
                  onChange={() =>
                    setPreferenceDraft((curr) => ({ ...curr, primaryFocus: option.value }))
                  }
                  title={option.label}
                  description={option.description}
                />
              ))}
            </div>
          </FormSection>

          <FormSection title="Catatan personal" presentation="grouped">
            <div className="space-y-2 p-4">
              <Textarea
                id="ai-custom-note"
                value={preferenceDraft.customNote ?? ""}
                onChange={(value) =>
                  setPreferenceDraft((current) => ({
                    ...current,
                    customNote: value.slice(0, 300) || null,
                  }))
                }
                rows={4}
                placeholder="Contoh: gunakan istilah yang mudah dipahami tim lapangan"
              />
              <div className="flex items-center justify-between text-meta text-on-surface-variant">
                <span>Hanya memengaruhi gaya dan peristilahan, bukan izin atau fakta.</span>
                <span className="font-mono text-xs tabular-nums">{customNoteLength}/300</span>
              </div>
            </div>
          </FormSection>
        </div>
      </OperationalFormSheet>
    </div>
  );
}
