import type { UIMessage } from "ai";
import { z } from "zod";

import { toolNameFromPartType } from "./tool-labels";

/**
 * Konteks yang bisa disimpulkan dari seluruh part di satu balasan.
 *
 * Beberapa tool hanya menerima `projectId` dan tidak ikut mengembalikan nama
 * proyeknya. Tanpa nama, kartunya tampil sebagai "Budget proyek" — dan ketika
 * satu pertanyaan lintas proyek memicu empat kartu sekaligus, keempatnya jadi
 * tidak bisa dibedakan sama sekali.
 *
 * Namanya sebenarnya sudah ada di balasan yang sama: model hampir selalu
 * memanggil `listProjects` lebih dulu untuk mendapatkan id-nya. Memungutnya dari
 * sana memulihkan identitas tanpa perlu mengubah keluaran tool, dan ikut
 * memperbaiki pesan lama yang sudah terlanjur tersimpan.
 */

const listProjectsShape = z.object({
  projects: z.array(z.object({ projectId: z.string(), name: z.string() })),
});

const toolInputShape = z.object({ projectId: z.string() });

/**
 * Membaca argumen `projectId` yang dikirim model ke sebuah tool.
 * Argumen ikut tersimpan di `parts`, jadi ini juga tersedia untuk riwayat lama.
 */
export function readToolProjectId(part: unknown): string | undefined {
  if (typeof part !== "object" || part === null) return undefined;
  const input = (part as { input?: unknown }).input;
  const parsed = toolInputShape.safeParse(input);
  return parsed.success ? parsed.data.projectId : undefined;
}

/**
 * Mengumpulkan peta id proyek → nama dari seluruh keluaran `listProjects`
 * di dalam satu balasan.
 */
export function collectProjectNames(message: UIMessage): Record<string, string> {
  const names: Record<string, string> = {};

  for (const part of message.parts) {
    if (toolNameFromPartType(part.type) !== "listProjects") continue;

    const parsed = listProjectsShape.safeParse((part as { output?: unknown }).output);
    if (!parsed.success) continue;

    for (const project of parsed.data.projects) {
      names[project.projectId] = project.name;
    }
  }

  return names;
}
