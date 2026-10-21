import { changeOwnPasswordSchema } from "@atria/core/validations/profile";
import { changeTemporaryPasswordSchema } from "@atria/core/validations/administration";

export type PasswordDraft = {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
};

export function passwordFieldErrors(
  draft: PasswordDraft,
  temporary: boolean,
): Readonly<Record<string, string>> {
  const validation = (
    temporary ? changeTemporaryPasswordSchema : changeOwnPasswordSchema
  ).safeParse(draft);
  const errors: Record<string, string> = {};
  if (!validation.success) {
    for (const issue of validation.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !errors[field]) errors[field] = issue.message;
    }
  }
  if (!draft.currentPassword) errors.currentPassword = "Kata sandi saat ini wajib diisi.";
  if (!draft.confirmPassword) errors.confirmPassword = "Konfirmasi kata sandi baru wajib diisi.";
  else if (draft.confirmPassword !== draft.newPassword)
    errors.confirmPassword = "Konfirmasi kata sandi belum sama.";
  return errors;
}
