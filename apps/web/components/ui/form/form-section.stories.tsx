import type { Meta, StoryObj } from "@storybook/nextjs";

import { FieldContextLine, FormSection } from "./guided-form";
import { FormField, TextInput } from "./basic-form-controls";

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

export const Embedded: Story = {
  render: () => (
    <div className="rounded-owner bg-surface-container-lowest p-2 shadow-control">
      <FormSection presentation="embedded">
        <FormField label="Nama material">
          <TextInput value="Panel contoh" onChange={() => undefined} />
        </FormField>
      </FormSection>
    </div>
  ),
};
