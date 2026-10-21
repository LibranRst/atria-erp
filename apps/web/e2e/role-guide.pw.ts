import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string, destination: string): Promise<void> {
  await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Kata sandi", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
test.describe.serial("Panduan peran on a disposable seeded database", () => {
  for (const role of [
    {
      label: "Owner",
      email: "ronald@dekoria.com",
      destination: "/ledger?tab=budget&guide=qa#reading",
      action: "Lihat dashboard",
    },
    {
      label: "Finance Admin",
      email: "lisa@dekoria.com",
      destination: "/ledger",
      action: "Buka dashboard keuangan",
    },
    {
      label: "Project Manager",
      email: "budi@dekoria.com",
      destination: "/projects",
      action: "Buka proyek saya",
    },
    {
      label: "Purchasing",
      email: "agus@dekoria.com",
      destination: "/materials",
      action: "Cek material & stok",
    },
  ]) {
    test(`${role.label}: first view, dismissal and Profile replay`, async ({
      page,
      browser,
    }, info): Promise<void> => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await signIn(page, role.email, role.destination);
      const guide = page.getByRole("dialog", { name: "Panduan peran Anda", exact: true });
      if (role.label === "Finance Admin" && page.url().includes("/onboarding/review")) {
        await expect(guide).not.toBeVisible();
        await page.goto(role.destination);
      }
      await expect(guide).toBeVisible();
      await expect(guide.getByRole("heading", { name: role.label, exact: true })).toBeVisible();
      await expect(guide.getByRole("listitem")).toHaveCount(3);
      await expect(guide.getByRole("button", { name: role.action, exact: true })).toBeVisible();
      if (role.label === "Project Manager")
        await expect(guide.getByText(/Jika proyek belum muncul/)).toBeVisible();
      const originalUrl = page.url();
      if (role.label === "Owner" || role.label === "Finance Admin") {
        for (const width of [320, 360, 390, 430, 1024, 1280, 1440]) {
          await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
          await expect(guide).toBeVisible();
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          );
          expect(overflow, `${role.label} document overflow at ${width}`).toBe(false);
          const button = guide.getByRole("button", { name: role.action, exact: true });
          await expect(button).toBeVisible();
          await page.screenshot({
            path: info.outputPath(`${role.label.replaceAll(" ", "-")}-${width}.png`),
          });
        }
      }
      await page.keyboard.press("Escape");
      await expect(guide).not.toBeVisible();
      expect(page.url()).toBe(originalUrl);
      // Wait for the receipt request to finish before opening a second device/session.
      await expect.poll(async () => page.evaluate(() => Boolean(sessionStorage.length))).toBe(true);
      await page.goto("/profile");
      await page.getByRole("button", { name: "Panduan peran saya", exact: true }).click();
      await expect(guide).toBeVisible();
      await guide.getByRole("button", { name: "Mengerti", exact: true }).click();
      await expect(guide).not.toBeVisible();
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Panduan peran saya", exact: true }),
      ).toBeVisible();
      await expect(guide).not.toBeVisible();

      const laptop = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      const another = await laptop.newPage();
      try {
        await signIn(another, role.email, role.destination);
        if (role.label === "Finance Admin" && another.url().includes("/onboarding/review")) {
          await another.goto(role.destination);
        }
        await expect(
          another.getByRole("dialog", { name: "Panduan peran Anda", exact: true }),
        ).not.toBeVisible();
      } finally {
        await laptop.close();
      }
      expect(errors).toEqual([]);
    });
  }

  test("manual guide opening waits for explicit CTA before navigating", async ({
    page,
  }): Promise<void> => {
    await signIn(page, "budi@dekoria.com", "/profile?guide=replay#access");
    await page.getByRole("button", { name: "Panduan peran saya", exact: true }).click();
    const guide = page.getByRole("dialog", { name: "Panduan peran Anda", exact: true });
    await expect(guide).toBeVisible();
    await expect(page).toHaveURL(/\/profile\?guide=replay#access$/);
    await guide.getByRole("button", { name: "Buka proyek saya", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(guide).not.toBeVisible();
  });

  test("header, backdrop and pull dismissal acknowledge viewing without changing location", async ({
    page,
  }): Promise<void> => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "ronald@dekoria.com", "/profile?guide=dismiss#reading");
    const guide = page.getByRole("dialog", { name: "Panduan peran Anda", exact: true });
    const originalUrl = page.url();
    for (const method of ["header", "backdrop", "pull"] as const) {
      await page.getByRole("button", { name: "Panduan peran saya", exact: true }).click();
      await expect(guide).toBeVisible();
      if (method === "header")
        await guide.getByRole("button", { name: "Tutup", exact: true }).click();
      if (method === "backdrop") await page.mouse.click(5, 5);
      if (method === "pull") {
        const handle = await guide
          .getByRole("button", { name: "Perbesar drawer", exact: true })
          .boundingBox();
        if (!handle) throw new Error("Sheet pull handle is missing");
        const x = handle.x + handle.width / 2;
        const y = handle.y + handle.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y + 180, { steps: 8 });
        await page.mouse.up();
      }
      await expect(guide).not.toBeVisible();
      expect(page.url()).toBe(originalUrl);
    }
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Panduan peran saya", exact: true }),
    ).toBeVisible();
    await expect(guide).not.toBeVisible();
  });
});
