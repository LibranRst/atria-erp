import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import {
  ChoiceRow,
  FormField,
  FormSection,
  MoneyInput,
  MoneyValue,
  TextInput,
  ReviewCollection,
  ReviewItem,
} from "@/components/ui";
const meta = {
  title: "UI/ReviewCollection",
  component: ReviewCollection,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ReviewCollection>;
export default meta;
type Story = StoryObj<typeof meta>;
function Fixture(): React.JSX.Element {
  const [expanded, setExpanded] = React.useState<number | null>(null),
    [selection, setSelection] = React.useState([true, false, true]),
    [name, setName] = React.useState("Panel laminasi dapur"),
    [price, setPrice] = React.useState("275000");
  const names = [name, "Pemasangan panel dan finishing dapur", "Instalasi kabinet kitchen"];
  return (
    <div className="max-w-3xl">
      <ReviewCollection ariaLabel="Contoh review">
        {names.map((title, index) => (
          <ReviewItem
            key={index}
            title={title}
            meta={index ? "Paket pekerjaan · m2" : "Material · lembar"}
            selection={
              <ChoiceRow
                compact
                presentation="review"
                indicatorShape="square"
                title={`Pilih ${title}`}
                checked={selection[index]}
                onChange={(checked) =>
                  setSelection((values) =>
                    values.map((value, i) => (i === index ? checked : value)),
                  )
                }
              />
            }
            primaryValue={
              <MoneyValue
                amount={index ? 3000000 : Number(price) * 10}
                variant="fullDynamic"
                size="sm"
                align="right"
              />
            }
            summary="Jumlah 10 lembar · referensi harga ditinjau"
            expanded={expanded === index}
            onToggle={() => setExpanded(expanded === index ? null : index)}
            editable
            editor={
              <FormSection presentation="embedded">
                <FormField label="Nama">
                  <TextInput value={name} onChange={setName} />
                </FormField>
                <FormField label="Harga jual">
                  <MoneyInput value={price} onChange={setPrice} showPreview={false} />
                </FormField>
              </FormSection>
            }
          />
        ))}
      </ReviewCollection>
    </div>
  );
}
export const Editable: Story = {
  args: { ariaLabel: "Review", children: null },
  render: () => <Fixture />,
};
export const Decisions: Story = {
  args: { ariaLabel: "Keputusan", children: null },
  render: () => (
    <div className="max-w-3xl">
      <ReviewCollection ariaLabel="Keputusan RAP">
        <ReviewItem
          title="Paket pemasangan siap"
          meta="Tukang"
          primaryValue={<MoneyValue amount={25000000} variant="fullDynamic" size="sm" />}
        >
          <p className="text-support">Status Draft → Siap. Lingkup dan estimasi sudah ditinjau.</p>
        </ReviewItem>
        <ReviewItem title="Finalisasi RAP">
          <p className="text-support">Baseline rencana dikunci setelah konfirmasi.</p>
        </ReviewItem>
      </ReviewCollection>
    </div>
  ),
};
