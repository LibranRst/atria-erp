import { db } from "@backend/db";
import {
  verifyDevelopmentDataset,
  type DevelopmentVerificationReport,
} from "@backend/db/seed/development-validation";

export async function verifyDevelopmentSeed(): Promise<DevelopmentVerificationReport> {
  return verifyDevelopmentDataset(db);
}
