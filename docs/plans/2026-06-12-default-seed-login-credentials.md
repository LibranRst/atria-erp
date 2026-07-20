# Default Seed Login Credentials Implementation Plan

**Goal:** Make the seeded Atria ERP database loggable by adding Better Auth credential accounts with a known development password for each seeded user.

**Architecture:** Keep the existing direct Drizzle seed flow, but include Better Auth's `account` table in cleanup and insert one credential account per seeded user immediately after the `user` rows. Use Better Auth's documented credential account shape: `providerId: "credential"`, `accountId: user.id`, `userId: user.id`, and `password` containing a hashed password. Use Better Auth's internal password hasher from the existing `auth` instance so the seeded hashes match runtime sign-in verification instead of hardcoding or introducing a second hashing library.

**Tech Stack:** Bun, TypeScript, Drizzle ORM, Neon PostgreSQL adapter, Better Auth v1.6.x email/password auth.

---

## File Structure

- Modify: `db/seed.ts`
  - Import the Better Auth `account` table.
  - Import the app's `auth` instance.
  - Delete existing credential account rows before deleting users.
  - Hash one shared development password and seed credential accounts for the existing four users.
  - Print safe login hints without exposing hashes.
- No new test files for this small seed-only change.
  - This repository currently has no test harness for isolated seed scripts.
  - Verification will be command-based: run lint/build as available, run seed against the configured local database, then attempt login manually.

## Important Current Facts

- `package.json` already exposes `bun run db:seed`.
- `db/schema.ts` defines the Better Auth `account` table with columns `id`, `accountId`, `providerId`, `userId`, `password`, `createdAt`, and `updatedAt`.
- `lib/auth.ts` enables Better Auth `emailAndPassword`.
- Context7 Better Auth v1.6.11 docs show credential accounts are linked with:

```ts
await ctx.context.internalAdapter.linkAccount({
  accountId: user.id,
  providerId: "credential",
  password: hashedPassword,
  userId: user.id,
});
```

- The same docs show password hashing should use Better Auth's password context when creating credential accounts:

```ts
const hashedPassword = await ctx.context.password.hash(ctx.body.password);
```

## Credentials to Seed

Use one shared local-development password for all seeded users:

```text
password: password123
```

Seed these accounts:

```text
ronald@dekoria.com  / password123  / owner
lisa@dekoria.com    / password123  / finance_admin
budi@dekoria.com    / password123  / project_manager
siti@dekoria.com    / password123  / project_manager
```

---

### Task 1: Seed Better Auth credential accounts

**Files:**
- Modify: `db/seed.ts:1-102`

- [ ] **Step 1: Import `account` and `auth`**

Change the imports at the top of `db/seed.ts` from:

```ts
import { db } from "./index";
import {
  role,
  user,
  client,
  vendor,
  bankAccount,
  projectCostCategory,
  project,
  projectBudget,
  projectBudgetItem,
  clientInvoice,
  cashTransaction,
  clientPayment,
  vendorBill,
  vendorPayment,
  projectCost,
  approval,
  aiRun,
  notification,
  auditLog
} from "./schema";
```

to:

```ts
import { auth } from "@/lib/auth";
import { db } from "./index";
import {
  role,
  user,
  client,
  vendor,
  bankAccount,
  projectCostCategory,
  project,
  projectBudget,
  projectBudgetItem,
  clientInvoice,
  cashTransaction,
  clientPayment,
  vendorBill,
  vendorPayment,
  projectCost,
  approval,
  aiRun,
  notification,
  auditLog,
  account,
} from "./schema";
```

- [ ] **Step 2: Delete account rows before deleting users**

In the cleanup section, change:

```ts
    await tx.delete(vendor);
    await tx.delete(client);
    await tx.delete(user);
    await tx.delete(role);
```

to:

```ts
    await tx.delete(vendor);
    await tx.delete(client);
    await tx.delete(account);
    await tx.delete(user);
    await tx.delete(role);
```

This avoids foreign-key failures because `account.userId` references `user.id`.

- [ ] **Step 3: Hash the shared development password before inserting users**

Immediately before the existing comment `// 2. Seed Users`, add:

```ts
    const defaultPassword = "password123";
    const hashedDefaultPassword = await auth.$context.then((context) =>
      context.password.hash(defaultPassword)
    );
```

Expected placement:

```ts
    await tx.insert(role).values([
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "owner",
        description: "Pemilik Perusahaan (Full Access & Approver)",
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        name: "finance_admin",
        description: "Finance & Bookkeeper (Verifikator & Rekonsiliasi)",
      },
      {
        id: "00000000-0000-0000-0000-000000000003",
        name: "project_manager",
        description: "Manajer Proyek Lapangan (Pengaju Biaya & Operator)",
      },
    ]);

    const defaultPassword = "password123";
    const hashedDefaultPassword = await auth.$context.then((context) =>
      context.password.hash(defaultPassword)
    );

    // 2. Seed Users
```

- [ ] **Step 4: Insert credential accounts after inserting users**

Immediately after the existing `await tx.insert(user).values([...]);` block, add:

```ts
    console.log("Seeding auth accounts...");
    await tx.insert(account).values([
      {
        id: "account-11111111-1111-1111-1111-111111111111",
        accountId: "11111111-1111-1111-1111-111111111111",
        providerId: "credential",
        userId: "11111111-1111-1111-1111-111111111111",
        password: hashedDefaultPassword,
      },
      {
        id: "account-22222222-2222-2222-2222-222222222222",
        accountId: "22222222-2222-2222-2222-222222222222",
        providerId: "credential",
        userId: "22222222-2222-2222-2222-222222222222",
        password: hashedDefaultPassword,
      },
      {
        id: "account-33333333-3333-3333-3333-333333333331",
        accountId: "33333333-3333-3333-3333-333333333331",
        providerId: "credential",
        userId: "33333333-3333-3333-3333-333333333331",
        password: hashedDefaultPassword,
      },
      {
        id: "account-33333333-3333-3333-3333-333333333332",
        accountId: "33333333-3333-3333-3333-333333333332",
        providerId: "credential",
        userId: "33333333-3333-3333-3333-333333333332",
        password: hashedDefaultPassword,
      },
    ]);
```

Expected placement:

```ts
    await tx.insert(user).values([
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Ronald Wijaya",
        email: "ronald@dekoria.com",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000001",
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Lisa Permata",
        email: "lisa@dekoria.com",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000002",
      },
      {
        id: "33333333-3333-3333-3333-333333333331",
        name: "Budi Santoso",
        email: "budi@dekoria.com",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000003",
      },
      {
        id: "33333333-3333-3333-3333-333333333332",
        name: "Siti Aminah",
        email: "siti@dekoria.com",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000003",
      },
    ]);

    console.log("Seeding auth accounts...");
    await tx.insert(account).values([
      {
        id: "account-11111111-1111-1111-1111-111111111111",
        accountId: "11111111-1111-1111-1111-111111111111",
        providerId: "credential",
        userId: "11111111-1111-1111-1111-111111111111",
        password: hashedDefaultPassword,
      },
      {
        id: "account-22222222-2222-2222-2222-222222222222",
        accountId: "22222222-2222-2222-2222-222222222222",
        providerId: "credential",
        userId: "22222222-2222-2222-2222-222222222222",
        password: hashedDefaultPassword,
      },
      {
        id: "account-33333333-3333-3333-3333-333333333331",
        accountId: "33333333-3333-3333-3333-333333333331",
        providerId: "credential",
        userId: "33333333-3333-3333-3333-333333333331",
        password: hashedDefaultPassword,
      },
      {
        id: "account-33333333-3333-3333-3333-333333333332",
        accountId: "33333333-3333-3333-3333-333333333332",
        providerId: "credential",
        userId: "33333333-3333-3333-3333-333333333332",
        password: hashedDefaultPassword,
      },
    ]);

    // 3. Seed Clients
```

- [ ] **Step 5: Print safe login hints at the end of the seed**

Near the end of `db/seed.ts`, after the existing success log line, add these lines:

```ts
  console.log("Default development login credentials:");
  console.log("- ronald@dekoria.com / password123 (owner)");
  console.log("- lisa@dekoria.com / password123 (finance_admin)");
  console.log("- budi@dekoria.com / password123 (project_manager)");
  console.log("- siti@dekoria.com / password123 (project_manager)");
```

If the current ending is:

```ts
  console.log("Database seeding completed successfully!");
}
```

change it to:

```ts
  console.log("Database seeding completed successfully!");
  console.log("Default development login credentials:");
  console.log("- ronald@dekoria.com / password123 (owner)");
  console.log("- lisa@dekoria.com / password123 (finance_admin)");
  console.log("- budi@dekoria.com / password123 (project_manager)");
  console.log("- siti@dekoria.com / password123 (project_manager)");
}
```

- [ ] **Step 6: Run TypeScript/lint verification**

Run:

```bash
bun run lint
```

Expected: command completes without new lint errors.

If lint fails because of pre-existing unrelated files, capture the output and report which errors are unrelated versus caused by `db/seed.ts`.

- [ ] **Step 7: Run the seed script**

Run:

```bash
bun run db:seed
```

Expected output includes:

```text
Starting database cleanup and seeding...
Cleaning up database tables...
Database cleaned!
Seeding roles...
Seeding users...
Seeding auth accounts...
...
Database seeding completed successfully!
Default development login credentials:
- ronald@dekoria.com / password123 (owner)
- lisa@dekoria.com / password123 (finance_admin)
- budi@dekoria.com / password123 (project_manager)
- siti@dekoria.com / password123 (project_manager)
```

If `DATABASE_URL` is not configured or the local database is not running, stop and report the database connection error. Do not change the fallback connection string without a separate plan.

- [ ] **Step 8: Verify manual login**

Run the app:

```bash
bun run dev
```

Open the local URL printed by Next.js, usually:

```text
http://localhost:3000/login
```

Log in with:

```text
email: ronald@dekoria.com
password: password123
```

Expected: login succeeds and redirects away from `/login` to the role-appropriate landing page.

Stop the dev server after verification.

- [ ] **Step 9: Commit**

Only commit if the user explicitly asks for a commit. If committing, use:

```bash
git add db/seed.ts docs/plans/2026-06-12-default-seed-login-credentials.md
git commit -m "feat: add default seeded auth credentials"
```

Include the required co-author trailer in the commit message body:

```text
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Self-Review

**Spec coverage:**
- User needs a way to log in: Task 1 adds Better Auth credential accounts for all seeded users.
- Unknown email/password problem: the plan documents exact default credentials and prints them after seeding.
- Better Auth compatibility: the plan follows Better Auth v1.6.11 docs for credential account shape and password hashing.

**Placeholder scan:**
- No `TBD`, `TODO`, `implement later`, or vague test instructions remain.
- Every code-changing step includes exact code.

**Type consistency:**
- Uses existing `account` export from `db/schema.ts`.
- Uses existing `auth` export from `lib/auth.ts`.
- Account `userId` values match seeded `user.id` values.
- Account `accountId` values match Better Auth credential account examples by using each `user.id`.
