import { renderToStaticMarkup } from "react-dom/server";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { FormField, QuantityStepper } from "./basic-form-controls";
import { DatePickerField } from "./date-form-controls";
import { FormSection } from "./guided-form";

export function formControlDensityMarkup(presentation: "desktop" | "mobile"): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation={presentation}>
      <main data-atria-admin="" className="mx-auto w-full max-w-3xl space-y-4 p-6">
        <DatePickerField id="date" label="Tanggal" value="2026-10-16" onChange={() => undefined} />
        <FormField label="Jumlah">
          <QuantityStepper id="quantity" value="2" onChange={() => undefined} />
        </FormField>
        <FormSection>
          <DatePickerField
            id="grouped-date"
            label="Tanggal pembayaran"
            value="2026-10-16"
            onChange={() => undefined}
          />
          <FormField label="Jumlah item">
            <QuantityStepper id="grouped-quantity" value="2" onChange={() => undefined} />
          </FormField>
        </FormSection>
      </main>
    </WorkspacePresentationProvider>,
  );
}
