import type { Meta, StoryObj } from "@storybook/nextjs";

import { FieldContextLine, FormSection } from "./guided-form";

const meta = {
  title: "ui/form/FormSection",
  component: FormSection,
  args: {
    title: "Informasi Vendor",
    helper: "Data kontak dan pembayaran",
    children: <FieldContextLine>Toko Bangunan Jaya</FieldContextLine>,
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grouped: Story = {};

export const Plain: Story = {
  args: { presentation: "plain" },
};
