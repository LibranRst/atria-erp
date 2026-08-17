const CONFIRMATION_FLAG = "--confirm-reset";

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, {
    cwd: process.cwd(),
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`Command gagal (${exitCode}): ${command.join(" ")}`);
}

async function resetDemoDatabase(): Promise<void> {
  if (!process.argv.slice(2).includes(CONFIRMATION_FLAG)) {
    throw new Error(
      `Demo reset dibatalkan. Jalankan ulang dengan ${CONFIRMATION_FLAG} setelah memeriksa DATABASE_URL.`,
    );
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo reset tidak pernah diizinkan ketika NODE_ENV=production.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib tersedia.");

  await run(["bun", "scripts/reset-database.ts", CONFIRMATION_FLAG]);
  await run(["bun", "db/seed.ts"]);
  await run(["bun", "scripts/verify-demo-seed.ts"]);
  console.log("Sandbox demo siap digunakan.");
}

if (import.meta.main) {
  resetDemoDatabase().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
