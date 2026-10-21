import { describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { integer, pgTable } from "drizzle-orm/pg-core";
import { registerCommitEffect, withCommitEffects } from "./commit-effects";

type TestTransaction = { readonly id: string };
type TestConfig = { readonly isolation: string };

describe("committed transaction effects", () => {
  test("holds effects until native COMMIT resolves and preserves config/result", async () => {
    const transaction: TestTransaction = { id: "commit" };
    let releaseCommit: () => void = () => undefined;
    const committed = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    const order: string[] = [];
    let forwarded: TestConfig | undefined;
    const native = async <T>(
      work: (tx: TestTransaction) => Promise<T>,
      config?: TestConfig,
    ): Promise<T> => {
      forwarded = config;
      const result = await work(transaction);
      await committed;
      order.push("commit");
      return result;
    };
    const run = withCommitEffects(native, () => undefined);
    const result = run(
      async (tx) => {
        order.push("business-write");
        expect(
          registerCommitEffect(tx, "push", () => {
            order.push("push");
          }),
        ).toBe(true);
        return "payment-saved";
      },
      { isolation: "serializable" },
    );
    await Promise.resolve();
    expect(order).toEqual(["business-write"]);
    releaseCommit();
    expect(await result).toBe("payment-saved");
    expect(forwarded).toEqual({ isolation: "serializable" });
    expect(order).toEqual(["business-write", "commit", "push"]);
    expect(registerCommitEffect(transaction, "late", () => undefined)).toBe(false);
  });

  test("rollback and native COMMIT failure never dispatch", async () => {
    for (const failInside of [true, false]) {
      const transaction: TestTransaction = { id: "rollback" };
      let dispatched = 0;
      const native = async <T>(work: (tx: TestTransaction) => Promise<T>): Promise<T> => {
        await work(transaction);
        throw new Error("commit-failed");
      };
      const run = withCommitEffects(native, () => undefined);
      await expect(
        run(async (tx) => {
          registerCommitEffect(tx, "push", () => {
            dispatched += 1;
          });
          if (failInside) throw new Error("business-rejected");
          return "pending";
        }),
      ).rejects.toThrow(failInside ? "business-rejected" : "commit-failed");
      expect(dispatched).toBe(0);
      expect(registerCommitEffect(transaction, "late", () => undefined)).toBe(false);
    }
  });

  test("deduplicates one push kick across events in the same transaction", async () => {
    const calls: string[] = [];
    const native = async <T>(work: (tx: TestTransaction) => Promise<T>): Promise<T> =>
      work({ id: "many" });
    const run = withCommitEffects(native, () => undefined);
    await run(async (tx) => {
      registerCommitEffect(tx, "push", () => {
        calls.push("first");
      });
      registerCommitEffect(tx, "push", () => {
        calls.push("duplicate");
      });
      registerCommitEffect(tx, "other", () => {
        calls.push("other");
      });
    });
    expect(calls).toEqual(["first", "other"]);
  });

  test("effect/reporting errors cannot change a committed business outcome", async () => {
    const native = async <T>(work: (tx: TestTransaction) => Promise<T>): Promise<T> =>
      work({ id: "saved" });
    const run = withCommitEffects(native, () => {
      throw new Error("logging-failed");
    });
    const result = await run(async (tx) => {
      registerCommitEffect(tx, "push", () => {
        throw new Error("notification-failed");
      });
      return { paid: true };
    });
    expect(result).toEqual({ paid: true });
  });

  test("Drizzle commit is visible to the effect, and rolled-back writes stay absent", async () => {
    const client = new PGlite();
    const row = pgTable("commit_effect_fixture", { id: integer("id").primaryKey() });
    try {
      await client.exec("CREATE TABLE commit_effect_fixture (id integer PRIMARY KEY)");
      const database = drizzle(client, { schema: { row } });
      database.transaction = withCommitEffects(
        database.transaction.bind(database),
        () => undefined,
      );
      let observed: Promise<readonly { id: number }[]> = Promise.resolve([]);
      let dispatches = 0;
      await database.transaction(async (tx) => {
        await tx.insert(row).values({ id: 1 });
        registerCommitEffect(tx, "push", () => {
          dispatches += 1;
          observed = database
            .select()
            .from(row)
            .then((rows) => rows);
        });
      });
      expect(await observed).toEqual([{ id: 1 }]);
      await expect(
        database.transaction(async (tx) => {
          await tx.insert(row).values({ id: 2 });
          registerCommitEffect(tx, "push", () => {
            dispatches += 1;
          });
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      expect(await database.select().from(row)).toEqual([{ id: 1 }]);
      expect(dispatches).toBe(1);
    } finally {
      await client.close();
    }
  });
});
