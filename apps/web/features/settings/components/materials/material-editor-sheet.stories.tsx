import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import { Button, DesktopUIProvider } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import type { MaterialDraft } from "../../types/material-types";
import { MaterialEditorSheet } from "./material-editor-sheet";

const populatedDraft: MaterialDraft = {
  categoryId: "panel",
  defaultVendorId: "supplier",
  name: "Multipleks finishing natural untuk kabinet ruang keluarga",
  specification: "Ketebalan 18 mm, permukaan natural, verifikasi warna dengan sampel proyek.",
  brand: "Material contoh",
  code: "PLY-18",
  color: "Natural",
  unit: "lembar",
  isActive: true,
  locationId: "warehouse",
  minimumStock: 4,
  lastPurchasePrice: 275_000,
};

function ResponsiveMaterialEditor({
  scenario = "complete",
  nativeFallback = false,
}: {
  readonly scenario?: "complete" | "empty" | "edit" | "pending";
  readonly nativeFallback?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  const [open, setOpen] = React.useState(true);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [draft, setDraft] = React.useState<MaterialDraft>(() =>
    scenario === "empty"
      ? {
          ...populatedDraft,
          name: "",
          categoryId: "",
          unit: "",
          locationId: "",
          defaultVendorId: null,
          minimumStock: 0,
          lastPurchasePrice: 0,
        }
      : scenario === "edit"
        ? { ...populatedDraft, id: "material-fixture" }
        : populatedDraft,
  );
  const required = [draft.name.trim(), draft.categoryId, draft.unit.trim()];
  if (!draft.id) required.push(draft.locationId);
  const completed = required.filter(Boolean).length;
  const pending = scenario === "pending";
  const fixtureAction = (): void => setNotice("Fixture visual: tidak ada data yang disimpan.");

  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <div className="min-h-screen bg-background p-6">
          <Button onClick={() => setOpen(true)}>Buka material contoh</Button>
          {notice ? (
            <p role="status" className="mt-3 text-support">
              {notice}
            </p>
          ) : null}
          <MaterialEditorSheet
            draft={open ? draft : null}
            categories={[{ id: "panel", name: "Panel dan finishing" }]}
            vendors={[{ id: "supplier", name: "Supplier contoh dengan nama perusahaan panjang" }]}
            locations={[{ id: "warehouse", name: "Gudang produksi dan workshop utama" }]}
            canManage
            pending={pending}
            canSave={completed === required.length}
            disabledReason={
              completed === required.length ? undefined : "Lengkapi data utama material."
            }
            completion={[completed, required.length]}
            detailsOpen={detailsOpen}
            onClose={() => setOpen(false)}
            onSubmit={fixtureAction}
            onDraftChange={setDraft}
            onDetailsOpenChange={setDetailsOpen}
            onCreateCategory={fixtureAction}
            onCreateLocation={fixtureAction}
            onCreateVendor={fixtureAction}
          />
        </div>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "Features/Settings/Material editor responsive panels",
  component: ResponsiveMaterialEditor,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResponsiveMaterialEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {};
export const Empty: Story = { args: { scenario: "empty" } };
export const ExistingMaterial: Story = { args: { scenario: "edit" } };
export const Saving: Story = { args: { scenario: "pending" } };
export const NativeFallback: Story = { args: { nativeFallback: true } };
