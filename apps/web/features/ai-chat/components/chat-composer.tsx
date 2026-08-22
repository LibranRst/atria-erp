"use client";

import { IconButton } from "@/components/ui";
import { AppIcon } from "@/components/ui";
import { transitionSpringSnappy, transitionSpringSmooth } from "@/lib/utils/motion";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

/**
 * Baris penulisan pesan.
 *
 * Textarea tumbuh mengikuti isi sampai batas beberapa baris, lalu menggulir
 * sendiri — supaya sheet tidak terdorong naik-turun saat mengetik di layar kecil.
 * Enter mengirim, Shift+Enter membuat baris baru.
 */

const MAX_LENGTH = 2000;
const MAX_TEXTAREA_HEIGHT = 120;

/**
 * Identitas bersama dengan panel input AI.
 *
 * Keduanya tidak pernah tampil bersamaan — panel menggantikan komposer saat AI
 * meminta data. `layoutId` yang sama membuat Framer menganimasikan perpindahan
 * itu sebagai satu benda yang berubah bentuk, bukan satu elemen hilang dan
 * elemen lain muncul. Itulah arti "morph" pada fitur ini.
 */
export const COMPOSER_MORPH_LAYOUT_ID = "ai-composer-surface";

/**
 * Pesan hanya boleh dikirim jika ada isi dan tidak ada jawaban yang sedang berjalan.
 */
export function canSendDraft(value: string, isBusy: boolean): boolean {
  return value.trim().length > 0 && !isBusy;
}

/**
 * Enter mengirim, Shift+Enter membuat baris baru. Selama IME aktif (mis. saat
 * mengetik dengan papan ketik prediktif), Enter memilih kandidat kata dan tidak
 * boleh diperlakukan sebagai perintah kirim.
 */
export function shouldSubmitOnKey(event: {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly nativeEvent?: { readonly isComposing?: boolean };
}): boolean {
  if (event.key !== "Enter" || event.shiftKey) return false;
  return event.nativeEvent?.isComposing !== true;
}

type ChatComposerProps = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onStop: () => void;
  readonly isBusy: boolean;
};

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isBusy,
}: ChatComposerProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const canSend = canSendDraft(value, isBusy);

  const [isMultiline, setIsMultiline] = React.useState(false);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    setIsMultiline(nextHeight > 32);
  }, [value]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (!shouldSubmitOnKey(event)) return;
    event.preventDefault();
    if (canSend) onSubmit();
  }

  return (
    <div className="flex items-center gap-2">
      <motion.div
        layout
        layoutId={reduceMotion ? undefined : COMPOSER_MORPH_LAYOUT_ID}
        transition={reduceMotion ? undefined : transitionSpringSmooth}
        className={`relative flex min-h-12 min-w-0 flex-1 items-center bg-white px-5 py-2.5 shadow-control ring-1 ring-ring-control transition-all duration-200 focus-within:ring-2 focus-within:ring-focus-ring ${
          isMultiline ? "rounded-[22px]" : "rounded-full"
        }`}
      >
        <label htmlFor="ai-chat-input" className="sr-only">
          Tulis pertanyaan untuk asisten AI
        </label>
        <textarea
          id="ai-chat-input"
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tanya soal budget atau proyek…"
          className="block max-h-30 w-full resize-none bg-transparent text-row leading-[20px] font-semibold text-on-surface placeholder:text-on-surface-variant focus:outline-none"
        />
      </motion.div>

      <motion.div
        layout
        key={isBusy ? "busy-state" : "idle-state"}
        initial={reduceMotion ? undefined : { scale: 0.92, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={transitionSpringSnappy}
        className="shrink-0"
      >
        {isBusy ? (
          <IconButton
            label="Hentikan jawaban"
            onClick={onStop}
            icon={<AppIcon name="close" className="icon-lg" />}
          />
        ) : (
          <IconButton
            label="Kirim pertanyaan"
            variant="primary"
            disabled={!canSend}
            onClick={onSubmit}
            icon={<AppIcon name="send" className="icon-lg" />}
          />
        )}
      </motion.div>
    </div>
  );
}
