import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { SwitchRow } from "./basic-form-controls";
import { DesktopUIProvider, GroupedSurface } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";

function Demo(): React.JSX.Element {
  const [checked, setChecked] = useState(true);
  return (
    <div className="w-80 bg-white p-2">
      <SwitchRow
        checked={checked}
        onChange={setChecked}
        title="Notifikasi Persetujuan"
        description="Kirim notifikasi saat ada pengajuan baru"
      />
    </div>
  );
}

const meta = {
  title: "ui/form/SwitchRow",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};

function DesktopReflowDemo({
  direction = "ltr",
}: {
  readonly direction?: "ltr" | "rtl";
}): React.JSX.Element {
  const [checked, setChecked] = useState(true);
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider>
        <div dir={direction} className="w-full max-w-xl p-4">
          <p className="mb-4 text-support text-on-surface-variant">
            Toggle ini juga mengubah posisi dan lebar baris untuk memeriksa batas animasi.
          </p>
          <div className={checked ? "w-full" : "w-80 max-w-full pt-24"}>
            <GroupedSurface variant="desktopPanel">
              <SwitchRow
                checked={checked}
                onChange={setChecked}
                title="Alokasi Material"
                description={
                  checked
                    ? "Dialokasikan 10%"
                    : "Tidak dialokasikan. Baris ini lebih panjang agar tinggi konten ikut berubah saat kategori dinonaktifkan."
                }
                className="p-4"
              />
            </GroupedSurface>
          </div>
        </div>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

export const DesktopReflow: Story = {
  render: () => <DesktopReflowDemo />,
  play: async ({ canvasElement }): Promise<void> => verifyReflow(canvasElement),
};

export const DesktopReflowRtl: Story = {
  render: () => <DesktopReflowDemo direction="rtl" />,
  play: async ({ canvasElement }): Promise<void> => verifyReflow(canvasElement),
};

/** Real browser geometry: HappyDOM cannot model the layout projection that caused this regression. */
async function verifyReflow(canvasElement: HTMLElement): Promise<void> {
  delete canvasElement.dataset.switchReflowVerified;
  const content = canvasElement.querySelector(".switch__content");
  const thumb = canvasElement.querySelector(".switch__thumb");
  const track = canvasElement.querySelector(".switch__control");
  if (!(content instanceof HTMLElement) || !thumb || !track) {
    throw new Error("Struktur toggle desktop belum tersedia.");
  }
  const control = within(canvasElement).getByRole("switch", { name: "Alokasi Material" });
  if (control instanceof HTMLInputElement && !control.checked) await userEvent.click(content);
  for (let frame = 0; frame < 2; frame++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  const initialThumb = thumb.getBoundingClientRect();
  const initialTrack = track.getBoundingClientRect();
  const inset = Number.parseFloat(getComputedStyle(thumb).marginInlineStart);
  const selectedGap =
    getComputedStyle(track).direction === "rtl"
      ? initialThumb.left - initialTrack.left
      : initialTrack.right - initialThumb.right;
  await expect(Math.abs(selectedGap - inset)).toBeLessThanOrEqual(0.5);
  for (const checked of [false, true]) {
    await userEvent.click(content);
    if (checked) await expect(control).toBeChecked();
    else await expect(control).not.toBeChecked();
    let maxVerticalOffset = 0;
    let outsideFrames = 0;
    for (let frame = 0; frame < 36; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const thumbRect = thumb.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      maxVerticalOffset = Math.max(
        maxVerticalOffset,
        Math.abs((thumbRect.top + thumbRect.bottom - trackRect.top - trackRect.bottom) / 2),
      );
      if (
        thumbRect.top < trackRect.top - 0.5 ||
        thumbRect.bottom > trackRect.bottom + 0.5 ||
        thumbRect.left < trackRect.left - 0.5 ||
        thumbRect.right > trackRect.right + 0.5
      ) {
        outsideFrames++;
      }
    }
    await expect(maxVerticalOffset).toBeLessThanOrEqual(0.25);
    await expect(outsideFrames).toBe(0);
  }
  canvasElement.dataset.switchReflowVerified = "true";
}
