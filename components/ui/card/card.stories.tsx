import type { Meta, StoryObj } from "@storybook/nextjs";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { Button } from "../button/button";

const meta = {
  title: "ui/card/Card",
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Surface: Story = {
  args: { variant: "surface" },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Anggaran Proyek</CardTitle>
        <CardDescription>Ringkasan penggunaan dana bulan ini</CardDescription>
      </CardHeader>
      <CardContent>Total pengeluaran: Rp 42.500.000 dari Rp 60.000.000</CardContent>
      <CardFooter>
        <Button variant="tertiary" size="compact">
          Lihat detail
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const Elevated: Story = {
  args: { variant: "elevated" },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Material Menipis</CardTitle>
        <CardDescription>3 item memerlukan pembelian ulang</CardDescription>
      </CardHeader>
      <CardContent>Semen, cat tembok, dan keramik lantai berada di bawah ambang stok.</CardContent>
    </Card>
  ),
};
