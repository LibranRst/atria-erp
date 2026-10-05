"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import React from "react";
import { toast } from "sonner";

import { updateOwnProfile } from "@/app/actions/profile/update-own-profile";
import {
  AppIcon,
  Button,
  FormField,
  FormSection,
  OperationalFormSheet,
  TextInput,
  UserAvatar,
} from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { uploadToImageKit } from "@/lib/media/upload-to-imagekit";
import { cropImageToSquareJpeg } from "@/lib/media/resize-image";
import {
  canSubmitProfile,
  getDisplayNameError,
  toUpdateProfileInput,
  type PhotoDecision,
} from "@/features/profile/utils/profile-form";
import {
  fadeVariants,
  spinAnimation,
  transitionEaseSmooth,
  transitionSpinLinear,
} from "@/lib/utils/motion";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const AVATAR_RENDER_PX = 96;

type CaptionTone = "muted" | "accent" | "critical";

const captionToneClass: Record<CaptionTone, string> = {
  muted: "text-on-surface-variant",
  accent: "text-accent",
  critical: "text-critical",
};

/**
 * Sheet ini bukan formulir dua kolom — ia satu momen identitas.
 *
 * Wajah pengguna adalah subjeknya, jadi avatar berdiri sendiri di kanvas sheet
 * sebagai elemen terbesar, bukan sebagai satu baris field di antara baris lain.
 * Nama menyusul di bawahnya sebagai catatan biasa. Susunan sebelumnya —
 * avatar mungil berdampingan dengan dua tombol bertumpuk di dalam panel —
 * membuat foto terbaca seperti lampiran, bukan seperti dirinya sendiri.
 */
export function EditProfileSheet({
  open,
  displayName,
  imageUrl,
  initials,
  onClose,
}: {
  readonly open: boolean;
  readonly displayName: string;
  readonly imageUrl?: string | null;
  readonly initials: string;
  readonly onClose: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { refetch } = authClient.useSession();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [name, setName] = React.useState(displayName);
  const [photo, setPhoto] = React.useState<PhotoDecision>({ kind: "untouched" });
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [lastFile, setLastFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Object URL adalah referensi yang hidup sampai dicabut; tanpa ini setiap
  // pemilihan foto meninggalkan satu blob menggantung di memori tab.
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const storedImageUrl =
    photo.kind === "removed" ? null : photo.kind === "replaced" ? photo.url : imageUrl;
  const shownImageUrl = previewUrl ?? storedImageUrl;
  const hasPhoto = Boolean(shownImageUrl);

  const nameError = getDisplayNameError(name);
  const canSubmit = canSubmitProfile(name) && !uploading;
  const busy = uploading || pending;
  const dirty = name !== displayName || photo.kind !== "untouched";

  /**
   * Satu baris keterangan yang berganti isi, bukan tumpukan pesan.
   *
   * Ia juga yang membuat model "satu Simpan" terbaca: foto yang sudah terunggah
   * belum tersimpan, dan itu harus dikatakan sebelum pengguna menutup sheet dan
   * mengira pekerjaannya selesai.
   */
  const caption: { readonly key: string; readonly tone: CaptionTone; readonly text: string } =
    uploadError
      ? { key: "error", tone: "critical", text: uploadError }
      : uploading
        ? { key: "uploading", tone: "muted", text: "Mengunggah foto…" }
        : photo.kind === "replaced"
          ? { key: "ready", tone: "accent", text: "Foto siap. Tekan Simpan untuk menerapkannya." }
          : photo.kind === "removed"
            ? { key: "removed", tone: "accent", text: "Foto dihapus setelah Simpan." }
            : hasPhoto
              ? { key: "idle-photo", tone: "muted", text: "JPG atau PNG · Maks. 8 MB" }
              : { key: "idle-empty", tone: "muted", text: "Tanpa foto, inisial nama yang tampil." };

  function openFilePicker(): void {
    fileInputRef.current?.click();
  }

  async function runUpload(file: File): Promise<void> {
    setUploading(true);
    setUploadError(null);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return objectUrl;
    });

    try {
      const square = await cropImageToSquareJpeg(file);
      const uploaded = await uploadToImageKit({
        file: square,
        folder: "/user-avatars",
        fileNamePrefix: "avatar",
        subject: "foto profil",
      });
      setPhoto({ kind: "replaced", url: uploaded.url });
    } catch (error: unknown) {
      /*
       * Pratinjau dikembalikan ke foto lama supaya tidak ada foto yang tampil
       * seolah tersimpan padahal tidak pernah sampai ke CDN. Galatnya tinggal
       * di dalam sheet, bukan sebagai toast: toast menghilang sementara sheet
       * masih terbuka, dan penggunanya kehilangan konteks.
       */
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setUploadError(
        error instanceof Error ? error.message : "Foto gagal diunggah. Coba lagi sebentar.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // Input direset supaya memilih berkas yang sama dua kali tetap memicu event.
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Foto profil harus berupa file gambar.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setUploadError("Ukuran foto maksimal 8 MB.");
      return;
    }

    setLastFile(file);
    await runUpload(file);
  }

  function removePhoto(): void {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setLastFile(null);
    setUploadError(null);
    setPhoto({ kind: "removed" });
  }

  function discardEdits(): void {
    setName(displayName);
    setPhoto({ kind: "untouched" });
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setLastFile(null);
    setUploadError(null);
  }

  async function submit(): Promise<void> {
    if (!canSubmit) return;

    setPending(true);
    const result = await updateOwnProfile(toUpdateProfileInput(name, photo));

    if (!result.success) {
      setPending(false);
      toast.error(result.error.message);
      return;
    }

    // Bilah atas membaca sesi klien, halaman profil dirender server: keduanya
    // harus disegarkan atau avatar lama bertahan di salah satunya.
    await refetch();
    router.refresh();
    toast.success(result.data.updated ? "Profil diperbarui." : "Tidak ada perubahan.");
    setPending(false);
    onClose();
  }

  return (
    <OperationalFormSheet
      dismissal={{
        mode: "confirm",
        dirty,
        blocked: busy,
        onDiscard: discardEdits,
        description: "Perubahan nama atau foto profil yang belum disimpan akan hilang.",
      }}
      open={open}
      title="Ubah profil"
      submitLabel="Simpan"
      submittingLabel="Menyimpan…"
      pending={pending}
      disabled={!canSubmit}
      disabledReason={
        uploading
          ? "Menunggu foto selesai diunggah."
          : canSubmit
            ? undefined
            : (nameError ?? "Nama tampilan wajib diisi.")
      }
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <section className="flex flex-col items-center gap-3 pt-1" aria-label="Foto profil">
        <button
          type="button"
          onClick={openFilePicker}
          disabled={busy}
          aria-label={hasPhoto ? "Ganti foto profil" : "Pilih foto profil"}
          className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed"
        >
          <UserAvatar
            imageUrl={shownImageUrl}
            initials={initials}
            renderPx={AVATAR_RENDER_PX}
            className={`h-24 w-24 text-[32px] tracking-tight shadow-control ring-1 ring-ring-subtle transition-opacity ${uploading ? "opacity-60" : ""}`}
          />
          {/*
           * Chip menyentuh tepi lingkaran pada sudut 45°, bukan sudut kotak
           * pembatasnya: untuk lingkaran 96px dan chip 32px, titik singgungnya
           * jatuh 2px di luar kotak — persis pergeseran ini. Menaruhnya di
           * koordinat kotak akan membuatnya melayang lepas dari avatar.
           */}
          <span
            className="absolute -right-0.5 -bottom-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface ring-1 ring-ring-control"
            aria-hidden="true"
          >
            {/*
             * Pemutar hanya ADA selama unggahan berjalan, dan itu bukan sekadar
             * gaya penulisan. Mengganti `animate` menjadi `undefined` tidak
             * menghentikan animasi yang sedang berjalan — Framer membacanya
             * sebagai "tidak ada target baru", sehingga putaran `repeat:
             * Infinity` terus berjalan selamanya setelah unggahan selesai.
             * Melepas nodenya mengakhiri animasi bersama nodenya.
             */}
            {uploading ? (
              <motion.span
                className="flex"
                animate={reduceMotion ? undefined : spinAnimation}
                transition={transitionSpinLinear}
              >
                <AppIcon name="progress_activity" className="icon-sm leading-none" />
              </motion.span>
            ) : (
              <AppIcon name="photo_camera" className="icon-sm leading-none" />
            )}
          </span>
        </button>

        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={openFilePicker}>
            {hasPhoto ? "Ganti foto" : "Pilih foto"}
          </Button>
          {hasPhoto ? (
            <Button type="button" variant="criticalQuiet" disabled={busy} onClick={removePhoto}>
              Hapus
            </Button>
          ) : null}
        </div>

        <div className="flex min-h-9 flex-col items-center gap-1 px-4 text-center">
          <AnimatePresence initial={false} mode="wait">
            <motion.p
              key={caption.key}
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={transitionEaseSmooth}
              className={`text-meta ${captionToneClass[caption.tone]}`}
              role={uploadError ? "alert" : "status"}
            >
              {caption.text}
            </motion.p>
          </AnimatePresence>
          {uploadError && lastFile ? (
            <Button
              type="button"
              variant="tertiary"
              size="compact"
              onClick={() => void runUpload(lastFile)}
            >
              Coba lagi
            </Button>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => void handleFileChange(event)}
        />
      </section>

      <FormSection>
        <FormField
          label="Nama tampilan"
          htmlFor="profile-display-name"
          helper="Nama ini tampil di bilah atas dan di seluruh aplikasi."
          error={nameError}
          required
        >
          <TextInput
            id="profile-display-name"
            name="name"
            value={name}
            onChange={setName}
            autoComplete="name"
            placeholder="Nama lengkap"
            aria-invalid={Boolean(nameError)}
          />
        </FormField>
      </FormSection>
    </OperationalFormSheet>
  );
}
