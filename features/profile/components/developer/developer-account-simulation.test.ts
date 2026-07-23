import { describe, expect, test } from "bun:test";

const switcherPath = new URL("./developer-account-switcher.tsx", import.meta.url);
const bannerPath = new URL("./developer-simulation-banner.tsx", import.meta.url);

describe("developer account simulation UI contract", () => {
  test("keeps the Owner switcher in one grouped surface with explicit confirmation", async () => {
    const source = await Bun.file(switcherPath).text();
    expect(source).toContain("Simulasi developer");
    expect(source).toContain("divide-y divide-black");
    expect(source).toContain("ConfirmationSheet");
    expect(source).toContain("Session ini benar-benar memakai role terpilih");
    expect(source).toContain("Password sementara");
    expect(source).toContain('tone="warning" label="Development"');
    expect(source).toContain('name="chevron_right"');
    expect(source).not.toContain("animate-pulse");
  });

  test("keeps a persistent, accessible restore action during simulation", async () => {
    const source = await Bun.file(bannerPath).text();
    expect(source).toContain('aria-label="Mode simulasi developer aktif"');
    expect(source).toContain("bottom-[calc(5.5rem+env(safe-area-inset-bottom))]");
    expect(source).toContain("z-20");
    expect(source).toContain("pointer-events-none fixed");
    expect(source).toContain("bg-white/88");
    expect(source).toContain("backdrop-blur-xl");
    expect(source).toContain("leading-5 font-bold text-on-surface");
    expect(source).toContain("text-[10px] leading-4 text-on-surface-variant");
    expect(source).not.toContain("mt-0.5 block truncate");
    expect(source).toContain('"Kembali"');
    expect(source).toContain("min-h-12");
    expect(source).toContain("flex h-10 items-center");
    expect(source).toContain("stopDeveloperAccountSimulation");
    expect(source).not.toContain("initial={{");
  });
});
