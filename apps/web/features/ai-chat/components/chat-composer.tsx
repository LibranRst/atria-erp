"use client";

import { IconButton, ActionMenu, Textarea } from "@/components/ui";
import { AppIcon } from "@/components/ui";
import { uploadToImageKit } from "@/lib/media/upload-to-imagekit";
import { useWorkspaceControlPresentation } from "@/lib/navigation/workspace-presentation";
import { transitionSpringSnappy, transitionSpringSmooth } from "@/lib/utils/motion";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { toast } from "sonner";
import {
  ACCEPTED_ATTACHMENT_INPUT,
  CHAT_ATTACHMENT_OPTIONS,
  MAX_CHAT_ATTACHMENTS,
  isSupportedAttachment,
  validateAttachmentBatch,
} from "../utils/attachment-validation";

/**
 * Baris penulisan pesan.
 *
 * Textarea tumbuh mengikuti isi sampai batas beberapa baris, lalu menggulir
 * sendiri — supaya sheet tidak terdorong naik-turun saat mengetik di layar kecil.
 * Enter mengirim, Shift+Enter membuat baris baru.
 */

const MAX_LENGTH = 2000;

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

export type ChatComposerProps = {
  readonly disabled?: boolean;
  readonly embedded?: boolean;
  readonly autoFocus?: boolean;
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
  disabled = false,
  embedded = false,
  autoFocus = false,
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
  const actionSize = useWorkspaceControlPresentation() === "desktop" ? "default" : "compact";
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [internalIsUploading, setInternalIsUploading] = React.useState(false);
  const isUploading = externalIsUploading ?? internalIsUploading;
  const canSend = canSendDraft(value, isBusy, attachments.length) && !isUploading && !disabled;
  const [inputHeight, setInputHeight] = React.useState(40);
  const uploadLock = React.useRef(false);
  function chooseAttachment(accept: string): void {
    const input = fileInputRef.current;
    if (!input || disabled || isBusy || isUploading || attachments.length >= MAX_CHAT_ATTACHMENTS)
      return;
    input.accept = accept;
    input.value = "";
    input.click();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (!shouldSubmitOnKey(event)) return;
    event.preventDefault();
    if (canSend) onSubmit();
  }

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (uploadLock.current) return;
    const validation = validateAttachmentBatch(Array.from(files), attachments.length);
    if (!validation.valid) {
      toast.error(validation.reason);
      event.target.value = "";
      return;
    }
    uploadLock.current = true;

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
      uploadLock.current = false;
      if (!onUploadFiles) setInternalIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const expanded = inputHeight > 40 || attachments.length > 0 || isUploading;
  return (
    <motion.div
      initial={false}
      animate={embedded ? undefined : { borderRadius: expanded ? 28 : 32 }}
      transition={reduceMotion ? { duration: 0 } : transitionSpringSmooth}
      className={
        embedded
          ? "min-w-0 p-2"
          : "min-w-0 bg-surface-container-lowest p-2 shadow-control ring-1 ring-ring-control focus-within:ring-2 focus-within:ring-focus-ring"
      }
      data-chat-composer=""
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_ATTACHMENT_INPUT}
        hidden
        onChange={handleFilesSelected}
      />
      <AnimatePresence initial={false}>
        {(attachments.length > 0 || isUploading) && (
          <motion.div
            key="attachments"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : transitionSpringSmooth}
            className="overflow-hidden"
          >
            <div
              className="mb-2 space-y-1 border-b border-ring-subtle px-2 pb-2"
              aria-label="Lampiran pesan"
            >
              <AnimatePresence initial={false}>
                {attachments.map((att, index) => (
                  <motion.div
                    layout="position"
                    key={att.url}
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
                    className="flex min-w-0 items-center gap-2"
                  >
                    {att.mimeType.startsWith("image/") ? (
                      /* eslint-disable @next/next/no-img-element -- private original thumbnails use the authenticated media route */ <img
                        src={att.url}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <AppIcon
                        name="description"
                        className="icon-lg shrink-0 text-on-surface-variant"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-support font-semibold">
                        {att.fileName}
                      </span>
                      <span className="block text-meta text-on-surface-variant">
                        {formatFileSize(att.size)}
                      </span>
                    </span>
                    <IconButton
                      label={`Hapus ${att.fileName}`}
                      icon={<AppIcon name="close" className="icon-sm" />}
                      variant="tertiary"
                      size="compact"
                      className="bg-surface-container-lowest! text-on-surface! shadow-none!"
                      disabled={isBusy || isUploading}
                      onClick={() => onRemoveAttachment?.(index)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              {isUploading && (
                <p role="status" className="py-2 text-support text-on-surface-variant">
                  Mengunggah lampiran…
                </p>
              )}
              <p className="text-meta text-on-surface-variant">
                {attachments.length} / {MAX_CHAT_ATTACHMENTS} lampiran · maksimal 10 MB per berkas
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex min-w-0 items-end gap-1">
        <div className="flex h-10 shrink-0 items-center justify-center">
          <ActionMenu
            label="Pilih jenis lampiran"
            placement="top-start"
            trigger={
              <IconButton
                label="Lampirkan berkas"
                icon={<AppIcon name="attach_file" className="icon-md" />}
                size={actionSize}
                variant="tertiary"
                className="shrink-0 bg-surface-container-lowest! text-on-surface! shadow-none!"
                disabled={
                  disabled || isUploading || isBusy || attachments.length >= MAX_CHAT_ATTACHMENTS
                }
              />
            }
            items={CHAT_ATTACHMENT_OPTIONS.map((option) => ({
              id: option.id,
              label: option.label,
              icon: option.icon,
              description: option.description,
              onSelect: () => chooseAttachment(option.accept),
            }))}
          />
        </div>
        <label htmlFor="ai-chat-input" className="sr-only">
          Tulis pertanyaan untuk asisten AI
        </label>
        <Textarea
          id="ai-chat-input"
          variant="composer"
          disabled={disabled}
          autoFocus={autoFocus}
          rows={1}
          value={value}
          onChange={onChange}
          maxLength={MAX_LENGTH}
          onKeyDown={handleKeyDown}
          onHeightChange={setInputHeight}
          placeholder="Tulis pesan…"
        />
        <div className="flex h-10 shrink-0 items-center justify-center">
          <IconButton
            label={isBusy ? "Hentikan jawaban" : "Kirim pertanyaan"}
            variant="primary"
            size={actionSize}
            className="shrink-0 bg-primary! text-on-primary! shadow-none!"
            disabled={disabled || (!isBusy && !canSend)}
            onClick={isBusy ? onStop : onSubmit}
            icon={
              <span className="relative block h-5 w-5">
                <AnimatePresence initial={false}>
                  <motion.span
                    key={isBusy ? "stop" : "send"}
                    initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
                    transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <AppIcon name={isBusy ? "stop" : "arrow_upward"} className="icon-md" />
                  </motion.span>
                </AnimatePresence>
              </span>
            }
          />
        </div>
      </div>
    </motion.div>
  );
}
