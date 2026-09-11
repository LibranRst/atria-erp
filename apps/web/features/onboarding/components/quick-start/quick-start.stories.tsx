import type { Meta, StoryObj } from "@storybook/nextjs";

import type { OrganizationSetupOverview } from "@atria/core/onboarding/organization-setup";
import type { QuickStartWorkspaceData } from "@/features/onboarding/server/get-quick-start-workspace-data";
import { FirstProjectPanel } from "./first-project-panel";
import { OrganizationSetupCard } from "./organization-setup-card";
import { QuickStartWorkspace } from "./quick-start-workspace";

const overview: OrganizationSetupOverview = {
  canManageQuickStart: true,
  hasPersistedState: true,
  freshInstall: true,
  shouldAutoOpen: true,
  quickStart: {
    state: {
      version: 2,
      status: "IN_PROGRESS",
      currentStep: "welcome",
      reviewedSteps: [],
      firstProjectId: null,
      initialStockDecision: "UNDECIDED",
      startedAt: "2026-08-31T00:00:00.000Z",
      completedAt: null,
    },
    progress: { current: 0, total: 2, percentage: 0, label: "2 tahap" },
  },
  requiredReadiness: [
    {
      id: "core_team",
      label: "Tim inti",
      detail: "Lengkapi Finance Admin, Project Manager, dan Purchasing.",
      ready: false,
      status: "INCOMPLETE",
      action: { href: "/settings?tab=organization", label: "Kelola tim" },
    },
    {
      id: "bank_account",
      label: "Rekening perusahaan",
      detail: "Rekening diperlukan sebelum arus kas dicatat.",
      ready: false,
      status: "INCOMPLETE",
      action: { href: "/ledger?tab=accounts", label: "Tambah rekening" },
    },
    {
      id: "material_foundation",
      label: "Lokasi & Material Master",
      detail: "Buat lokasi dan minimal satu Material Master aktif.",
      ready: false,
      status: "INCOMPLETE",
      action: { href: "/settings?tab=catalog", label: "Siapkan material" },
    },
    {
      id: "initial_stock",
      label: "Keputusan saldo awal stok",
      detail: "Nyatakan tidak ada stok lama atau ajukan saldo awal fisik.",
      ready: false,
      status: "INCOMPLETE",
      action: { href: "/settings?tab=readiness&flow=initial-stock", label: "Tentukan saldo awal" },
    },
  ],
  recommendedReadiness: [],
  requiredReadyCount: 0,
  requiredTotal: 4,
  allRequiredReady: false,
};

const meta = {
  title: "Onboarding/Quick Start",
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-97.5 max-w-full bg-surface p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Welcome: Story = {
  render: () => {
    const data: QuickStartWorkspaceData = {
      overview,
      activeStep: "welcome",
      financial: null,
      project: null,
    };
    return <QuickStartWorkspace initialData={data} />;
  },
};

export const DashboardCard: Story = {
  render: () => <OrganizationSetupCard overview={overview} density="dashboard" />,
};

export const FirstProject: Story = {
  render: () => (
    <FirstProjectPanel
      data={{
        status: "ready",
        clients: [{ id: "11111111-1111-4111-8111-111111111111", name: "Klien Dekoria" }],
        projectManagers: [],
        allocation: {
          budgetCapRatio: 0.9,
          categories: [
            {
              expenseCategoryId: "21111111-1111-4111-8111-111111111111",
              code: "MATERIAL",
              name: "Material",
              ratioPercentage: 0.38,
              sortOrder: 1,
            },
            {
              expenseCategoryId: "31111111-1111-4111-8111-111111111111",
              code: "TUKANG",
              name: "Tukang",
              ratioPercentage: 0.28,
              sortOrder: 2,
            },
            {
              expenseCategoryId: "41111111-1111-4111-8111-111111111111",
              code: "OPERASIONAL",
              name: "Operasional",
              ratioPercentage: 0.04,
              sortOrder: 3,
            },
            {
              expenseCategoryId: "51111111-1111-4111-8111-111111111111",
              code: "LAIN_LAIN",
              name: "Lain-lain",
              ratioPercentage: 0.02,
              sortOrder: 4,
            },
            {
              expenseCategoryId: "61111111-1111-4111-8111-111111111111",
              code: "SUBCON",
              name: "Subcon",
              ratioPercentage: 0.2,
              sortOrder: 5,
            },
          ],
        },
      }}
      onCreated={() => undefined}
    />
  ),
};
