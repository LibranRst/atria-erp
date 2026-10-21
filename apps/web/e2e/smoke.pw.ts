import { expect, test, type Page } from "@playwright/test";

async function signIn(
  page: Page,
  email: string,
  destination = "/ledger?surface=mobile",
): Promise<void> {
  await page.goto(`/login?surface=mobile&returnTo=${encodeURIComponent(destination)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Kata sandi", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("Owner login uses independent API and exposes finance decision views", async ({
  page,
}): Promise<void> => {
  const errors: string[] = [];
  page.on("pageerror", (error): void => {
    errors.push(error.message);
  });
  await signIn(page, "ronald@dekoria.com");
  await expect(page.getByRole("heading", { name: /Halo, Ronald/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Budget/ })).toBeVisible();
  await page.getByRole("tab", { name: /Rekening/ }).click();
  await expect(page.getByText("BCA Operasional", { exact: true })).toBeVisible();
  await page.goto("/admin/ledger");
  await expect(page.getByRole("navigation", { name: "Workspace desktop" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Halo, Ronald/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("PM session cannot gain desktop/finance access through a URL", async ({
  page,
}): Promise<void> => {
  await signIn(page, "budi@dekoria.com", "/projects?surface=mobile");
  await page.goto("/admin/ledger");
  await expect(
    page.getByRole("heading", { name: "Akses desktop dibatasi", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Workspace desktop" })).toHaveCount(0);
  await page.goto("/ledger?surface=mobile");
  await expect(
    page.getByRole("heading", { name: "Akses ditolak", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Halo, Ronald/ })).toHaveCount(0);
});

test("login labels and keyboard submit remain usable", async ({ page }): Promise<void> => {
  await page.goto("/login?surface=mobile");
  await page.getByLabel("Email", { exact: true }).fill("ronald@dekoria.com");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Kata sandi", { exact: true })).toBeFocused();
  await page.keyboard.type("password123");
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /Halo, Ronald/ })).toBeVisible();
});

test("Finance cash entry updates the Owner's already-open account detail after refresh", async ({
  page,
  browser,
}): Promise<void> => {
  await signIn(page, "ronald@dekoria.com", "/ledger?tab=accounts&surface=mobile");
  await page.getByRole("button", { name: "Buka rekening BCA Operasional", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Detail Rekening", exact: true });
  const balance = detail.locator(".financial-amount").first();
  const previousText = await balance.innerText();
  const previousBalance = Number(previousText.replace(/[^\d]/g, ""));
  expect(previousBalance).toBeGreaterThan(0);

  const financeContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const finance = await financeContext.newPage();
  const marker = `Browser UAT ${Date.now()}`;
  let needsCompensation = false;
  const postCash = async (direction: "Masuk" | "Keluar"): Promise<void> => {
    await finance.goto("/ledger?tab=accounts&surface=mobile");
    await finance
      .getByRole("button", { name: "Buka rekening BCA Operasional", exact: true })
      .click();
    await finance.getByRole("button", { name: `Kas ${direction}`, exact: true }).click();
    await finance.getByLabel("Nominal", { exact: true }).fill("1000");
    await finance
      .getByLabel("Deskripsi", { exact: true })
      .fill(`${marker} ${direction.toLowerCase()} — kompensasi pengujian saldo`);
    await finance.getByRole("button", { name: "Tinjau", exact: true }).click();
    await finance.getByRole("button", { name: "Catat", exact: true }).click();
    await expect(finance.getByText("Mutasi kas tercatat", { exact: true })).toBeVisible();
    await finance.getByRole("button", { name: "Selesai", exact: true }).click();
  };
  try {
    await signIn(finance, "lisa@dekoria.com", "/ledger?tab=accounts&surface=mobile");
    await postCash("Masuk");
    needsCompensation = true;
    await page.evaluate((): void => {
      window.dispatchEvent(new Event("online"));
    });
    await expect(balance).toHaveText(`Rp ${(previousBalance + 1000).toLocaleString("id-ID")}`);
    await expect(detail).toBeVisible();
    await expect(
      detail.getByText(`${marker} masuk — kompensasi pengujian saldo`, { exact: true }),
    ).toBeVisible();
    await postCash("Keluar");
    needsCompensation = false;
    await page.reload();
    await page.getByRole("button", { name: "Buka rekening BCA Operasional", exact: true }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Detail Rekening", exact: true })
        .locator(".financial-amount")
        .first(),
    ).toHaveText(previousText);
  } finally {
    if (needsCompensation) await postCash("Keluar");
    await financeContext.close();
  }
});

for (const width of [320, 360, 390, 430, 1024, 1280, 1440]) {
  test(`Owner dashboard layout at ${width}px`, async ({ page }, testInfo): Promise<void> => {
    const hydrationErrors: string[] = [];
    if (width === 320)
      page.on("console", (message): void => {
        if (message.type() === "error" && message.text().includes("hydrated"))
          hydrationErrors.push(message.text());
      });
    await page.setViewportSize({ width, height: 960 });
    await signIn(page, "ronald@dekoria.com");
    if (width >= 1024) await page.goto("/admin/ledger");
    await expect(page.getByRole("heading", { name: /Halo, Ronald/ })).toBeVisible();
    const geometry = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      main: document.querySelector("main")?.getBoundingClientRect().width ?? 0,
    }));
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
    if (width < 1024) expect(geometry.main).toBeLessThanOrEqual(448);
    if (width === 320) {
      const notice = page.getByText("Saldo pilot: snapshot awal + transaksi pilot", {
        exact: true,
      });
      if (await notice.count()) {
        const ratio = await notice.evaluate((text): number => {
          const panel = text.closest("section");
          const inset = text.parentElement?.parentElement;
          if (!panel || !inset)
            throw new Error("Pilot notice must remain inside its owning cash surface");
          const canvas = document.createElement("canvas");
          canvas.width = 1;
          canvas.height = 1;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Color measurement unavailable");
          const luminance = (color: readonly number[]): number => {
            const channels = color
              .map((value) => value / 255)
              .map((value) =>
                value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
              );
            return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
          };
          context.fillStyle = getComputedStyle(panel).backgroundColor;
          context.fillRect(0, 0, 1, 1);
          context.fillStyle = getComputedStyle(inset).backgroundColor;
          context.fillRect(0, 0, 1, 1);
          const background = luminance(
            Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3),
          );
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = getComputedStyle(text).color;
          context.fillRect(0, 0, 1, 1);
          const foreground = luminance(
            Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3),
          );
          return (
            (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
          );
        });
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    }
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), fullPage: true });
    if (width === 320) expect(hydrationErrors).toEqual([]);
  });
}
