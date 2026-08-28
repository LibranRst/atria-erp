import { z } from "zod";

const uuid = z.string().uuid("ID tidak valid.");
const canonicalRoleId = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID role tidak valid.");
/**
 * Kebijakan kata sandi tunggal untuk seluruh aplikasi. Diekspor supaya jalur
 * ganti kata sandi mandiri (`./profile`) memakai aturan yang sama persis —
 * kebijakan yang disalin adalah kebijakan yang akan menyimpang.
 */
export const passwordPolicySchema = z
  .string()
  .min(12, "Password minimal 12 karakter.")
  .max(128)
  .regex(/[A-Z]/, "Password wajib memiliki huruf besar.")
  .regex(/[a-z]/, "Password wajib memiliki huruf kecil.")
  .regex(/[0-9]/, "Password wajib memiliki angka.");

const password = passwordPolicySchema;

export const bootstrapOwnerSchema = z.object({
  bootstrapSecret: z.string().min(16, "Bootstrap secret tidak valid."),
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().toLowerCase().email(),
  password,
});

export const createStaffUserSchema = z.object({
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().toLowerCase().email(),
  roleId: canonicalRoleId,
  temporaryPassword: password,
});

export const updateStaffUserSchema = z.object({
  userId: uuid,
  name: z.string().trim().min(2).max(255),
  roleId: canonicalRoleId,
  isActive: z.boolean(),
});

export const changeTemporaryPasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: password,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message:
      "Password baru tidak boleh sama dengan password sementara. Masukkan password pribadi yang berbeda.",
  });

export const vendorAdministrationSchema = z.object({
  vendorId: uuid.optional(),
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().toLowerCase().email().optional().nullable().or(z.literal("")),
  phone: z.string().trim().min(3).max(50),
  address: z.string().trim().max(1_000).optional().nullable(),
  bankName: z.string().trim().max(100).optional().nullable(),
  bankAccountNumber: z.string().trim().max(50).optional().nullable(),
  bankAccountHolder: z.string().trim().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const setVendorActiveSchema = z.object({
  vendorId: uuid,
  isActive: z.boolean(),
});

export type BootstrapOwnerInput = z.infer<typeof bootstrapOwnerSchema>;
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;
export type UpdateStaffUserInput = z.infer<typeof updateStaffUserSchema>;
export type ChangeTemporaryPasswordInput = z.infer<typeof changeTemporaryPasswordSchema>;
export type VendorAdministrationInput = z.input<typeof vendorAdministrationSchema>;
