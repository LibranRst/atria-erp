import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import { Button, DesktopUIProvider } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import type { ManagedRole } from "@/server/usecases/administration/roles";
import { RoleCreateSheet, type RoleCreateForm, EMPTY_ROLE_CREATE_FORM } from "./role-create-sheet";

const roles: readonly ManagedRole[] = [
  {
    id: "demo-project-manager",
    name: "PROJECT_MANAGER",
    description: "Kelola proyek yang ditugaskan.",
    dataScope: "ASSIGNED",
    isSystem: true,
    isOwnerRole: false,
    userCount: 3,
    permissions: ["view:project", "view:cost", "create:cost"],
  },
];

function Demo({ mobile = false }: { readonly mobile?: boolean }): React.JSX.Element {
  const [open, setOpen] = React.useState(true);
  const [form, setForm] = React.useState<RoleCreateForm>({
    ...EMPTY_ROLE_CREATE_FORM,
    name: "Pengawas lapangan",
    duplicateFromRoleId: roles[0]?.id ?? "",
  });
  return (
    <WorkspacePresentationProvider presentation={mobile ? "mobile" : "desktop"}>
      <DesktopUIProvider>
        <Button onClick={() => setOpen(true)}>Buka peran</Button>
        <RoleCreateSheet
          open={open}
          form={form}
          roles={roles}
          pending={false}
          onFormChange={setForm}
          onClose={() => setOpen(false)}
          onSubmit={() => setOpen(false)}
        />
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "Administration/Manual form panels",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopRole: Story = { render: () => <Demo /> };
export const NativePinnedRole: Story = { render: () => <Demo mobile /> };
