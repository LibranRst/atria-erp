import { and, desc, eq, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { getProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import { db } from "@/db";
import {
  bankAccount,
  itemPriceLibrary,
  materialMaster,
  project,
  projectCost,
  stockMovement,
  vendor,
  vendorBill,
  vendorPayment,
} from "@/db/schema";
import type { ProjectTabsProps } from "@/features/projects/detail/components/project-tabs";
import { resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { requireServerSession } from "@/lib/server/session";
import {
  mapClientInvoices,
  mapCostsForList,
  mapMaterialMasterCatalog,
  mapPricingTemplateCatalog,
  mapProjectsForForms,
} from "./project-detail-mappers";

export async function getProjectDetailData(
  projectId: string,
): Promise<ProjectTabsProps> {
  const session = await requireServerSession();
  const roleName = (await resolveRoleName(session.user.roleId)) ?? "UNKNOWN";
  const isFinanceOperator = roleName === "OWNER" || roleName === "FINANCE_ADMIN";

  try {
    await assertProjectAccess(projectId, session.user.id, roleName);
  } catch {
    redirect("/projects");
  }

  const projectData = await db.query.project.findFirst({
    where: eq(project.id, projectId),
    with: {
      client: true,
      projectManager: true,
      clientInvoices: {
        with: {
          payments: true,
        },
      },
      budget: {
        with: {
          items: {
            with: {
              costCategory: true,
            },
          },
        },
      },
      raps: {
        with: {
          items: {
            with: {
              material: {
                with: {
                  inventory: true,
                },
              },
              stockMovements: true,
            },
          },
        },
      },
      rabEstimates: {
        with: {
          items: true,
          bundles: { with: { items: true } },
          voidedBy: true,
        },
      },
      changeOrders: {
        with: {
          baseRab: { with: { sourceRap: true, items: true } },
          revisedRab: { with: { sourceRap: true, items: true } },
          createdBy: true,
          approvedBy: true,
        },
      },
      categoryPlanItems: {
        with: {
          expenseCategory: true,
          vendor: true,
        },
      },
    },
  });

  if (!projectData) {
    notFound();
  }

  const projectBudgetDashboardResult =
    await getProjectBudgetDashboard(projectId);
  const projectBudgetDashboard = projectBudgetDashboardResult.success
    ? projectBudgetDashboardResult.data
    : null;

  const costCategoriesData = await db.query.projectCostCategory.findMany();
  const bankAccountsData = isFinanceOperator
    ? await db.query.bankAccount.findMany({ where: eq(bankAccount.isActive, true) })
    : [];

  const costsData = await db.query.projectCost.findMany({
    where: eq(projectCost.projectId, projectId),
    with: {
      project: true,
      budgetItem: {
        with: {
          costCategory: true,
        },
      },
      requestedBy: true,
    },
    orderBy: [desc(projectCost.createdAt)],
  });

  const vendorBillsData = await db.query.vendorBill.findMany({
    where: eq(vendorBill.projectId, projectId),
    with: {
      project: true,
      vendor: true,
      budgetItem: {
        with: {
          costCategory: true,
        },
      },
      payments: {
        with: {
          bankAccount: { columns: { name: true } },
        },
      },
    },
    orderBy: [desc(vendorBill.createdAt)],
  });

  const projectBillIds = vendorBillsData.map((bill) => bill.id);
  const vendorPaymentsData =
    projectBillIds.length > 0
      ? await db.query.vendorPayment.findMany({
          where: inArray(vendorPayment.vendorBillId, projectBillIds),
          with: {
            vendorBill: {
              with: {
                project: true,
                vendor: true,
                budgetItem: {
                  with: {
                    costCategory: true,
                  },
                },
              },
            },
            bankAccount: { columns: { name: true } },
            paidBy: true,
          },
          orderBy: [desc(vendorPayment.createdAt)],
        })
      : [];

  const vendorsData = await db.query.vendor.findMany({
    orderBy: [desc(vendor.name)],
  });

  const stockMovementsData = await db.query.stockMovement.findMany({
    where: eq(stockMovement.projectId, projectId),
    with: {
      material: true,
      location: true,
      createdBy: true,
    },
    orderBy: [desc(stockMovement.createdAt)],
  });

  const isPM = roleName === "PROJECT_MANAGER";
  const pmProjectFilter = isPM
    ? eq(project.projectManagerId, session.user.id)
    : undefined;
  const projectsData = await db.query.project.findMany({
    where: pmProjectFilter
      ? and(eq(project.status, "ACTIVE"), pmProjectFilter)
      : eq(project.status, "ACTIVE"),
    with: {
      budget: {
        with: {
          items: {
            with: {
              costCategory: true,
            },
          },
        },
      },
      canonicalBudgets: {
        with: {
          categories: {
            with: {
              expenseCategory: true,
            },
          },
        },
      },
      raps: {
        with: {
          items: true,
        },
      },
      categoryPlanItems: {
        with: {
          expenseCategory: true,
        },
      },
    },
  });

  const materialOptionsData = await db.query.materialMaster.findMany({
    where: eq(materialMaster.isActive, true),
    with: {
      inventory: { with: { location: true } },
      category: true,
    },
  });

  const materialMasterCatalog =
    mapMaterialMasterCatalog(materialOptionsData);

  const pricingTemplateCatalog = await db.query.itemPriceLibrary.findMany({
    where: eq(itemPriceLibrary.isActive, true),
    orderBy: (table, { asc }) => [asc(table.itemType), asc(table.name)],
  });

  const projectsForForms = mapProjectsForForms({
    projects: projectsData,
    materialMasterCatalog,
  });
  const costsForList = mapCostsForList(costsData);
  const invoicesForClient = mapClientInvoices(projectData.clientInvoices);

  return {
    project: projectData,
    costCategories: costCategoriesData,
    userRole: roleName,
    userId: session.user.id,
    bankAccounts: bankAccountsData,
    costs: costsForList,
    vendorBills: vendorBillsData,
    vendorPayments: vendorPaymentsData,
    vendors: vendorsData,
    projectsForForms,
    stockMovements: stockMovementsData,
    invoices: invoicesForClient,
    projectBudgetDashboard,
    materialMasterCatalog,
    pricingTemplateCatalog: mapPricingTemplateCatalog(pricingTemplateCatalog),
  };
}
