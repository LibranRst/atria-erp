import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import { Button, DesktopUIProvider } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import type { AccountDraft } from "@/features/finance-dashboard/types/bank-account-types";
import { CARD_PRESETS } from "@/features/finance-dashboard/utils/bank-account-constants";
import { AccountFormSheet } from "./account-form-sheet";

const preset = CARD_PRESETS[0];
if (!preset) throw new Error("Fixture rekening membutuhkan preset identitas.");
const initialDraft: AccountDraft = {
  id: null,
  name: "Operasional proyek dan produksi",
  bankName: "Bank contoh",
  accountNumber: "0000012345",
  holderName: "Tim Finance Contoh",
  openingBalance: "125000000",
  cardColorFrom: preset.from,
  cardColorTo: preset.to,
  cardTextColor: preset.text,
  isActive: true,
};

function ResponsiveAccountForm({
  nativeFallback = false,
  empty = false,
}: {
  readonly nativeFallback?: boolean;
  readonly empty?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  const baseline = empty
    ? {
        ...initialDraft,
        name: "",
        bankName: "",
        accountNumber: "",
        holderName: "",
        openingBalance: "",
      }
    : initialDraft;
  const [draft, setDraft] = React.useState<AccountDraft>(baseline);
  const [open, setOpen] = React.useState(true);
  const [notice, setNotice] = React.useState("");
  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <div className="min-h-screen bg-background p-6">
          <Button onClick={() => setOpen(true)}>Buka rekening contoh</Button>
          {notice ? <p role="status">{notice}</p> : null}
          <AccountFormSheet
            open={open}
            title="Tambah rekening contoh"
            draft={draft}
            setDraft={setDraft}
            isDirty={JSON.stringify(draft) !== JSON.stringify(baseline)}
            pending={false}
            canEditStatus={false}
            onClose={() => setOpen(false)}
            onDiscard={() => {
              setDraft(baseline);
              setOpen(false);
            }}
            onSave={() =>
              setNotice("Fixture visual: tidak ada rekening atau mutasi yang disimpan.")
            }
          />
        </div>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "Features/Finance/Manual cash form panels",
  component: ResponsiveAccountForm,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResponsiveAccountForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Account: Story = {};
export const Empty: Story = { args: { empty: true } };
export const NativeFallback: Story = { args: { nativeFallback: true } };
