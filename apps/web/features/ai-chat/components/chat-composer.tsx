"use client";

import { IconButton } from "@/components/ui";
import { AppIcon } from "@/components/ui";
import { uploadToImageKit } from "@/lib/media/upload-to-imagekit";
import { transitionSpringSnappy, transitionSpringSmooth } from "@/lib/utils/motion";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { toast } from "sonner";
import { ACCEPTED_ATTACHMENT_INPUT, isSupportedAttachment } from "../utils/attachment-validation";

/**
 * Baris penulisan pesan.
 *
 * Textarea tumbuh mengikuti isi sampai batas beberapa baris, lalu menggulir
 * sendiri — supaya sheet tidak terdorong naik-turun saat mengetik di layar kecil.
 * Enter mengirim, Shift+Enter membuat baris baru.
 */

const MAX_LENGTH = 2000;
const MAX_TEXTAREA_HEIGHT = 120;

export const COMPOSER_MORPH_LAYOUT_ID = "ai-composer-surface";

export type ChatAttachment = {
  readonly url: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Pesan hanya boleh dikirim jika ada isi atau lampiran, dan tidak ada jawaban yang sedang berjalan.
 */
export function canSendDraft(
  value: string,
  isBusy: boolean,
  attachmentsCount: number = 0,
): boolean {
  return (value.trim().length > 0 || attachmentsCount > 0) && !isBusy;
}

/**
 * Enter mengirim, Shift+Enter membuat baris baru.
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
  readonly attachments?: readonly ChatAttachment[];
  readonly onAddAttachment?: (att: ChatAttachment) => void;
  readonly onRemoveAttachment?: (index: number) => void;
  readonly isUploading?: boolean;
  readonly onUploadFiles?: (files: FileList | readonly File[]) => Promise<void>;
};

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isBusy,
  attachments = [],
  onAddAttachment,
  onRemoveAttachment,
  isUploading: externalIsUploading,
  onUploadFiles,
}: ChatComposerProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [internalIsUploading, setInternalIsUploading] = React.useState(false);
  const isUploading = externalIsUploading ?? internalIsUploading;
  const canSend = canSendDraft(value, isBusy, attachments.length);
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

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      if (onUploadFiles) {
        await onUploadFiles(files);
      } else {
        setInternalIsUploading(true);
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

          onAddAttachment?.({
            url: uploaded.url,
            fileName: file.name,
            mimeType: uploaded.mimeType,
            size: uploaded.size,
          });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah lampiran.");
    } finally {
      if (!onUploadFiles) setInternalIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Tray pratinjau lampiran berkas */}
      {attachments.length > 0 || isUploading ? (
        <div className="flex flex-wrap items-center gap-1.5 px-2">
          {attachments.map((att, index) => {
            const isImage = att.mimeType.startsWith("image/");
            return (
              <div
                key={`${att.url}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-meta font-semibold text-on-surface shadow-control ring-1 ring-ring-control"
              >
                {isImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={att.url}
                    alt={att.fileName}
                    className="h-4 w-4 rounded-full object-cover"
                  />
                ) : (
                  <AppIcon name="description" className="icon-xs text-primary" />
                )}
                <span className="max-w-30 truncate text-meta leading-tight">
                  {att.fileName}
                </span>
                <span className="text-[10px] font-normal text-on-surface-variant">
                  ({formatFileSize(att.size)})
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment?.(index)}
                  className="ml-0.5 rounded-full p-0.5 text-on-surface-variant hover:bg-surface-container-high hover:text-error focus:outline-none"
                  aria-label={`Hapus ${att.fileName}`}
                >
                  <AppIcon name="close" className="icon-xs" />
                </button>
              </div>
            );
          })}

          {isUploading ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-2.5 py-1 text-meta font-medium text-primary ring-1 ring-ring-subtle animate-pulse">
              <AppIcon name="sync" className="icon-xs animate-spin" />
              <span>Mengunggah…</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_ATTACHMENT_INPUT}
          className="sr-only"
          onChange={handleFilesSelected}
        />

        <motion.div
          layout
          layoutId={reduceMotion ? undefined : COMPOSER_MORPH_LAYOUT_ID}
          transition={reduceMotion ? undefined : transitionSpringSmooth}
          className={`relative flex min-h-12 min-w-0 flex-1 gap-1.5 bg-white py-1.5 pl-2 pr-4 shadow-control ring-1 ring-ring-control transition-all duration-200 focus-within:ring-2 focus-within:ring-focus-ring ${
            isMultiline ? "items-end rounded-[22px]" : "items-center rounded-full"
          }`}
        >
          <button
            type="button"
            disabled={isUploading || isBusy}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Lampirkan berkas"
            title="Lampirkan berkas"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring after:absolute after:-inset-1.5 after:content-[''] disabled:pointer-events-none disabled:opacity-40"
          >
            <AppIcon name="attach_file" className="icon-md" />
          </button>

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
            placeholder="Tanya soal budget, mutasi, atau proyek…"
            className="block max-h-30 w-full resize-none bg-transparent py-1.5 text-row leading-[20px] font-semibold text-on-surface placeholder:text-on-surface-variant focus:outline-none"
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
    </div>
  );
}
