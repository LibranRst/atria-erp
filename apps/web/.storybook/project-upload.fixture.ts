import type { uploadToImageKit as Upload } from "@/lib/media/upload-to-imagekit";

export async function uploadToImageKit(
  ..._args: Parameters<typeof Upload>
): Promise<Awaited<ReturnType<typeof Upload>>> {
  void _args;
  throw new Error("Unggah dinonaktifkan pada fixture UI.");
}
