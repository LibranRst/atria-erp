import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Nama proyek wajib diisi"),
  clientId: z.string().optional().or(z.literal("")),
  // New Client fields (if clientId is not provided)
  newClientName: z.string().optional().or(z.literal("")),
  newClientEmail: z.string().optional().or(z.literal("")),
  newClientPhone: z.string().optional().or(z.literal("")),
  newClientAddress: z.string().optional().or(z.literal("")),
  // PM
  projectManagerId: z.string().min(1, "Project Manager wajib dipilih"),
  // Financial
  totalContractValue: z.number().nonnegative().optional().default(0),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  roomArea: z.string().optional().or(z.literal("")),
  projectType: z.string().optional().or(z.literal("")),
  coverImageUrl: z.string().url("URL cover proyek tidak valid").optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
});

export const updateProjectSchema = z.object({
  id: z.string().min(1, "ID Proyek tidak valid"),
  name: z.string().min(1, "Nama proyek wajib diisi"),
  clientId: z.string().min(1, "Klien tidak valid"),
  projectManagerId: z.string().min(1, "Project Manager wajib dipilih"),
  totalContractValue: z.number().nonnegative().optional(),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  roomArea: z.string().optional().or(z.literal("")),
  projectType: z.string().optional().or(z.literal("")),
  coverImageUrl: z.string().url("URL cover proyek tidak valid").optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]),
  financialHealth: z.enum(["HEALTHY", "WARNING", "CRITICAL"]),
});

export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
