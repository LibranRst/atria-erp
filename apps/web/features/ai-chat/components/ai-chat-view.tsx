"use client";

import { getAiConversation, getLatestAiConversation } from "@/app/actions/ai/chat-history";
import { useCurrentUserProfile } from "@/components/auth/permissions-provider";
import {
  emptyChatDraft,
  emptyWorkspaceSession,
  hasChatDraft,
  newDraftKey,
  readWorkspaceSession,
  saveWorkspaceDraft,
  writeWorkspaceSession,
  type ComposerWizardState,
  type WorkspaceSession,
  type ChatDraft,
} from "../utils/workspace-session";
import { chatFailureMessage, unansweredTurn, restorePendingMessages } from "../utils/chat-recovery";
import type { UIMessage } from "ai";
import { AppIcon, Button } from "@/components/ui";
import {
  transitionEaseSmooth,
  transitionSpringBouncy,
  transitionSpringSmooth,
} from "@/lib/utils/motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import * as React from "react";
import { toast } from "sonner";
import { uploadToImageKit } from "@/lib/media/upload-to-imagekit";

import { TOP_BAR_INSET_PX } from "@/components/layout/app-top-bar";
import { useProvideTopBarSlots } from "@/components/layout/top-bar-slots";

import { aiChatTopBarSlots } from "./ai-chat-top-bar";
import { type ChatAttachment } from "./chat-composer";
import { ChatComposerDock } from "./chat-composer-dock";
import { ChatDropOverlay } from "./chat-drop-overlay";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatHistorySkeleton } from "./chat-history-skeleton";
import { ChatTurn } from "./chat-turn";
import { ConversationHistoryWorkspace } from "./conversation-history-workspace";
import { useChatScroll } from "../hooks/use-chat-scroll";
import { groupChatTurns } from "../utils/chat-turns";
import { finishChatReply } from "../utils/finish-chat-reply";
import { hasCompletedAssistantResult } from "../utils/assistant-result";
import { readActiveInputRequest } from "../utils/input-request-reader";
import { isSupportedAttachment, validateAttachmentBatch } from "../utils/attachment-validation";

type ConversationData = { readonly conversationId: string };

function isConversationData(value: unknown): value is ConversationData {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ConversationData).conversationId === "string"
  );
}

/**
 * Chatbar mengambang di atas percakapan, jadi ruang bawah viewport tidak bisa
 * dipatok konstan: tingginya berubah saat textarea tumbuh dan saat composer
 * bermorf menjadi input bertahap. Tinggi diukur langsung, lalu ditambah jarak
 * chatbar ke tepi layar plus satu napas agar gelembung terakhir tidak menempel.
 */
const COMPOSER_OFFSET_PX = 12;
const COMPOSER_BREATHING_PX = 16;
const FALLBACK_FOOTER_HEIGHT_PX = 48;

const subscribeWideHistory = (callback: () => void): (() => void) => {
  const query = window.matchMedia("(min-width: 1280px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const wideHistorySnapshot = (): boolean => window.matchMedia("(min-width: 1280px)").matches;

export function AiChatView(): React.JSX.Element {
  const router = useRouter();
  const userId = useCurrentUserProfile()?.id;
  const wideHistory = React.useSyncExternalStore(
    subscribeWideHistory,
    wideHistorySnapshot,
    () => false,
  );
  const [historyChoice, setHistoryChoice] = React.useState<boolean | null>(null);
  const [conversationTitle, setConversationTitle] = React.useState("Percakapan baru");
  const [historyError, setHistoryError] = React.useState("");
  const [wizardState, setWizardState] = React.useState<ComposerWizardState>({
    progresses: {},
    paused: [],
  });
  const sessionRef = React.useRef<WorkspaceSession>(emptyWorkspaceSession());
  const sessionUserRef = React.useRef("");
  const pendingConversationRef = React.useRef<string | null>(null);
  const activeKeyRef = React.useRef("draft:initial");
  const draftOwnerRef = React.useRef("draft:initial");
  const loadEpoch = React.useRef(0);
  const acceptStreamData = React.useRef(false);
  const messageCache = React.useRef<Readonly<Record<string, readonly UIMessage[]>>>({});
  const desktop = useWorkspacePresentation() === "desktop";
  const reduceMotion = useReducedMotion();
  const [draft, setDraft] = React.useState("");
  const [pendingTurn, setPendingTurn] = React.useState<ChatDraft["pending"]>(null);
  const [attachments, setAttachments] = React.useState<readonly ChatAttachment[]>([]);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [openedConversationId, setOpenedConversationId] = React.useState<string | null>(null);
  const [historyRevision, setHistoryRevision] = React.useState(0);
  const [confirmedProposals, setConfirmedProposals] = React.useState<Record<string, string>>({});
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(true);
  const showPicker = historyChoice ?? (desktop && wideHistory);
  const historyOnly = showPicker && !desktop;
  const setShowPicker = React.useCallback((next: boolean): void => setHistoryChoice(next), []);
  const [localDrafts, setLocalDrafts] = React.useState<
    readonly { id: string; title: string; updatedAt: number }[]
  >([]);
  const [statusSuppressed, setStatusSuppressed] = React.useState(false);
  const [replyCycle, setReplyCycle] = React.useState(0);
  const [dismissedInputToolCallIds, setDismissedInputToolCallIds] = React.useState<
    ReadonlySet<string>
  >(() => new Set());
  const [isUploading, setIsUploading] = React.useState(false);
  const sendLockRef = React.useRef(false);
  const uploadLockRef = React.useRef(false);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const dragDepthRef = React.useRef(0);

  const conversationIdRef = React.useRef<string | null>(null);
  const footerRef = React.useRef<HTMLElement | null>(null);
  const [footerHeight, setFooterHeight] = React.useState(FALLBACK_FOOTER_HEIGHT_PX);

  const bottomInset = footerHeight + COMPOSER_OFFSET_PX + COMPOSER_BREATHING_PX;

  const setActiveConversation = React.useCallback((next: string | null): void => {
    // A streamed persistence ID is not navigation to another conversation.
    if (!acceptStreamData.current) setOpenedConversationId(next);
    if (
      next &&
      next !== activeKeyRef.current &&
      acceptStreamData.current &&
      activeKeyRef.current.startsWith("draft:")
    ) {
      const current = sessionRef.current.drafts[activeKeyRef.current];
      if (current) sessionRef.current = saveWorkspaceDraft(sessionRef.current, next, current);
      delete sessionRef.current.drafts[activeKeyRef.current];
      activeKeyRef.current = next;
      draftOwnerRef.current = next;
    }
    conversationIdRef.current = next;
    setConversationId(next);
  }, []);

  const [transport] = React.useState(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages.findLast((message) => message.role === "user");
          const text = (last?.parts ?? [])
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("");

          return {
            body: {
              userMessageId: last?.id,
              conversationId: (body as { conversationId?: string | null })?.conversationId ?? null,
              text,
              attachments:
                (body as { attachments?: readonly ChatAttachment[] })?.attachments ??
                (last?.parts ?? []).flatMap((part) =>
                  part.type === "file"
                    ? [
                        {
                          url: part.url,
                          fileName: part.filename ?? "Lampiran",
                          mimeType: part.mediaType,
                          size: "size" in part && typeof part.size === "number" ? part.size : 1,
                        },
                      ]
                    : [],
                ),
            },
          };
        },
      }),
  );

  const { messages, setMessages, sendMessage, status, error, stop, regenerate, clearError } =
    useChat({
      transport,
      generateId: () => crypto.randomUUID(),
      onFinish: ({ message, isError, isAbort }) => {
        if (isError || isAbort || !acceptStreamData.current) return;
        // Terminal status can render before the final streamed snapshot.
        // Publish the complete SDK reply, retaining the same turn/card IDs.
        setMessages((current) => finishChatReply(current, message));
        if (hasCompletedAssistantResult(message)) setPendingTurn(null);
      },
      onData: (part) => {
        if (
          acceptStreamData.current &&
          part.type === "data-conversation" &&
          isConversationData(part.data)
        ) {
          setActiveConversation(part.data.conversationId);
        }
      },
    });

  const isBusy = status === "submitted" || status === "streaming";
  const isWaitingFirstToken = status === "submitted";

  const chatTurns = React.useMemo(() => groupChatTurns(messages), [messages]);

  const {
    viewportRef,
    contentRef,
    openAtBottom,
    jumpToBottom,
    followStream,
    resumeFollowing,
    awayFromBottom,
  } = useChatScroll(isBusy && !historyOnly);

  const restoreDraft = React.useCallback((key: string): void => {
    const cached = sessionRef.current.drafts[key] ?? emptyChatDraft();
    activeKeyRef.current = key;
    draftOwnerRef.current = key;
    setDraft(cached.text);
    setPendingTurn(cached.pending ?? null);
    setAttachments(cached.attachments);
    setWizardState(cached.wizard);
    setDismissedInputToolCallIds(new Set(cached.dismissed));
    sessionRef.current = { ...sessionRef.current, lastKey: key };
    setLocalDrafts(
      Object.entries(sessionRef.current.drafts)
        .filter(([id, value]) => id.startsWith("draft:") && id !== key && hasChatDraft(value))
        .map(([id, value]) => ({
          id,
          title:
            (value.text.trim() || value.pending?.text)?.slice(0, 60) || "Draft dengan lampiran",
          updatedAt: value.updatedAt,
        })),
    );
  }, []);
  const persistDraft = React.useCallback((): void => {
    if (
      !userId ||
      sessionUserRef.current !== userId ||
      isLoadingHistory ||
      draftOwnerRef.current !== activeKeyRef.current
    )
      return;
    sessionRef.current = saveWorkspaceDraft(sessionRef.current, activeKeyRef.current, {
      text: draft,
      attachments: [...attachments],
      wizard: wizardState,
      dismissed: [...dismissedInputToolCallIds],
      updatedAt: Date.now(),
      pending: pendingTurn,
    });
    writeWorkspaceSession(userId, sessionRef.current);
  }, [
    userId,
    isLoadingHistory,
    draft,
    attachments,
    wizardState,
    dismissedInputToolCallIds,
    pendingTurn,
  ]);
  React.useEffect(() => {
    persistDraft();
  }, [persistDraft, conversationId]);
  React.useEffect(() => {
    if (!userId) return;
    const epoch = ++loadEpoch.current;
    let cancelled = false;
    acceptStreamData.current = false;
    sessionUserRef.current = userId;
    void stop();
    sessionRef.current = readWorkspaceSession(userId);
    messageCache.current = {};
    void (async (): Promise<void> => {
      await Promise.resolve();
      if (cancelled || epoch !== loadEpoch.current) return;
      setIsLoadingHistory(true);
      setHistoryError("");
      setMessages([]);
      setPendingTurn(null);
      setDraft("");
      setAttachments([]);
      setWizardState({ progresses: {}, paused: [] });
      setDismissedInputToolCallIds(new Set());
      setConfirmedProposals({});
      setActiveConversation(null);
      const saved = sessionRef.current.lastKey;
      if (saved?.startsWith("draft:") && sessionRef.current.drafts[saved]) {
        setActiveConversation(null);
        restoreDraft(saved);
        const pending = sessionRef.current.drafts[saved]?.pending;
        if (pending)
          setMessages([
            {
              id: pending.id,
              role: "user",
              parts: [
                { type: "text", text: pending.text },
                ...pending.attachments.map((file) => ({
                  type: "file" as const,
                  url: file.url,
                  mediaType: file.mimeType,
                  filename: file.fileName,
                })),
              ],
            },
          ]);
        setIsLoadingHistory(false);
        return;
      }
      try {
        let response = saved ? await getAiConversation(saved) : await getLatestAiConversation();
        if (!response.success && response.error.code === "NOT_FOUND")
          response = await getLatestAiConversation();
        if (cancelled || epoch !== loadEpoch.current) return;
        if (response.success) {
          const key = response.data.conversationId ?? newDraftKey();
          setActiveConversation(response.data.conversationId);
          restoreDraft(key);
          setConfirmedProposals(response.data.confirmedProposals);
          setMessages(
            restorePendingMessages(response.data.messages, sessionRef.current.drafts[key]?.pending),
          );
          setConversationTitle(response.data.title ?? "Percakapan baru");
        } else setHistoryError(response.error.message);
      } catch {
        if (!cancelled && epoch === loadEpoch.current)
          setHistoryError("Percakapan belum dapat dimuat. Coba lagi.");
      } finally {
        if (!cancelled && epoch === loadEpoch.current) setIsLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
      acceptStreamData.current = false;
    };
  }, [userId, setActiveConversation, setMessages, restoreDraft, stop]);

  const activeInputRequest = React.useMemo(
    () => readActiveInputRequest(messages, dismissedInputToolCallIds),
    [messages, dismissedInputToolCallIds],
  );
  const activityInputRequest = activeInputRequest
    ? {
        ...activeInputRequest,
        values: wizardState.progresses[activeInputRequest.toolCallId]?.values,
      }
    : null;

  /**
   * Mengukur seluruh footer mengambang (composer dan safe area) agar ruang bawah
   * viewport selalu pas. Status balasan hidup di transcript, sehingga perubahan
   * fase tidak pernah mengubah hasil pengukuran footer.
   *
   * Saat footer tidak terpasang — daftar riwayat sedang terbuka — ukuran terakhir
   * dipertahankan agar transisi tidak menyentak posisi baca.
   */
  React.useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer) return undefined;

    function measure(element: HTMLElement): void {
      setFooterHeight(Math.round(element.getBoundingClientRect().height));
    }

    measure(footer);
    const observer = new ResizeObserver(() => measure(footer));
    observer.observe(footer);

    return () => observer.disconnect();
  }, [showPicker]);

  /**
   * `AnimatePresence mode="wait"` menahan panel lama tetap terpasang sampai
   * animasi keluarnya selesai. Menggulir berdasarkan `showPicker` karena itu
   * memindahkan panel yang **masih terlihat** — percakapan tersentak ke atas
   * sebelum daftar riwayat muncul. Jadi pergulingan diikatkan pada pemasangan
   * panel yang dituju, bukan pada perubahan state-nya.
   */
  const chatPanelMountedRef = React.useRef(false);

  const handleChatPanelMount = React.useCallback(
    (node: HTMLDivElement | null): void => {
      chatPanelMountedRef.current = node !== null;
      if (node) openAtBottom();
    },
    [openAtBottom],
  );

  /**
   * Satu-satunya lompatan ke dasar percakapan: saat halaman AI baru dibuka —
   * lewat tombol chat di header maupun langsung — dan saat percakapan lain
   * dipilih dari riwayat. Di luar dua kesempatan itu posisi baca milik pengguna.
   */
  React.useLayoutEffect(() => {
    if (isLoadingHistory || !chatPanelMountedRef.current) return;
    openAtBottom();
  }, [isLoadingHistory, openedConversationId, openAtBottom]);

  /**
   * Jawaban yang bertambah diikuti selama pengguna masih membaca di dasar.
   */
  React.useEffect(() => {
    if (historyOnly || !isBusy) return;
    followStream();
  }, [messages, historyOnly, isWaitingFirstToken, isBusy, followStream]);

  /**
   * Kartu usulan baru muncul pada commit yang sama saat jawaban berhenti
   * mengalir; sekali dorong yang halus membawanya ke dalam layar jika pengguna
   * masih mengikuti jawaban. Hanya dijalankan pada peralihan selesai-mengalir
   * — bukan saat halaman dibuka, yang justru harus mendarat di dasar.
   */
  const wasBusyRef = React.useRef(false);
  React.useEffect(() => {
    const streamJustEnded = wasBusyRef.current && !isBusy;
    wasBusyRef.current = isBusy;
    if (historyOnly || !streamJustEnded) return;
    followStream("smooth");
  }, [isBusy, historyOnly, followStream]);

  // Composer yang tumbuh tetap memberi ruang untuk jawaban jika pengguna di dasar.
  React.useLayoutEffect(() => {
    if (historyOnly) return;
    followStream();
  }, [bottomInset, historyOnly, followStream]);

  const handleStop = React.useCallback((): void => {
    // Sembunyikan indicator pada update klik yang sama; jangan menunggu SDK
    // menerbitkan `ready` setelah pembatalan stream selesai diproses.
    setStatusSuppressed(true);
    sendLockRef.current = false;
    stop();
  }, [stop]);

  const handleRegenerate = React.useCallback((): void => {
    if (isBusy || sendLockRef.current) return;
    sendLockRef.current = true;
    acceptStreamData.current = true;
    clearError();
    setStatusSuppressed(false);
    setReplyCycle((current) => current + 1);
    void regenerate({
      body: {
        conversationId: conversationIdRef.current,
        ...(pendingTurn ? { attachments: pendingTurn.attachments } : {}),
      },
    }).finally(() => {
      sendLockRef.current = false;
      setHistoryRevision((current) => current + 1);
    });
  }, [regenerate, clearError, isBusy, pendingTurn]);

  const submit = React.useCallback(
    (text: string, consumeComposer = true) => {
      const trimmed = text.trim();
      if (
        (trimmed.length === 0 && (!consumeComposer || attachments.length === 0)) ||
        isBusy ||
        isLoadingHistory ||
        sendLockRef.current ||
        (consumeComposer && (isUploading || uploadLockRef.current))
      )
        return;
      sendLockRef.current = true;
      acceptStreamData.current = true;
      if (!conversationIdRef.current)
        setConversationTitle(trimmed.slice(0, 100) || "Analisis lampiran");
      setStatusSuppressed(false);
      setReplyCycle((current) => current + 1);
      clearError();
      const currentAttachments = consumeComposer ? [...attachments] : [];
      if (consumeComposer) {
        setDraft("");
        setAttachments([]);
      }
      // Mengirim pertanyaan berarti pengguna kembali mengikuti jawaban
      resumeFollowing();
      const promptText =
        trimmed.length > 0 ? trimmed : "Tolong periksa dan analisa berkas terlampir.";
      const fileParts = currentAttachments.map((att) => ({
        type: "file" as const,
        mediaType: att.mimeType,
        filename: att.fileName,
        url: att.url,
      }));
      const id = crypto.randomUUID();
      setPendingTurn({ id, text: promptText, attachments: currentAttachments });

      void sendMessage(
        { id, role: "user", parts: [{ type: "text", text: promptText }, ...fileParts] },
        {
          body: {
            conversationId: conversationIdRef.current,
            attachments: currentAttachments,
          },
        },
      )
        .catch(() => undefined)
        .finally(() => {
          sendLockRef.current = false;
          setHistoryRevision((current) => current + 1);
        });
    },
    [attachments, clearError, isBusy, isLoadingHistory, isUploading, resumeFollowing, sendMessage],
  );

  const uploadFiles = React.useCallback(
    async (files: FileList | readonly File[]): Promise<void> => {
      if (!files || files.length === 0) return;
      if (uploadLockRef.current || isBusy) {
        toast.error("Tunggu proses sebelumnya selesai sebelum mengunggah.");
        return;
      }
      const validation = validateAttachmentBatch(Array.from(files), attachments.length);
      if (!validation.valid) {
        toast.error(validation.reason);
        return;
      }
      uploadLockRef.current = true;

      setIsUploading(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file) continue;
          const check = isSupportedAttachment(file);
          if (!check.valid) {
            toast.error(check.reason);
            continue;
          }

          const uploaded = await uploadToImageKit({
            file,
            folder: "/chat-attachments",
            fileNamePrefix: "chat",
            subject: "lampiran chat",
          });

          setAttachments((prev) => [
            ...prev,
            {
              url: uploaded.url,
              fileName: file.name,
              mimeType: uploaded.mimeType,
              size: uploaded.size,
            },
          ]);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal mengunggah lampiran.");
      } finally {
        uploadLockRef.current = false;
        setIsUploading(false);
      }
    },
    [attachments.length, isBusy],
  );

  const handleDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (historyOnly || isUploading) return;
      const hasFiles = Array.from(event.dataTransfer.types).includes("Files");
      if (!hasFiles) return;

      event.preventDefault();
      dragDepthRef.current += 1;
      if (dragDepthRef.current === 1) {
        setIsDraggingOver(true);
      }
    },
    [isUploading, historyOnly],
  );

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (historyOnly || isUploading) return;
      const hasFiles = Array.from(event.dataTransfer.types).includes("Files");
      if (!hasFiles) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [isUploading, historyOnly],
  );

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (historyOnly || isUploading) return;
      const hasFiles = Array.from(event.dataTransfer.types).includes("Files");
      if (!hasFiles) return;

      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDraggingOver(false);
      }
    },
    [isUploading, historyOnly],
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (historyOnly || isUploading) return;
      const hasFiles = Array.from(event.dataTransfer.types).includes("Files");
      if (!hasFiles) return;

      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingOver(false);

      const files = event.dataTransfer.files;
      if (files && files.length > 0) {
        void uploadFiles(files);
      }
    },
    [isUploading, historyOnly, uploadFiles],
  );

  const openPicker = React.useCallback(
    (): void => setHistoryChoice((current) => !(current ?? (desktop && wideHistory))),
    [desktop, wideHistory],
  );
  const startNewConversation = React.useCallback((): void => {
    if (isBusy || isLoadingHistory || isUploading) return;
    persistDraft();
    acceptStreamData.current = false;
    loadEpoch.current++;
    void stop();
    clearError();
    if (!desktop) setShowPicker(false);
    setMessages([]);
    setConfirmedProposals({});
    setConversationTitle("Percakapan baru");
    setHistoryError("");
    setActiveConversation(null);
    restoreDraft(newDraftKey());
  }, [
    isBusy,
    isLoadingHistory,
    isUploading,
    persistDraft,
    stop,
    clearError,
    desktop,
    setShowPicker,
    setMessages,
    setActiveConversation,
    restoreDraft,
  ]);
  const selectConversation = React.useCallback(
    async (id: string, title?: string): Promise<void> => {
      if (isUploading) {
        toast.message("Tunggu unggahan selesai sebelum berpindah percakapan.");
        return;
      }
      persistDraft();
      messageCache.current = { ...messageCache.current, [activeKeyRef.current]: messages };
      const epoch = ++loadEpoch.current;
      acceptStreamData.current = false;
      await stop();
      if (epoch !== loadEpoch.current) return;
      pendingConversationRef.current = id;
      clearError();
      if (!desktop) setShowPicker(false);
      setIsLoadingHistory(true);
      setHistoryError("");
      if (id.startsWith("draft:")) {
        setActiveConversation(null);
        restoreDraft(id);
        const pending = sessionRef.current.drafts[id]?.pending;
        setMessages(
          pending
            ? [
                {
                  id: pending.id,
                  role: "user",
                  parts: [
                    { type: "text", text: pending.text },
                    ...pending.attachments.map((file) => ({
                      type: "file" as const,
                      url: file.url,
                      mediaType: file.mimeType,
                      filename: file.fileName,
                    })),
                  ],
                },
              ]
            : [],
        );
        setConfirmedProposals({});
        setConversationTitle("Percakapan baru");
        setIsLoadingHistory(false);
        return;
      }
      try {
        const response = await getAiConversation(id);
        if (epoch !== loadEpoch.current) return;
        if (response.success) {
          setActiveConversation(response.data.conversationId);
          restoreDraft(id);
          setConfirmedProposals(response.data.confirmedProposals);
          setMessages(
            restorePendingMessages(
              (messageCache.current[id]?.length ?? 0) > response.data.messages.length
                ? [...messageCache.current[id]]
                : response.data.messages,
              sessionRef.current.drafts[id]?.pending,
            ),
          );
          setConversationTitle(response.data.title ?? title ?? "Percakapan");
        } else setHistoryError(response.error.message);
      } catch {
        if (epoch === loadEpoch.current)
          setHistoryError("Percakapan belum dapat dimuat. Coba lagi.");
      } finally {
        if (epoch === loadEpoch.current) setIsLoadingHistory(false);
      }
    },
    [
      isUploading,
      persistDraft,
      messages,
      stop,
      clearError,
      desktop,
      setShowPicker,
      setActiveConversation,
      restoreDraft,
      setMessages,
    ],
  );

  const handleBack = React.useCallback(() => {
    if (showPicker) setShowPicker(false);
    else router.back();
  }, [router, showPicker, setShowPicker]);

  const handleNewConversation = React.useCallback(() => {
    void startNewConversation();
  }, [startNewConversation]);

  /**
   * Kontrol bilah atas dititipkan ke bilah milik shell, bukan dirender di sini.
   *
   * Halaman ini dulu merender bilahnya sendiri, sehingga berpindah ke sini
   * membongkar satu bilah lalu memasang bilah lain — tidak ada instance yang
   * bertahan, dan lebar pil judul patah alih-alih bermorf.
   */
  useProvideTopBarSlots(
    () =>
      aiChatTopBarSlots({
        showPicker,
        desktop,
        conversationTitle,
        isBusy: isBusy || isLoadingHistory || isUploading,
        onBack: handleBack,
        onNewConversation: handleNewConversation,
        onOpenPicker: openPicker,
      }),
    [
      showPicker,
      desktop,
      conversationTitle,
      isBusy,
      isLoadingHistory,
      isUploading,
      handleBack,
      handleNewConversation,
      openPicker,
    ],
  );

  const handleActiveDeleted = React.useCallback(() => {
    delete sessionRef.current.drafts[activeKeyRef.current];
    loadEpoch.current++;
    acceptStreamData.current = false;
    void stop();
    restoreDraft(newDraftKey());
    setConversationTitle("Percakapan baru");
    setMessages([]);
    setConfirmedProposals({});
    setActiveConversation(null);
  }, [setActiveConversation, setMessages, restoreDraft, stop]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={
        desktop
          ? "relative mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
          : "relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-background"
      }
    >
      <ChatDropOverlay isDragging={isDraggingOver} />
      <div className="relative flex min-h-0 flex-1">
        <motion.aside
          initial={false}
          animate={{
            width: showPicker ? (desktop ? 260 : "100%") : 0,
            opacity: showPicker ? 1 : 0,
          }}
          transition={reduceMotion ? { duration: 0 } : transitionSpringSmooth}
          inert={!showPicker}
          aria-hidden={!showPicker || undefined}
          hidden={!desktop && !showPicker}
          onFocusCapture={() => {
            if (showPicker) setHistoryChoice(true);
          }}
          className={
            desktop
              ? "relative min-h-0 shrink-0 overflow-hidden border-ring-subtle bg-surface-container-low"
              : "absolute inset-0 z-30 overflow-y-auto bg-background"
          }
        >
          <div
            className={
              desktop
                ? "h-full w-65 overflow-y-auto border-r border-ring-subtle px-3 py-4"
                : "px-margin-mobile pt-20"
            }
          >
            <ConversationHistoryWorkspace
              compact={desktop}
              activeId={conversationId}
              onSelect={(id, title) => void selectConversation(id, title)}
              onNewConversation={startNewConversation}
              onActiveDeleted={handleActiveDeleted}
              refreshKey={String(historyRevision)}
              localDrafts={localDrafts}
              onTitleChange={(id, title) => {
                if (id === conversationId) setConversationTitle(title);
              }}
            />
          </div>
        </motion.aside>
        <div hidden={historyOnly} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Main Scrollable Content Area */}
          <div
            ref={viewportRef}
            className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-margin-mobile"
            style={{ paddingTop: desktop ? 16 : TOP_BAR_INSET_PX, paddingBottom: bottomInset }}
          >
            <div
              ref={contentRef}
              className={desktop ? "mx-auto w-full max-w-166 space-y-lg" : "space-y-lg"}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key="chat-view"
                  ref={handleChatPanelMount}
                  initial={reduceMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  transition={transitionEaseSmooth}
                  className="flex flex-col gap-md"
                >
                  {/*
                   * Kerangka → isi, dan percakapan → keadaan kosong saat memulai
                   * percakapan baru. Keduanya berganti TANPA berpindah tampilan,
                   * jadi pertukaran seketika terbaca sebagai kedipan, bukan
                   * keputusan.
                   *
                   * Keduanya ditumpuk di satu sel grid, bukan mengalir berurutan:
                   * selama saling menyilang keduanya terpasang, dan dalam aliran
                   * normal tinggi wadah sesaat menjadi jumlah keduanya lalu
                   * mendorong posisi gulir. Di satu sel, tingginya hanya setinggi
                   * yang tertinggi.
                   */}
                  {/*
                   * `mode="popLayout"`: keadaan kosong yang sedang keluar
                   * dikeluarkan dari aliran seketika.
                   *
                   * Keduanya ditumpuk di satu sel grid, jadi tinggi sel itu adalah
                   * tinggi **yang tertinggi di antara keduanya**. Pada percakapan
                   * baru, keadaan kosong jauh lebih tinggi daripada satu pesan
                   * pertama — sehingga selama persilangan, sel itu masih setinggi
                   * keadaan kosong dan penanda yang berdiri sesudahnya terdorong
                   * jauh ke bawah, lalu melompat ke tempatnya begitu keadaan
                   * kosong benar-benar dilepas.
                   */}
                  <div className="relative grid grid-cols-1 grid-rows-1">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.div
                        key={
                          isLoadingHistory
                            ? "history"
                            : messages.length === 0
                              ? "empty"
                              : "messages"
                        }
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={transitionEaseSmooth}
                        className="col-start-1 row-start-1"
                      >
                        {historyError ? (
                          <div
                            role="alert"
                            className="space-y-3 rounded-owner bg-surface-container-lowest p-4"
                          >
                            <p className="text-support">{historyError}</p>
                            <Button
                              variant="secondary"
                              size="compact"
                              onClick={() => {
                                if (pendingConversationRef.current)
                                  void selectConversation(pendingConversationRef.current);
                                else if (conversationId) void selectConversation(conversationId);
                                else window.location.reload();
                              }}
                            >
                              Coba lagi
                            </Button>
                          </div>
                        ) : isLoadingHistory ? (
                          <ChatHistorySkeleton />
                        ) : messages.length === 0 ? (
                          <ChatEmptyState onSelect={submit} disabled={isBusy} />
                        ) : (
                          <div className="space-y-lg pb-4">
                            {chatTurns.map((turn, index) => {
                              const isLast = index === chatTurns.length - 1;

                              return (
                                <ChatTurn
                                  key={turn.key}
                                  user={turn.user}
                                  assistant={turn.assistant}
                                  conversationId={conversationId}
                                  confirmedProposals={confirmedProposals}
                                  showFollowUps={!isBusy && isLast}
                                  onFollowUp={(text) => submit(text, false)}
                                  isCurrent={isLast}
                                  isBusy={isBusy}
                                  statusSuppressed={statusSuppressed}
                                  replyCycle={replyCycle}
                                  pendingInput={activityInputRequest}
                                />
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Error feedback */}
                  <AnimatePresence>
                    {(error ||
                      (!isBusy &&
                        !isLoadingHistory &&
                        (pendingTurn || unansweredTurn(messages)))) && (
                      <motion.div
                        initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                        transition={transitionSpringBouncy}
                        role="alert"
                        aria-live="assertive"
                        className="bg-danger-container/40 text-danger ring-danger/25 flex items-center justify-between gap-3 rounded-2xl p-3.5 ring-1"
                      >
                        <div className="flex min-w-0 items-center gap-2.5 text-row font-semibold">
                          <AppIcon name="warning" className="icon-sm shrink-0" />
                          <span>
                            {error
                              ? chatFailureMessage(error, !navigator.onLine)
                              : "Jawaban belum selesai. Pertanyaan tetap tersedia; coba lagi untuk melanjutkan."}
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="compact"
                          className="shrink-0 whitespace-nowrap"
                          disabled={isBusy}
                          onClick={handleRegenerate}
                        >
                          Coba lagi
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Progressive Bottom Gradient Mask Overlay (Matched to composer height) */}
          {!historyOnly && (
            <div
              aria-hidden="true"
              style={{ height: bottomInset }}
              className={
                desktop
                  ? "scroll-edge-scrim scroll-edge-scrim-bottom pointer-events-none absolute inset-x-0 bottom-0 z-30 mx-auto w-full"
                  : "scroll-edge-scrim scroll-edge-scrim-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md"
              }
            />
          )}

          {/* Floating Bottom Bar */}
          {!historyOnly && (
            <footer
              ref={footerRef}
              inert={isLoadingHistory}
              className={
                desktop
                  ? "pointer-events-none absolute inset-x-0 bottom-3 z-40 mx-auto w-full max-w-176 px-margin-mobile pb-[env(safe-area-inset-bottom)]"
                  : "pointer-events-none fixed inset-x-0 bottom-3 z-40 mx-auto w-full max-w-md px-margin-mobile pb-[env(safe-area-inset-bottom)]"
              }
            >
              <div className="pointer-events-auto w-full">
                <AnimatePresence initial={false}>
                  {awayFromBottom && messages.length > 0 && (
                    <motion.div
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={transitionEaseSmooth}
                      className="overflow-hidden"
                    >
                      <div className="flex justify-center pb-2">
                        <Button
                          variant="secondary"
                          size="compact"
                          className="bg-surface-container-lowest! text-on-surface!"
                          onClick={jumpToBottom}
                        >
                          <AppIcon name="arrow_downward" className="icon-sm" />
                          Ke jawaban terbaru
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <ChatComposerDock
                  request={activeInputRequest}
                  disabled={isLoadingHistory}
                  wizardState={wizardState}
                  onWizardStateChange={setWizardState}
                  conversationId={conversationId}
                  onWizardSubmit={(text) => {
                    if (!activeInputRequest || isBusy || sendLockRef.current) return;
                    setDismissedInputToolCallIds(
                      (current) => new Set([...current, activeInputRequest.toolCallId]),
                    );
                    submit(text, false);
                  }}
                  onWizardCancel={() => {
                    if (!activeInputRequest || isBusy || sendLockRef.current) return;
                    setDismissedInputToolCallIds(
                      (current) => new Set([...current, activeInputRequest.toolCallId]),
                    );
                    submit(
                      "Saya batalkan pengisian data untuk " +
                        activeInputRequest.payload.actionTitle +
                        ".",
                      false,
                    );
                  }}
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => submit(draft)}
                  onStop={handleStop}
                  isBusy={isBusy}
                  attachments={attachments}
                  isUploading={isUploading}
                  onUploadFiles={uploadFiles}
                  onAddAttachment={(att) => setAttachments((prev) => [...prev, att])}
                  onRemoveAttachment={(index) =>
                    setAttachments((prev) => prev.filter((_, i) => i !== index))
                  }
                />
              </div>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
