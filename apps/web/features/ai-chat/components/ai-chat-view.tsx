"use client";

import { getAiConversation, getLatestAiConversation } from "@/app/actions/ai/chat-history";
import { AppIcon, Button } from "@/components/ui";
import {
  transitionEaseSmooth,
  transitionSpringBouncy,
  transitionSpringSmooth,
} from "@/lib/utils/motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import * as React from "react";

import { TOP_BAR_INSET_PX } from "@/components/layout/app-top-bar";
import { useProvideTopBarSlots } from "@/components/layout/top-bar-slots";

import { aiChatTopBarSlots } from "./ai-chat-top-bar";
import { ChatComposer } from "./chat-composer";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatHistorySkeleton } from "./chat-history-skeleton";
import { ChatTurn } from "./chat-turn";
import { ConversationHistoryWorkspace } from "./conversation-history-workspace";
import { MorphedInputComposer } from "./morphed-input-composer";
import { useChatScroll } from "../hooks/use-chat-scroll";
import { groupChatTurns } from "../utils/chat-turns";
import { readActiveInputRequest } from "../utils/input-request-reader";

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

export function AiChatView(): React.JSX.Element {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [draft, setDraft] = React.useState("");
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [confirmedProposals, setConfirmedProposals] = React.useState<Record<string, string>>({});
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(true);
  const [showPicker, setShowPicker] = React.useState(false);
  const [statusSuppressed, setStatusSuppressed] = React.useState(false);
  const [replyCycle, setReplyCycle] = React.useState(0);
  const [dismissedInputToolCallIds, setDismissedInputToolCallIds] = React.useState<
    ReadonlySet<string>
  >(() => new Set());

  const conversationIdRef = React.useRef<string | null>(null);
  const footerRef = React.useRef<HTMLElement | null>(null);
  const [footerHeight, setFooterHeight] = React.useState(FALLBACK_FOOTER_HEIGHT_PX);

  const bottomInset = footerHeight + COMPOSER_OFFSET_PX + COMPOSER_BREATHING_PX;

  const setActiveConversation = React.useCallback((next: string | null) => {
    conversationIdRef.current = next;
    setConversationId(next);
  }, []);

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

  const chatTurns = React.useMemo(() => groupChatTurns(messages), [messages]);

  const { viewportRef, contentRef, jumpToBottom, followStream, resumeFollowing } = useChatScroll(
    isBusy && !showPicker,
  );

  // Muat percakapan terakhir saat halaman dibuka
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

  const activeInputRequest = React.useMemo(
    () => readActiveInputRequest(messages, dismissedInputToolCallIds),
    [messages, dismissedInputToolCallIds],
  );

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
      if (node) jumpToBottom();
    },
    [jumpToBottom],
  );

  const handlePickerPanelMount = React.useCallback(
    (node: HTMLDivElement | null): void => {
      if (node) viewportRef.current?.scrollTo({ top: 0, behavior: "auto" });
    },
    [viewportRef],
  );

  /**
   * Satu-satunya lompatan ke dasar percakapan: saat halaman AI baru dibuka —
   * lewat tombol chat di header maupun langsung — dan saat percakapan lain
   * dipilih dari riwayat. Di luar dua kesempatan itu posisi baca milik pengguna.
   */
  React.useLayoutEffect(() => {
    if (isLoadingHistory || !chatPanelMountedRef.current) return;
    jumpToBottom();
  }, [isLoadingHistory, conversationId, jumpToBottom]);

  /**
   * Selama jawaban mengalir, tampilan mengikuti teks yang bertambah sampai
   * gelembung pertanyaan terakhir menyentuh bilah atas, lalu berhenti di situ.
   */
  React.useEffect(() => {
    if (showPicker || !isBusy) return;
    followStream();
  }, [messages, showPicker, isWaitingFirstToken, isBusy, followStream]);

  /**
   * Kartu usulan baru muncul pada commit yang sama saat jawaban berhenti
   * mengalir; sekali dorong yang halus membawanya ke dalam layar tanpa melewati
   * batas gelembung pertanyaan. Hanya dijalankan pada peralihan selesai-mengalir
   * — bukan saat halaman dibuka, yang justru harus mendarat di dasar.
   */
  const wasBusyRef = React.useRef(false);
  React.useEffect(() => {
    const streamJustEnded = wasBusyRef.current && !isBusy;
    wasBusyRef.current = isBusy;
    if (showPicker || !streamJustEnded) return;
    followStream("smooth");
  }, [isBusy, showPicker, followStream]);

  // Chatbar yang berubah tinggi menggeser dasar percakapan; ikuti selagi mengalir.
  React.useLayoutEffect(() => {
    if (showPicker || !isBusy) return;
    followStream();
  }, [bottomInset, showPicker, isBusy, followStream]);

  const handleStop = React.useCallback((): void => {
    // Sembunyikan indicator pada update klik yang sama; jangan menunggu SDK
    // menerbitkan `ready` setelah pembatalan stream selesai diproses.
    setStatusSuppressed(true);
    stop();
  }, [stop]);

  const handleRegenerate = React.useCallback((): void => {
    setStatusSuppressed(false);
    setReplyCycle((current) => current + 1);
    void regenerate();
  }, [regenerate]);

  const submit = React.useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || isBusy) return;
      setStatusSuppressed(false);
      setReplyCycle((current) => current + 1);
      clearError();
      setDraft("");
      // Mengirim pertanyaan berarti pengguna kembali mengikuti jawaban
      resumeFollowing();
      void sendMessage({ text: trimmed }, { body: { conversationId: conversationIdRef.current } });
    },
    [clearError, isBusy, resumeFollowing, sendMessage],
  );

  const openPicker = React.useCallback(() => {
    setShowPicker(true);
  }, []);

  const startNewConversation = React.useCallback(() => {
    if (isBusy) return;
    stop();
    clearError();
    setShowPicker(false);
    setMessages([]);
    setConfirmedProposals({});
    setDraft("");

    setActiveConversation(null);
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

  const handleBack = React.useCallback(() => {
    if (showPicker) setShowPicker(false);
    else router.back();
  }, [router, showPicker]);

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
        isBusy,
        onBack: handleBack,
        onNewConversation: handleNewConversation,
        onOpenPicker: openPicker,
      }),
    [showPicker, isBusy, handleBack, handleNewConversation, openPicker],
  );

  const handleActiveDeleted = React.useCallback(() => {
    setMessages([]);
    setConfirmedProposals({});
    setActiveConversation(null);
  }, [setActiveConversation, setMessages]);

  return (
    <motion.div
      // Tanpa `scale`: menskalakan akar halaman berarti menskalakan seluruh
      // isinya selama transisi, dan teks yang paling kelihatan menanggungnya.
      // Opasitas dan sedikit geseran sudah memberi arah kedatangan.
      //
      // Prop `exit` juga dihapus: tidak ada `AnimatePresence` yang membungkus
      // rute ini, jadi ia tidak pernah berjalan dan hanya membaca seolah-olah
      // ada animasi keluar yang sebenarnya tidak pernah ada.
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionSpringSmooth}
      className="relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-background"
    >
      {/* Main Scrollable Content Area */}
      <div
        ref={viewportRef}
        className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-margin-mobile"
        style={{ paddingTop: TOP_BAR_INSET_PX, paddingBottom: bottomInset }}
      >
        <div ref={contentRef} className="space-y-lg">
          <AnimatePresence mode="wait" initial={false}>
            {showPicker ? (
              <motion.div
                key="picker-view"
                ref={handlePickerPanelMount}
                initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                transition={transitionEaseSmooth}
                className="space-y-md pt-2"
              >
                <ConversationHistoryWorkspace
                  activeId={conversationId}
                  onSelect={(id) => void selectConversation(id)}
                  onNewConversation={startNewConversation}
                  onActiveDeleted={handleActiveDeleted}
                />
              </motion.div>
            ) : (
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
                        isLoadingHistory ? "history" : messages.length === 0 ? "empty" : "messages"
                      }
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={transitionEaseSmooth}
                      className="col-start-1 row-start-1"
                    >
                      {isLoadingHistory ? (
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
                                onFollowUp={submit}
                                isCurrent={isLast}
                                isBusy={isBusy}
                                statusSuppressed={statusSuppressed}
                                replyCycle={replyCycle}
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
                  {error && (
                    <motion.div
                      initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                      transition={transitionSpringBouncy}
                      role="alert"
                      aria-live="assertive"
                      className="bg-danger-container/40 text-danger ring-danger/25 flex items-center justify-between gap-3 rounded-2xl p-3.5 ring-1"
                    >
                      <div className="flex items-center gap-2.5 text-row font-semibold">
                        <AppIcon name="warning" className="icon-sm shrink-0" />
                        <span>{error.message || "Gagal menghubungi asisten AI."}</span>
                      </div>
                      <Button variant="secondary" size="compact" onClick={handleRegenerate}>
                        Coba lagi
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Progressive Bottom Gradient Mask Overlay (Matched to composer height) */}
      {!showPicker && (
        <div
          aria-hidden="true"
          style={{ height: bottomInset }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md bg-linear-to-t from-background via-background/90 to-transparent"
        />
      )}

      {/* Floating Bottom Bar */}
      {!showPicker && (
        <footer
          ref={footerRef}
          className="pointer-events-none fixed inset-x-0 bottom-3 z-40 mx-auto w-full max-w-md px-margin-mobile pb-[env(safe-area-inset-bottom)]"
        >
          <div className="pointer-events-auto w-full">
            {activeInputRequest && !isBusy ? (
              <MorphedInputComposer
                // Permintaan baru harus memulai formulir dari nol. Tanpa key,
                // React memakai ulang instance yang sama sehingga langkah dan
                // isian permintaan lama ikut terbawa — dan bila permintaan baru
                // punya lebih sedikit field, langkahnya melewati batas dan
                // formulir menghilang tanpa pesan.
                key={activeInputRequest.toolCallId}
                payload={activeInputRequest.payload}
                onSubmit={(formattedResponse) => {
                  setDismissedInputToolCallIds(
                    (prev) => new Set([...prev, activeInputRequest.toolCallId]),
                  );
                  submit(formattedResponse);
                }}
                onCancel={() => {
                  setDismissedInputToolCallIds(
                    (prev) => new Set([...prev, activeInputRequest.toolCallId]),
                  );
                  // AI harus tahu pengisian dibatalkan. Tanpa ini ia tetap
                  // mengira sedang menunggu data, dan pesan berikutnya dibaca
                  // seolah jawaban atas formulir yang sudah ditinggalkan.
                  submit(
                    `Saya batalkan pengisian data untuk ${activeInputRequest.payload.actionTitle}.`,
                  );
                }}
              />
            ) : (
              <ChatComposer
                value={draft}
                onChange={setDraft}
                onSubmit={() => submit(draft)}
                onStop={handleStop}
                isBusy={isBusy}
              />
            )}
          </div>
        </footer>
      )}
    </motion.div>
  );
}
