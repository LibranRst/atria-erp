"use client";

import {
  deleteAiConversation,
  getAiConversation,
  getLatestAiConversation,
  listAiConversations,
  startAiConversation,
} from "@/app/actions/ai/chat-history";
import { AppIcon, BottomSheet, Button, IconButton } from "@/components/ui";
import {
  riseInVariants,
  spinAnimation,
  thinkingDotAnimation,
  thinkingDotTransition,
  transitionEaseSmooth,
  transitionSpinLinear,
  transitionSpringSmooth,
} from "@/lib/utils/motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { ChatComposer } from "./chat-composer";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatHistorySkeleton } from "./chat-history-skeleton";
import { ChatMessage } from "./chat-message";
import { ConversationPicker, type ConversationSummary } from "./conversation-picker";

/**
 * Permukaan percakapan dengan asisten AI.
 *
 * Dibangun di atas `BottomSheet` bersama supaya mewarisi perangkap fokus,
 * penguncian scroll, penanganan Escape, dan hierarki z-index yang sudah berlaku
 * di seluruh aplikasi.
 */

type AiChatSheetProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Dipanggil setelah animasi menutup selesai, agar induk boleh melepas sheet. */
  readonly onExitComplete?: () => void;
};

type ConversationData = { readonly conversationId: string };

function isConversationData(value: unknown): value is ConversationData {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ConversationData).conversationId === "string"
  );
}

/** Jarak dari dasar yang masih dianggap "sedang mengikuti percakapan". */
const NEAR_BOTTOM_THRESHOLD_PX = 72;

/**
 * Menghitung seberapa jauh sebuah elemen tergulir dari dasarnya.
 *
 * Sengaja tidak mencari elemen penggulir lewat computed style saat effect
 * berjalan: body sheet baru berubah menjadi dapat digulir setelah isinya
 * melimpah, sehingga pencarian di awal selalu gagal dan penambatan tidak pernah
 * aktif. Sebagai gantinya, peristiwa scroll ditangkap di fase capture dan
 * elemen yang benar-benar menggulir dikenali dari sana.
 */
function distanceFromBottom(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

function ThinkingIndicator(): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      layout
      initial={reduceMotion ? undefined : { opacity: 0, scale: 0.94, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.94, y: -6 }}
      transition={transitionSpringSmooth}
      className="flex justify-start"
      role="status"
      aria-label="Asisten sedang menyiapkan jawaban"
    >
      <div className="flex items-center gap-2.5 rounded-[22px] rounded-tl-md bg-white px-4 py-2.5 shadow-surface ring-1 ring-ring-subtle">
        <motion.span
          className="flex text-on-surface-variant"
          animate={reduceMotion ? undefined : spinAnimation}
          transition={transitionSpinLinear}
          aria-hidden="true"
        >
          <AppIcon name="progress_activity" className="icon-xs" />
        </motion.span>
        <span className="text-support font-semibold text-on-surface-variant">
          Menyiapkan jawaban…
        </span>
        {/* Berdenyut di tempat, bukan memantul: pantulan vertikal terbaca murahan
            dan menarik perhatian melebihi bobot informasinya. */}
        <span className="flex items-center gap-1 pl-0.5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="h-1.5 w-1.5 rounded-full bg-on-surface-variant/70"
              animate={reduceMotion ? undefined : thinkingDotAnimation}
              transition={thinkingDotTransition(index)}
            />
          ))}
        </span>
      </div>
    </motion.div>
  );
}

export function AiChatSheet({
  open,
  onClose,
  onExitComplete,
}: AiChatSheetProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const [draft, setDraft] = React.useState("");
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [confirmedProposals, setConfirmedProposals] = React.useState<Record<string, string>>({});
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(true);
  const [showPicker, setShowPicker] = React.useState(false);
  const [conversations, setConversations] = React.useState<readonly ConversationSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = React.useState(false);

  const conversationIdRef = React.useRef<string | null>(null);
  const scrollAnchorRef = React.useRef<HTMLDivElement>(null);
  const chatViewRef = React.useRef<HTMLDivElement>(null);
  const isNearBottomRef = React.useRef(true);
  const scrollRafRef = React.useRef<number | null>(null);

  const setActiveConversation = React.useCallback((next: string | null) => {
    conversationIdRef.current = next;
    setConversationId(next);
  }, []);

  // Transport dibuat sekali seumur komponen. Riwayat tidak dikirim dari klien:
  // server membacanya sendiri dari database, sehingga percakapan tidak bisa
  // dipalsukan lewat payload permintaan. Id percakapan ikut per permintaan
  // melalui `body` yang diisi saat pesan dikirim.
  const [transport] = React.useState(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages[messages.length - 1];
          const text = (last?.parts ?? [])
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("");

          return {
            body: { conversationId: body?.conversationId ?? null, text },
          };
        },
      }),
  );

  const { messages, setMessages, sendMessage, status, error, stop, regenerate, clearError } =
    useChat({
      transport,
      onData: (part) => {
        if (part.type === "data-conversation" && isConversationData(part.data)) {
          setActiveConversation(part.data.conversationId);
        }
      },
    });

  const isBusy = status === "submitted" || status === "streaming";
  const isWaitingFirstToken = status === "submitted";

  // Percakapan terakhir dilanjutkan saat sheet dibuka, supaya asisten tidak
  // kehilangan konteks setiap kali sheet ditutup.
  React.useEffect(() => {
    let cancelled = false;

    void getLatestAiConversation().then((response) => {
      if (cancelled) return;
      if (response.success) {
        setActiveConversation(response.data.conversationId);
        setConfirmedProposals(response.data.confirmedProposals);
        if (response.data.messages.length > 0) {
          setMessages(response.data.messages);
        }
      }
      setIsLoadingHistory(false);
    });

    return () => {
      cancelled = true;
    };
  }, [setActiveConversation, setMessages]);

  /**
   * Scroll otomatis hanya dilakukan ketika pengguna memang sedang berada di
   * dasar percakapan. Tanpa penambatan ini, setiap token yang mengalir dan
   * setiap kartu yang selesai dirender akan menarik paksa tampilan ke bawah —
   * dan itu membuat membaca kartu di atas menjadi mustahil selama jawaban masih
   * berjalan.
   */
  const scrollToBottom = React.useCallback(
    (behavior: ScrollBehavior = "smooth", force = false) => {
      if (!force && !isNearBottomRef.current) return;
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollAnchorRef.current?.scrollIntoView({ block: "end", behavior });
      });
    },
    [],
  );

  // Melacak apakah pengguna masih menempel di dasar percakapan.
  React.useEffect(() => {
    if (!open || showPicker) return undefined;

    function handleScroll(event: Event): void {
      const target = event.target;
      const anchor = scrollAnchorRef.current;
      if (!(target instanceof HTMLElement) || !anchor || !target.contains(anchor)) return;
      isNearBottomRef.current = distanceFromBottom(target) <= NEAR_BOTTOM_THRESHOLD_PX;
    }

    // Fase capture: peristiwa scroll pada elemen tidak menggelembung ke document,
    // jadi ini satu-satunya cara menangkapnya tanpa menebak elemen mana yang menggulir.
    document.addEventListener("scroll", handleScroll, true);
    return () => document.removeEventListener("scroll", handleScroll, true);
  }, [open, showPicker]);

  // Scroll otomatis setiap kali pesan baru masuk, token mengalir, atau status berubah
  React.useEffect(() => {
    if (!open || showPicker) return;
    scrollToBottom(isBusy ? "auto" : "smooth");
  }, [messages, open, showPicker, isWaitingFirstToken, isBusy, scrollToBottom]);

  // Pantau perubahan ukuran elemen dinamis (accordion, cards, dll.)
  React.useEffect(() => {
    if (!open || showPicker) return;
    const anchor = scrollAnchorRef.current;
    const container = anchor?.parentElement;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      scrollToBottom(isBusy ? "auto" : "smooth");
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [open, showPicker, isBusy, scrollToBottom]);

  const submit = React.useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || isBusy) return;
      clearError();
      setDraft("");
      // Mengirim pesan berarti pengguna kembali mengikuti percakapan, walaupun
      // sebelumnya ia sedang membaca bagian atas.
      isNearBottomRef.current = true;
      scrollToBottom("smooth", true);
      void sendMessage({ text: trimmed }, { body: { conversationId: conversationIdRef.current } });
    },
    [clearError, isBusy, sendMessage, scrollToBottom],
  );

  const refreshConversationList = React.useCallback(async () => {
    setIsLoadingList(true);
    const response = await listAiConversations();
    if (response.success) {
      setConversations(response.data);
    }
    setIsLoadingList(false);
  }, []);

  const openPicker = React.useCallback(() => {
    setShowPicker(true);
    void refreshConversationList();
  }, [refreshConversationList]);

  const startNewConversation = React.useCallback(async () => {
    if (isBusy) return;
    stop();
    clearError();
    setShowPicker(false);
    setMessages([]);
    setConfirmedProposals({});
    setDraft("");

    const response = await startAiConversation();
    setActiveConversation(response.success ? response.data.conversationId : null);
  }, [clearError, isBusy, setActiveConversation, setMessages, stop]);

  const selectConversation = React.useCallback(
    async (id: string) => {
      stop();
      clearError();
      setShowPicker(false);
      setIsLoadingHistory(true);

      const response = await getAiConversation(id);
      if (response.success) {
        setActiveConversation(response.data.conversationId);
        setConfirmedProposals(response.data.confirmedProposals);
        setMessages(response.data.messages);
      }
      setIsLoadingHistory(false);
    },
    [clearError, setActiveConversation, setMessages, stop],
  );

  const removeConversation = React.useCallback(
    async (id: string) => {
      const response = await deleteAiConversation(id);
      if (!response.success) return;

      setConversations((current) => current.filter((conversation) => conversation.id !== id));

      // Menghapus percakapan yang sedang dibuka harus mengosongkan layar juga,
      // agar tidak ada pesan yatim yang tampil tanpa induk di database.
      if (conversationIdRef.current === id) {
        setMessages([]);
        setConfirmedProposals({});
        setActiveConversation(null);
      }
    },
    [setActiveConversation, setMessages],
  );

  // Tidak boleh mengembalikan null saat tertutup: BottomSheet perlu tetap
  // terpasang agar AnimatePresence-nya bisa menjalankan animasi keluar.
  return (
    <BottomSheet
      open={open}
      title={showPicker ? "Percakapan" : "Asisten Atria"}
      initialExpanded
      onClose={onClose}
      onExitComplete={onExitComplete}
      action={
        showPicker ? (
          // Bukan ikon silang: sheet sudah punya tombol tutup sendiri di sisi kiri,
          // dan dua silang berdampingan membuat aksinya tidak bisa dibedakan.
          <IconButton
            label="Kembali ke percakapan"
            variant="secondary"
            onClick={() => setShowPicker(false)}
            icon={<AppIcon name="arrow_back" className="icon-lg" />}
          />
        ) : (
          <IconButton
            label="Daftar percakapan"
            variant="secondary"
            onClick={openPicker}
            icon={<AppIcon name="history" className="icon-lg" />}
          />
        )
      }
      footer={
        showPicker ? undefined : (
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSubmit={() => submit(draft)}
            onStop={stop}
            isBusy={isBusy}
          />
        )
      }
    >
      <div className="flex min-h-[62svh] flex-col gap-md">
        <AnimatePresence mode="wait" initial={false}>
          {showPicker ? (
            <motion.div
              key="picker-view"
              initial={reduceMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={transitionEaseSmooth}
              className="space-y-md"
            >
              <Button
                variant="secondary"
                className="w-full"
                disabled={isBusy}
                onClick={() => void startNewConversation()}
              >
                Mulai percakapan baru
              </Button>
              <ConversationPicker
                conversations={conversations}
                activeId={conversationId}
                loading={isLoadingList}
                onSelect={(id) => void selectConversation(id)}
                onDelete={(id) => void removeConversation(id)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="chat-view"
              ref={chatViewRef}
              initial={reduceMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={transitionEaseSmooth}
              className="flex flex-col gap-md"
            >
              {/* Pertukaran kerangka → isi ikut memudar, bukan berganti seketika.
                  `mode="wait"` menahan yang masuk sampai yang keluar selesai,
                  sehingga tidak ada dua tinggi berbeda yang tumpang tindih. */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={
                    isLoadingHistory ? "history" : messages.length === 0 ? "empty" : "conversation"
                  }
                  initial={reduceMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  transition={transitionEaseSmooth}
                >
                  {isLoadingHistory ? (
                    <ChatHistorySkeleton />
                  ) : messages.length === 0 ? (
                    <ChatEmptyState onSelect={submit} disabled={isBusy} />
                  ) : (
                    // `initial={false}` membuat pesan yang sudah ada saat riwayat
                    // dimuat tampil langsung; hanya giliran baru yang beranimasi.
                    <AnimatePresence initial={false}>
                      <div className="space-y-lg">
                        {messages.map((message, index) => (
                          <motion.div
                            key={message.id}
                            variants={riseInVariants}
                            initial={reduceMotion ? false : "hidden"}
                            animate="visible"
                          >
                            <ChatMessage
                              message={message}
                              conversationId={conversationId}
                              confirmedProposals={confirmedProposals}
                              showFollowUps={!isBusy && index === messages.length - 1}
                              onFollowUp={submit}
                              isBusy={isBusy}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </AnimatePresence>
                  )}
                </motion.div>
              </AnimatePresence>

              <AnimatePresence>
                {isWaitingFirstToken && <ThinkingIndicator key="thinking-pill" />}
              </AnimatePresence>

              {error && (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transitionSpringSmooth}
                  className="space-y-2.5"
                  role="alert"
                >
                  <div className="flex items-start gap-2 text-critical">
                    <AppIcon name="warning" aria-hidden="true" className="mt-px icon-sm shrink-0" />
                    <p className="text-support font-semibold">
                      Asisten gagal menjawab. Jawaban sebelumnya tetap tersimpan.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      clearError();
                      void regenerate({ body: { conversationId: conversationIdRef.current } });
                    }}
                  >
                    Coba lagi
                  </Button>
                </motion.div>
              )}

              <div ref={scrollAnchorRef} aria-hidden="true" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BottomSheet>
  );
}
