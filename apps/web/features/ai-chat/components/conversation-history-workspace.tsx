"use client";

import {
  deleteAiConversation,
  listAiConversations,
  renameAiConversation,
  type ConversationPagePayload,
} from "@/app/actions/ai/chat-history";
import { getAiPreference, resetAiPreference, saveAiPreference } from "@/app/actions/ai/preferences";
import {
  ActionMenu,
  AppIcon,
  Button,
  CompactFormDialog,
  ConfirmationDialog,
  FormField,
  FormSection,
  IconButton,
  OperationalFormSheet,
  OptionChoiceGroup,
  SearchInput,
  SegmentedTabs,
  SheetFooterActions,
  TextInput,
  Textarea,
} from "@/components/ui";
import {
  DEFAULT_AI_PREFERENCE,
  type AiPreferenceInput,
  type AiPrimaryFocus,
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
  const groups = [
    { label: "Hari ini", items: items.filter((item) => new Date(item.updatedAt) >= today) },
    {
      label: "Kemarin",
      items: items.filter(
        (item) => new Date(item.updatedAt) >= yesterday && new Date(item.updatedAt) < today,
      ),
    },
    {
      label: "7 hari terakhir",
      items: items.filter(
        (item) => new Date(item.updatedAt) >= week && new Date(item.updatedAt) < yesterday,
      ),
    },
    { label: "Lebih lama", items: items.filter((item) => new Date(item.updatedAt) < week) },
  ];
  return groups.filter((group) => group.items.length > 0);
}

const STYLE_OPTIONS: readonly { value: AiResponseStyle; label: string }[] = [
  { value: "STANDARD", label: "Standard Atria" },
  { value: "VERY_CONCISE", label: "Sangat ringkas" },
  { value: "DETAILED", label: "Lebih rinci" },
];
const FOCUS_OPTIONS: readonly { value: AiPrimaryFocus; label: string }[] = [
  { value: "AUTO", label: "Otomatis" },
  { value: "BUDGET_MARGIN", label: "Budget & margin" },
  { value: "CASH_BILLS", label: "Kas & tagihan" },
  { value: "MATERIAL_STOCK", label: "Material & stok" },
  { value: "ACTIONS_APPROVALS", label: "Tindakan & approval" },
];

export function ConversationHistoryWorkspace({
  activeId,
  onSelect,
  onNewConversation,
  onActiveDeleted,
}: {
  readonly activeId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onNewConversation: () => void;
  readonly onActiveDeleted: () => void;
}): React.JSX.Element {
  const [items, setItems] = React.useState<readonly Conversation[]>([]);
  const [query, setQuery] = React.useState("");
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [actionTarget, setActionTarget] = React.useState<Conversation | null>(null);
  const [renameTitle, setRenameTitle] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Conversation | null>(null);
  const [pending, setPending] = React.useState(false);
  const [preference, setPreference] = React.useState<AiPreferenceInput>(DEFAULT_AI_PREFERENCE);
  const [preferenceDraft, setPreferenceDraft] =
    React.useState<AiPreferenceInput>(DEFAULT_AI_PREFERENCE);
  const [preferenceOpen, setPreferenceOpen] = React.useState(false);
  const requestId = React.useRef(0);

  const load = React.useCallback(async (search: string, cursor?: string): Promise<void> => {
    const id = ++requestId.current;
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    const response = await listAiConversations({ query: search || undefined, cursor, limit: 30 });
    if (id !== requestId.current) return;
    if (response.success) {
      setItems((current) => (cursor ? [...current, ...response.data.items] : response.data.items));
      setNextCursor(response.data.nextCursor);
    } else {
      toast.error(response.error.message);
    }
    setLoading(false);
    setLoadingMore(false);
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(query), 250);
    return () => window.clearTimeout(timer);
  }, [load, query]);

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
    const response = await saveAiPreference(preferenceDraft);
    setPending(false);
    if (!response.success) {
      toast.error(response.error.message);
      return;
    }
    setPreference(response.data);
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
  const styleLabel = STYLE_OPTIONS.find(
    (option) => option.value === preference.responseStyle,
  )?.label;
  const focusLabel = FOCUS_OPTIONS.find(
    (option) => option.value === preference.primaryFocus,
  )?.label;

  return (
    <div className="space-y-md pt-2 pb-6">
      <Button variant="primary" fullWidth onClick={onNewConversation}>
        Mulai percakapan baru
      </Button>
      <button
        type="button"
        onClick={() => {
          setPreferenceDraft(preference);
          setPreferenceOpen(true);
        }}
        className="flex min-h-16 w-full items-center gap-3 rounded-owner bg-white px-4 text-left shadow-surface ring-1 ring-ring-subtle focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-icon bg-surface-container text-on-surface">
          <AppIcon name="tune" className="icon-md" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-row font-bold text-on-surface">Preferensi asisten</span>
          <span className="block truncate text-meta font-semibold text-on-surface-variant">
            {styleLabel} · {focusLabel}
            {preference.customNote ? " · Ada catatan" : ""}
          </span>
        </span>
        <AppIcon name="chevron_right" className="icon-sm text-on-surface-variant" />
      </button>
      <SearchInput value={query} onChange={setQuery} placeholder="Cari percakapan" />
      {loading ? (
        <div className="space-y-2" role="status" aria-label="Memuat riwayat">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-16 rounded-inset bg-surface-container" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-owner bg-white p-5 text-center shadow-surface ring-1 ring-ring-subtle">
          <p className="text-row font-bold text-on-surface">
            {query ? `Tidak ada hasil untuk “${query}”` : "Belum ada percakapan"}
          </p>
          <p className="mt-1 text-support text-on-surface-variant">
            {query
              ? "Coba kata kunci lain atau bersihkan pencarian."
              : "Mulai percakapan untuk menyimpan riwayat pertama."}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="space-y-2">
            <h2 className="px-1 text-meta font-bold tracking-wider text-on-surface-variant uppercase">
              {group.label}
            </h2>
            <ul className="divide-y divide-black/5.5 overflow-hidden rounded-owner bg-white shadow-surface ring-1 ring-ring-subtle">
              {group.items.map((conversation) => (
                <li key={conversation.id} className="flex min-h-16 items-center gap-1 pr-2">
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-current={conversation.id === activeId ? "true" : undefined}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
                  >
                    <AppIcon
                      name={conversation.id === activeId ? "check_circle" : "sparkle"}
                      className="icon-sm shrink-0 text-on-surface-variant"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-row font-semibold text-on-surface">
                        {conversation.title ?? "Percakapan baru"}
                      </span>
                      <span className="block text-meta font-semibold text-on-surface-variant">
                        {conversation.messageCount} pesan ·{" "}
                        {formatUpdatedAt(conversation.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <ActionMenu
                    label={`Aksi percakapan ${conversation.title ?? "baru"}`}
                    trigger={
                      <IconButton
                        label={`Aksi percakapan ${conversation.title ?? "baru"}`}
                        size="compact"
                        variant="tertiary"
                        icon={<AppIcon name="more_horiz" className="icon-md" />}
                        className="text-on-surface-variant"
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
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {nextCursor ? (
        <Button
          variant="secondary"
          fullWidth
          pending={loadingMore}
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

          <OptionChoiceGroup
            label="Fokus utama"
            value={preferenceDraft.primaryFocus}
            onChange={(value) =>
              setPreferenceDraft((current) => ({ ...current, primaryFocus: value }))
            }
            options={FOCUS_OPTIONS}
          />

          <FormSection>
            <FormField
              label="Catatan personal"
              helper="Maksimal 300 karakter. Catatan hanya memengaruhi gaya, istilah, dan prioritas—bukan izin atau fakta."
            >
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
            </FormField>
          </FormSection>
        </div>
      </OperationalFormSheet>
    </div>
  );
}
