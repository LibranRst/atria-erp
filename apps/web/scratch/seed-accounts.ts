import { db } from "../db";
import { account } from "../db/schema";
import { hashPassword } from "better-auth/crypto";

const users = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    email: "ronald@dekoria.com",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "lisa@dekoria.com",
  },
  {
    id: "33333333-3333-3333-3333-333333333331",
    email: "budi@dekoria.com",
  },
  {
    id: "33333333-3333-3333-3333-333333333332",
    email: "siti@dekoria.com",
  },
];

async function main() {
  console.log("Seeding Better Auth accounts for seeded users...");
  const hashedPassword = await hashPassword("password123");

  for (const u of users) {
    console.log(`Inserting account for ${u.email}...`);
    await db.insert(account).values({
      id: `acc-${u.id}`,
      userId: u.id,
      providerId: "credential",
      accountId: u.id,
      password: hashedPassword,
    }).onConflictDoNothing();
  }

  console.log("Seeding accounts completed successfully!");
}

main().catch((err) => {
  console.error("Failed to seed accounts:", err);
  process.exit(1);
});
