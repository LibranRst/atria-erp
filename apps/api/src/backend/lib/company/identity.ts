import { cache } from "@runtime/react-cache";
import { db } from "@backend/db";
import { tenant } from "@backend/db/schema";
import { DEKORIA_TENANT_ID } from "@backend/db/schema/tenant-constants";
import { eq } from "drizzle-orm";

/**
 * Identitas perusahaan pemilik instance ini.
 *
 * Satu instance melayani satu perusahaan, dan `tenant` menyimpan namanya. Ini
 * yang membuat instance kedua benar-benar milik pemakainya alih-alih menyebut
 * dirinya Dekoria di layar orang lain — kebocoran yang paling tidak enak dilihat
 * pelanggan yang baru saja membayar.
 *
 * Cadangannya sengaja generik, bukan "Dekoria": database yang belum sempat
 * diberi nama harus terbaca netral, bukan salah nama.
 */
export type CompanyIdentity = {
  readonly name: string;
  readonly slug: string;
};

const FALLBACK: CompanyIdentity = { name: "Perusahaan", slug: "perusahaan" };

export const getCompanyIdentity = cache(async (): Promise<CompanyIdentity> => {
  try {
    const record = await db.query.tenant.findFirst({
      where: eq(tenant.id, DEKORIA_TENANT_ID),
      columns: { name: true, slug: true },
    });
    if (!record?.name) return FALLBACK;
    return { name: record.name, slug: record.slug };
  } catch (error) {
    console.error("Gagal membaca identitas perusahaan:", error);
    return FALLBACK;
  }
});
