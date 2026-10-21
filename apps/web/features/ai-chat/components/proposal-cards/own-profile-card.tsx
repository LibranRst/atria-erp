"use client";
import * as React from "react";
import { getAiOwnProfileProposal, confirmAiOwnProfileProposal } from "@/app/actions/ai/own-profile";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { useRouter } from "@/lib/navigation/workspace-navigation";
import { authClient } from "@/lib/auth-client";
import {
  Button,
  InlineStateRow,
  ButtonLink,
  UserAvatar,
  SheetFooterActions,
  MediaPreviewDialog,
} from "@/components/ui";
import { getProfileInitials } from "@atria/core/presentation/user-identity";
import type { OwnProfileProposal, OwnProfileView } from "@atria/core/ai/own-profile";
import { ProposalCardShell } from "./proposal-card-shell";
import { ProposalInlineReview } from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
/** THESIS: a complete own-profile decision lives in the chat card, with one explicit Save.
 * OWN-WORLD: inherited Atria grouped surface, compact shared avatars and capsule controls.
 * STORY: name/photo request → actual before/after preview → Save → verified account presentation.
 * FIRST VIEWPORT: identity, changed name and paired photo preview above adaptive correction/Save.
 * FORM: local extension of the existing AI proposal family; shared photo preview is contextual.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
export function OwnProfileCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: OwnProfileProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop",
    router = useRouter(),
    { refetch } = authClient.useSession();
  const [view, setView] = React.useState<OwnProfileView | null>(null),
    [error, setError] = React.useState(""),
    [denied, setDenied] = React.useState(false),
    [checking, setChecking] = React.useState(false),
    [photoPreview, setPhotoPreview] = React.useState<{ url: string; title: string } | null>(null),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const epoch = React.useRef(0),
    flight = React.useRef(false);
  const proposal = view?.proposal ?? initial,
    confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    pending = isBusy || status === "submitting",
    readable = can("use:ai_chat") && !denied,
    stale = view?.status === "STALE" || view?.status === "EXPIRED",
    changed = proposal.changedFields.length > 0;
  const ready =
    readable &&
    view?.status === "READY" &&
    changed &&
    !confirmed &&
    !pending &&
    !checking &&
    !isStreaming &&
    !error;
  const refresh = React.useCallback(async (): Promise<void> => {
    if (!conversationId || isStreaming || flight.current) return;
    const request = ++epoch.current;
    setChecking(true);
    try {
      const result = await getAiOwnProfileProposal({ conversationId, toolCallId });
      if (request !== epoch.current) return;
      if (result.success) {
        setView(result.data);
        setError("");
        setDenied(false);
      } else {
        setError(result.error.message);
        setDenied(["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(result.error.code));
      }
    } catch {
      if (request === epoch.current)
        setError("Usulan profil belum dapat diperiksa. Coba periksa lagi.");
    } finally {
      if (request === epoch.current) setChecking(false);
    }
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    const request = epoch;
    return () => {
      active = false;
      request.current++;
    };
  }, [refresh]);
  async function save(): Promise<void> {
    if (!conversationId || !ready || flight.current) return;
    flight.current = true;
    epoch.current++;
    setStatus("submitting");
    setError("");
    try {
      const result = await confirmAiOwnProfileProposal({ conversationId, toolCallId });
      if (result.success) {
        setStatus("submitted");
        setPhotoPreview(null);
        await refetch();
        router.refresh();
      } else {
        setStatus("failed");
        setError(result.error.message);
        setDenied(["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(result.error.code));
      }
    } catch {
      setStatus("failed");
      setError("Hasil penyimpanan belum diketahui. Periksa lagi sebelum mengulang.");
    } finally {
      flight.current = false;
      void refresh();
    }
  }
  const follow = (): void =>
    onFollowUp(
      "Bantu periksa profil saya dan buat usulan perubahan nama atau foto terbaru. Tanyakan perubahan yang saya inginkan; jangan menyimpan sebelum saya menekan Simpan profil.",
    );
  const feedback = error ? (
    <ProposalReviewFeedback
      embedded
      message={error}
      recovery={{
        label: "Periksa lagi",
        disabled: pending || checking,
        onClick: () => void refresh(),
      }}
    />
  ) : stale ? (
    <ProposalReviewFeedback
      embedded
      message={
        view?.status === "EXPIRED"
          ? "Usulan profil kedaluwarsa. Minta usulan terbaru sebelum menyimpan."
          : "Profil atau foto sumber berubah. Minta usulan terbaru sebelum menyimpan."
      }
      recovery={{ label: "Minta usulan terbaru", disabled: pending, onClick: follow }}
    />
  ) : view?.status === "CONFIRMED" && !view.verified ? (
    <InlineStateRow
      icon="history"
      tone="neutral"
      title="Perubahan sudah tersimpan"
      description="Profil Anda kemudian diubah lagi. Rincian di bawah menunjukkan perubahan yang tersimpan saat itu."
    />
  ) : null;
  const afterPhoto =
    confirmed && view?.saved
      ? view.saved.imageUrl
      : proposal.photoSource
        ? `/api/media/attachments/${proposal.photoSource.id}`
        : proposal.after.imageUrl;
  function avatar(url: string | null, name: string, label: string): React.JSX.Element {
    const face = (
      <UserAvatar
        imageUrl={url}
        initials={getProfileInitials(name)}
        displayName={name}
        renderPx={64}
        className="text-section-title h-16 w-16"
      />
    );
    return (
      <div className="min-w-0 space-y-2">
        <p className="text-meta text-on-surface-variant">{label}</p>
        {face}
        {url && (
          <Button
            variant="quiet"
            size="compact"
            aria-label={`Lihat foto ${label.toLowerCase()}`}
            disabled={pending}
            onClick={() => setPhotoPreview({ url, title: `Foto ${label.toLowerCase()}` })}
          >
            Lihat foto
          </Button>
        )}
      </div>
    );
  }
  return (
    <>
      <ProposalCardShell
        title="Profil Anda"
        status={error && !confirmed ? "failed" : status}
        isAlreadyConfirmed={confirmed}
        statusLabel={
          confirmed
            ? "Tersimpan"
            : view?.status === "EXPIRED"
              ? "Kedaluwarsa"
              : stale
                ? "Data berubah"
                : error
                  ? "Perlu diperiksa"
                  : checking || !view
                    ? "Memeriksa"
                    : changed
                      ? "Usulan"
                      : "Sesuai"
        }
        showConfirmAction={false}
        onConfirm={save}
        footer={
          readable ? (
            <div className="space-y-3">
              {confirmed || !changed ? (
                <ButtonLink fullWidth href="/profile">
                  Buka profil saya
                </ButtonLink>
              ) : (
                <SheetFooterActions
                  layout="adaptive"
                  primary={{
                    label: "Simpan profil",
                    pending: status === "submitting",
                    pendingLabel: proposal.photoSource ? "Menyimpan foto…" : "Menyimpan…",
                    disabled: !ready,
                    onClick: () => void save(),
                  }}
                  secondary={{
                    label: stale ? "Minta usulan terbaru" : "Koreksi lewat chat",
                    variant: "quiet",
                    disabled: pending,
                    onClick: follow,
                  }}
                />
              )}
              <p role="status" className="text-meta text-on-surface-variant">
                {confirmed
                  ? view?.verified
                    ? "Perubahan tersimpan dan profil sudah diperiksa kembali."
                    : "Perubahan profil tercatat."
                  : !changed
                    ? "Nama dan foto sudah sesuai. Tidak perlu menyimpan."
                    : proposal.photoSource
                      ? "Foto ini dipakai sebagai foto profil setelah Simpan. Lampiran chat tetap privat."
                      : "Perubahan berlaku pada nama dan foto profil Anda."}
              </p>
            </div>
          ) : undefined
        }
      >
        <div className="flex min-w-0 items-center gap-3 px-4 py-3">
          {readable && (
            <UserAvatar
              imageUrl={
                view?.status === "CONFIRMED" ? view.current.imageUrl : proposal.before.imageUrl
              }
              initials={getProfileInitials(
                view?.status === "CONFIRMED" ? view.current.name : proposal.before.name,
              )}
              displayName={view?.status === "CONFIRMED" ? view.current.name : proposal.before.name}
              renderPx={40}
              className="h-10 w-10 text-row"
            />
          )}
          <div className="min-w-0">
            <p className="text-row font-semibold wrap-anywhere">
              {readable
                ? view?.status === "CONFIRMED"
                  ? view.current.name
                  : proposal.before.name
                : "Profil tidak tersedia dalam akses Anda"}
            </p>
            <p className="text-support text-on-surface-variant">
              {readable ? "Akun Anda sendiri" : "Periksa sesi untuk melanjutkan."}
            </p>
          </div>
        </div>
        {readable ? (
          <ProposalInlineReview
            comparisons={
              proposal.changedFields.includes("name")
                ? [
                    {
                      label: "Nama tampilan",
                      before: proposal.before.name,
                      after: proposal.after.name,
                      layout: desktop ? "stacked" : "vertical",
                    },
                  ]
                : []
            }
            facts={
              proposal.changedFields.includes("photo")
                ? [
                    {
                      label: "Foto profil",
                      value:
                        proposal.input.photo.action === "REMOVE"
                          ? confirmed
                            ? "Tanpa foto"
                            : "Dihapus setelah Simpan"
                          : confirmed
                            ? "Foto diperbarui"
                            : "Foto baru dipilih",
                    },
                  ]
                : []
            }
          >
            {feedback}
            {proposal.changedFields.includes("photo") && (
              <div
                className="grid min-w-0 grid-cols-2 gap-4 py-2"
                aria-label="Perbandingan foto profil"
              >
                {avatar(proposal.before.imageUrl, proposal.before.name, "Sebelum")}
                {avatar(afterPhoto, proposal.after.name, "Sesudah")}
              </div>
            )}
            {proposal.photoSource && (
              <p className="text-meta wrap-anywhere text-on-surface-variant">
                Sumber foto: {proposal.photoSource.fileName}
              </p>
            )}
          </ProposalInlineReview>
        ) : (
          <div className="px-4 pb-3">{feedback}</div>
        )}
      </ProposalCardShell>
      <MediaPreviewDialog
        open={Boolean(photoPreview) && readable}
        title={photoPreview?.title ?? "Foto profil"}
        imageUrl={photoPreview?.url ?? null}
        alt="Pratinjau foto profil Anda"
        caption="Foto profil tampil dalam potongan persegi dari tengah gambar."
        onClose={() => {
          if (!flight.current) setPhotoPreview(null);
        }}
      />
    </>
  );
}
