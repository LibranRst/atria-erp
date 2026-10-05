import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

test.describe("PWA safety boundary", (): void => {
  test.skip(process.env.ATRIA_E2E_PWA !== "true", "Opt-in bounded service-worker smoke");
  test.use({ serviceWorkers: "allow" });

  test("online protected reads, anonymous offline cache, and reconnect preserve finance safety", async ({
    page,
  }): Promise<void> => {
    const signalFile = process.env.ATRIA_E2E_OUTAGE_SIGNAL_FILE;
    test.skip(
      !signalFile,
      "Controlled server outage required; Chromium worker fetch can bypass context offline emulation.",
    );
    if (!signalFile) return;
    await page.goto("/login?surface=mobile");
    await page.getByLabel("Email", { exact: true }).fill("ronald@dekoria.com");
    await page.getByLabel("Kata sandi", { exact: true }).fill("password123");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Halo, Ronald/ })).toBeVisible();
    await page.evaluate(async (): Promise<void> => {
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(async (): Promise<boolean> =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);
    await page.goto("/projects?surface=mobile");
    await expect(
      page
        .getByRole("link", {
          name: "Buka project Menteng Villa - Kitchen & Living Room Fit-Out",
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await page.goto("/ledger?surface=mobile");
    await expect(page.getByRole("heading", { name: /Halo, Ronald/ })).toBeVisible();

    const cached = await page.evaluate(async (): Promise<{ urls: string[]; text: string }> => {
      const urls: string[] = [];
      let text = "";
      for (const name of await caches.keys()) {
        if (!name.startsWith("atria-")) continue;
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          urls.push(new URL(request.url).pathname);
          text += (await (await cache.match(request))?.text()) ?? "";
        }
      }
      return { urls, text };
    });
    expect(cached.urls).toEqual(["/offline"]);
    expect(cached.text).not.toContain("Ronald");
    expect(cached.text).not.toContain("ronald@dekoria.com");
    expect(cached.text).not.toContain("655.000.000");

    writeFileSync(signalFile, "ready", { mode: 0o600 });
    await expect
      .poll((): string => readFileSync(signalFile, "utf8"), { timeout: 45_000 })
      .toBe("offline");
    await page.goto("/projects?surface=mobile");
    await expect(page.getByRole("heading", { name: "Tanpa koneksi", exact: true })).toBeVisible();
    await expect(
      page.getByText("Menteng Villa - Kitchen & Living Room Fit-Out", { exact: true }),
    ).toHaveCount(0);
    writeFileSync(signalFile, "reconnect");
    await expect
      .poll((): string => readFileSync(signalFile, "utf8"), { timeout: 45_000 })
      .toBe("online");
    await page.goto("/ledger?surface=mobile");
    await expect(page.getByRole("heading", { name: /Halo, Ronald/ })).toBeVisible();
  });
});
