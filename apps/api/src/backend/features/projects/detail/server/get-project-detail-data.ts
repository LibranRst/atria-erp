import { getRoleDataScopeByName, roleNameHasPermission } from "@backend/lib/auth/role-access";
import { getApprovalThresholds } from "@backend/lib/finance/approval-thresholds";
import { thresholdCentsToRupiah } from "@atria/core/finance/approval-thresholds";
import { projectMaterialProjection } from "@atria/core/material/project-material-projection";
import { projectMarginCash } from "@atria/core/finance/project-cash";
import type { ProjectMarginData } from "@atria/core/types/project-margin";
import type {
  ProjectOperationSource,
  ProjectStockData,
} from "@atria/core/types/project-operations";
import { and, desc, eq, inArray } from "drizzle-orm";
import { notFound, redirect } from "@runtime/navigation";

import { getProjectBudgetDashboard } from "@backend/app/actions/project/excel-budget";
import { db } from "@backend/db";
import {
  bankAccount,
  approval,
  client,
  clientInvoice,
  clientPayment,
  INSTANCE_TENANT_ID,
  itemPriceLibrary,
  materialInventory,
  materialMaster,
  project,
  projectCategoryPlanItem,
  projectChangeOrder,
  projectBudgetCategory,
  projectBudgets,
  projectCost,
  projectRap,
  projectRapItem,
  projectProfitabilitySnapshot,
  rabEstimate,
  rabEstimateBundle,
  rabEstimateItem,
  stockMovement,
  vendor,
  vendorBill,
  vendorPayment,
} from "@backend/db/schema";
import type { ProjectTabsProps } from "@backend/features/projects/detail/types/project-tabs-types";
import { resolveRoleName } from "@backend/lib/auth/permissions";
import { assertProjectAccess } from "@backend/lib/auth/scoping";
import { requireServerSession } from "@backend/lib/server/session";
import { isProjectManagerOption } from "@backend/server/usecases/project/project-manager-options";
import { redactExpensePaymentBankData } from "@backend/features/expenses/utils/expenses-access";
import {
  mapClientInvoices,
  mapCostsForList,
  mapMaterialMasterCatalog,
  mapPricingTemplateCatalog,
  mapProjectsForForms,
} from "@backend/features/projects/detail/utils/project-detail-mappers";

async function readOperationRows<TRow>(
  allowed: boolean,
  load: () => Promise<TRow[]>,
  label: string,
): Promise<{ readonly rows: TRow[]; readonly source: ProjectOperationSource }> {
  if (!allowed) {
    return {
      rows: [],
      source: { status: "restricted", message: `Anda belum memiliki izin melihat ${label}.` },
    };
  }
  try {
    return { rows: await load(), source: { status: "ready" } };
  } catch {
    return {
      rows: [],
      source: { status: "unavailable", message: `${label} belum dapat dimuat. Coba lagi.` },
    };
  }
}

export async function getProjectDetailData(
  projectId: string,
  forbiddenDestination: "/projects" | "/admin/projects" = "/projects",
): Promise<ProjectTabsProps> {
  const session = await requireServerSession();
  const roleName = (await resolveRoleName(session.user.roleId)) ?? "UNKNOWN";
  const isFinanceOperator = await roleNameHasPermission(roleName, "view:bank_account");
  const canReadRap = await roleNameHasPermission(roleName, "view:rap");
  const canReadRab = await roleNameHasPermission(roleName, "view:rab");
  const canReadStock = await roleNameHasPermission(roleName, "view:inventory");
  const canReadCosts = await roleNameHasPermission(roleName, "view:cost");
  const canReadBills = await roleNameHasPermission(roleName, "view:vendor_bill");
  const canReadInvoices = await roleNameHasPermission(roleName, "view:client_invoice");
  const canReadProfitability = await roleNameHasPermission(roleName, "view:profitability");
  const isPM = (await getRoleDataScopeByName(roleName)) === "ASSIGNED";
  if (!(await roleNameHasPermission(roleName, "view:budget"))) {
    redirect(forbiddenDestination);
  }
  const canCreateProject = await roleNameHasPermission(roleName, "create:project");
  const canEditProject =
    canCreateProject || (await roleNameHasPermission(roleName, "update:budget"));

  try {
    await assertProjectAccess(projectId, session.user.id, roleName);
  } catch {
    redirect(forbiddenDestination);
  }

  const projectData = await db.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)),
    with: {
      client: true,
      projectManager: true,
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
        where: eq(projectRap.tenantId, INSTANCE_TENANT_ID),
        with: {
          items: {
            where: eq(projectRapItem.tenantId, INSTANCE_TENANT_ID),
            with: {
              material: {
                with: {
                  inventory: {
                    where: eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
                    with: { location: { columns: { tenantId: true } } },
                  },
                },
              },
              stockMovements: {
                where: and(
                  eq(stockMovement.tenantId, INSTANCE_TENANT_ID),
                  eq(stockMovement.projectId, projectId),
                ),
              },
            },
          },
        },
      },
      rabEstimates: {
        where: eq(rabEstimate.tenantId, INSTANCE_TENANT_ID),
        with: {
          items: { where: eq(rabEstimateItem.tenantId, INSTANCE_TENANT_ID) },
          bundles: {
            where: eq(rabEstimateBundle.tenantId, INSTANCE_TENANT_ID),
            with: { items: { where: eq(rabEstimateItem.tenantId, INSTANCE_TENANT_ID) } },
          },
          voidedBy: true,
        },
      },
      changeOrders: {
        where: eq(projectChangeOrder.tenantId, INSTANCE_TENANT_ID),
        with: {
          baseRab: {
            with: {
              sourceRap: true,
              items: { where: eq(rabEstimateItem.tenantId, INSTANCE_TENANT_ID) },
            },
          },
          revisedRab: {
            with: {
              sourceRap: true,
              items: { where: eq(rabEstimateItem.tenantId, INSTANCE_TENANT_ID) },
            },
          },
          createdBy: true,
          approvedBy: true,
        },
      },
      categoryPlanItems: {
        where: eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
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

  const projectBudgetDashboardResult = await getProjectBudgetDashboard(projectId).catch(
    (): Awaited<ReturnType<typeof getProjectBudgetDashboard>> => ({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Budget proyek belum dapat dimuat. Coba lagi.",
      },
    }),
  );
  const projectBudgetDashboard = projectBudgetDashboardResult.success
    ? projectBudgetDashboardResult.data
    : null;
  const projectBudgetSource: NonNullable<ProjectTabsProps["projectBudgetSource"]> =
    projectBudgetDashboardResult.success
      ? { status: "ready" }
      : {
          status:
            projectBudgetDashboardResult.error.code === "NOT_FOUND"
              ? "missing"
              : projectBudgetDashboardResult.error.code === "FORBIDDEN" ||
                  projectBudgetDashboardResult.error.code === "UNAUTHORIZED"
                ? "restricted"
                : "unavailable",
          message: projectBudgetDashboardResult.error.message,
        };

  const costCategoriesData = await db.query.projectCostCategory.findMany();
  const bankAccountsData = isFinanceOperator
    ? await db.query.bankAccount.findMany({
        where: and(eq(bankAccount.isActive, true), eq(bankAccount.tenantId, INSTANCE_TENANT_ID)),
      })
    : [];

  const costsResult = await readOperationRows(
    canReadCosts,
    () =>
      db.query.projectCost.findMany({
        where: and(
          eq(projectCost.projectId, projectId),
          eq(projectCost.tenantId, INSTANCE_TENANT_ID),
          isPM ? eq(projectCost.requestedById, session.user.id) : undefined,
        ),
        with: {
          project: true,
          budgetCategory: { with: { expenseCategory: true } },
          budgetItem: {
            with: {
              costCategory: true,
            },
          },
          requestedBy: true,
        },
        orderBy: [desc(projectCost.createdAt)],
      }),
    "pengeluaran lapangan",
  );
  const costsData = costsResult.rows;

  const billsResult = await readOperationRows(
    canReadBills,
    () =>
      db.query.vendorBill.findMany({
        where: and(
          eq(vendorBill.projectId, projectId),
          eq(vendorBill.tenantId, INSTANCE_TENANT_ID),
        ),
        with: {
          project: true,
          vendor: true,
          budgetItem: {
            with: {
              costCategory: true,
            },
          },
          payments: {
            where: eq(vendorPayment.tenantId, INSTANCE_TENANT_ID),
            with: {
              bankAccount: { columns: { name: true, tenantId: true } },
            },
          },
        },
        orderBy: [desc(vendorBill.createdAt)],
      }),
    "tagihan vendor",
  );
  const vendorBillsData = billsResult.rows;

  const projectBillIds = vendorBillsData.map((bill) => bill.id);
  const paymentsResult = await readOperationRows(
    canReadBills,
    async () =>
      projectBillIds.length > 0
        ? await db.query.vendorPayment.findMany({
            where: and(
              inArray(vendorPayment.vendorBillId, projectBillIds),
              eq(vendorPayment.tenantId, INSTANCE_TENANT_ID),
            ),
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
              bankAccount: { columns: { name: true, tenantId: true } },
              paidBy: true,
            },
            orderBy: [desc(vendorPayment.createdAt)],
          })
        : [],
    "pembayaran vendor",
  );
  const vendorPaymentsData = paymentsResult.rows;
  const projectPaymentIds = vendorPaymentsData.map((payment) => payment.id);
  const paymentApprovalsResult = await readOperationRows(
    canReadBills,
    async () =>
      projectPaymentIds.length > 0
        ? db.query.approval.findMany({
            where: and(
              eq(approval.tenantId, INSTANCE_TENANT_ID),
              eq(approval.referenceType, "vendor_payment"),
              inArray(approval.referenceId, projectPaymentIds),
            ),
            orderBy: [desc(approval.createdAt)],
          })
        : [],
    "persetujuan pembayaran vendor",
  );

  const vendorsData =
    canReadBills || canReadRap
      ? await db.query.vendor.findMany({
          where: eq(vendor.tenantId, INSTANCE_TENANT_ID),
          orderBy: [desc(vendor.name)],
        })
      : [];

  const stockResult = await readOperationRows(
    canReadStock,
    () =>
      db.query.stockMovement.findMany({
        where: and(
          eq(stockMovement.projectId, projectId),
          eq(stockMovement.tenantId, INSTANCE_TENANT_ID),
        ),
        with: {
          material: true,
          location: true,
          createdBy: true,
        },
        orderBy: [desc(stockMovement.createdAt)],
      }),
    "aktivitas stok",
  );
  const stockMovementsData = stockResult.rows.filter(
    (movement) =>
      movement.material.tenantId === INSTANCE_TENANT_ID &&
      movement.location.tenantId === INSTANCE_TENANT_ID,
  );

  const pmProjectFilter = isPM ? eq(project.projectManagerId, session.user.id) : undefined;
  const projectsData = await db.query.project.findMany({
    where: and(
      eq(project.status, "ACTIVE"),
      eq(project.tenantId, INSTANCE_TENANT_ID),
      pmProjectFilter,
    ),
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
        where: eq(projectBudgets.tenantId, INSTANCE_TENANT_ID),
        with: {
          categories: {
            where: eq(projectBudgetCategory.tenantId, INSTANCE_TENANT_ID),
            with: {
              expenseCategory: true,
            },
          },
        },
      },
      raps: {
        where: eq(projectRap.tenantId, INSTANCE_TENANT_ID),
        with: {
          items: { where: eq(projectRapItem.tenantId, INSTANCE_TENANT_ID) },
        },
      },
      categoryPlanItems: {
        where: eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
        with: {
          expenseCategory: true,
        },
      },
    },
  });

  const materialOptionsData = await db.query.materialMaster.findMany({
    where: and(eq(materialMaster.isActive, true), eq(materialMaster.tenantId, INSTANCE_TENANT_ID)),
    with: {
      inventory: {
        where: eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
        with: { location: true },
      },
      category: true,
    },
  });

  const safeMaterialCatalog = mapMaterialMasterCatalog(
    materialOptionsData.map((material) => ({
      ...material,
      category: material.category?.tenantId === INSTANCE_TENANT_ID ? material.category : null,
      inventory: material.inventory.filter(
        (inventory) => inventory.location.tenantId === INSTANCE_TENANT_ID,
      ),
    })),
  );
  const materialMasterCatalog = canReadRap ? safeMaterialCatalog : [];

  const latestStockRap =
    projectData.raps.slice().sort((left, right) => right.revision - left.revision)[0] ?? null;
  const projectStockData: ProjectStockData = {
    source:
      !canReadStock || stockResult.source.status !== "ready"
        ? stockResult.source
        : latestStockRap
          ? { status: "ready" }
          : { status: "missing", message: "RAP material belum disiapkan untuk proyek ini." },
    rap:
      canReadStock && stockResult.source.status === "ready" && latestStockRap
        ? {
            id: latestStockRap.id,
            items: latestStockRap.items.map((item) => {
              const material =
                item.material?.tenantId === INSTANCE_TENANT_ID ? item.material : null;
              const movements = stockMovementsData.filter(
                (movement) =>
                  movement.projectRapItemId === item.id && movement.materialId === item.materialId,
              );
              return {
                id: item.id,
                materialId: material?.id ?? null,
                materialName: material?.name ?? item.name,
                name: item.name,
                area: item.area,
                totalQuantity: item.totalQuantity,
                unit: item.unit,
                availableStock:
                  material?.inventory
                    .filter((inventory) => inventory.location.tenantId === INSTANCE_TENANT_ID)
                    .reduce(
                      (sum, inventory) =>
                        sum + Number(inventory.currentStock) - Number(inventory.reservedStock),
                      0,
                    ) ?? 0,
                ...projectMaterialProjection(movements, Number(item.totalQuantity)),
              };
            }),
          }
        : null,
    materials: canReadStock ? safeMaterialCatalog : [],
  };

  const pricingTemplateCatalog = await db.query.itemPriceLibrary.findMany({
    where: and(
      eq(itemPriceLibrary.isActive, true),
      eq(itemPriceLibrary.tenantId, INSTANCE_TENANT_ID),
    ),
    orderBy: (table, { asc }) => [asc(table.itemType), asc(table.name)],
  });

  const projectsForForms = mapProjectsForForms({
    projects: projectsData.map((row) => ({
      ...row,
      canonicalBudgets: row.canonicalBudgets.map((budget) => ({
        ...budget,
        categories: budget.categories.filter(
          (category) => category.expenseCategory.tenantId === INSTANCE_TENANT_ID,
        ),
      })),
      raps: canReadRap ? row.raps : [],
      categoryPlanItems: canReadRap
        ? row.categoryPlanItems.filter(
            (item) => item.expenseCategory.tenantId === INSTANCE_TENANT_ID,
          )
        : [],
    })),
    materialMasterCatalog,
  });
  const costsForList = mapCostsForList(
    costsData.map((cost) => ({
      id: cost.id,
      amount: cost.amount,
      description: cost.description,
      receiptImageUrl: cost.receiptImageUrl,
      status: cost.status,
      budgetOverrun: cost.budgetOverrun,
      createdAt: cost.createdAt,
      project:
        cost.project?.tenantId === INSTANCE_TENANT_ID
          ? { id: cost.project.id, name: cost.project.name }
          : null,
      budgetCategory:
        cost.budgetCategory?.tenantId === INSTANCE_TENANT_ID &&
        cost.budgetCategory.expenseCategory.tenantId === INSTANCE_TENANT_ID
          ? {
              id: cost.budgetCategory.id,
              expenseCategory: {
                code: cost.budgetCategory.expenseCategory.code,
                name: cost.budgetCategory.expenseCategory.name,
              },
            }
          : null,
      budgetItem: cost.budgetItem?.tenantId === INSTANCE_TENANT_ID ? cost.budgetItem : null,
      requestedBy: cost.requestedBy ? { name: cost.requestedBy.name } : null,
      projectRapItemId: cost.projectRapItemId,
    })),
  );
  const paymentApproval = (paymentId: string): string =>
    paymentApprovalsResult.rows.find((record) => record.referenceId === paymentId)?.status ??
    "APPROVED";
  const paymentsForList: ProjectTabsProps["vendorPayments"] = vendorPaymentsData.map((payment) =>
    redactExpensePaymentBankData(
      {
        id: payment.id,
        vendorBillId: payment.vendorBillId,
        bankAccountId: payment.bankAccountId,
        amountPaid: payment.amountPaid,
        status: payment.status,
        paymentDate: payment.paymentDate,
        referenceNumber: payment.referenceNumber,
        approvalStatus: paymentApproval(payment.id),
        bankAccount: payment.bankAccount,
        vendorBill: payment.vendorBill
          ? {
              billNumber: payment.vendorBill.billNumber,
              vendor:
                payment.vendorBill.vendor?.tenantId === INSTANCE_TENANT_ID
                  ? { name: payment.vendorBill.vendor.name }
                  : null,
              project:
                payment.vendorBill.project?.tenantId === INSTANCE_TENANT_ID
                  ? { name: payment.vendorBill.project.name }
                  : null,
            }
          : null,
      },
      isFinanceOperator && payment.bankAccount?.tenantId === INSTANCE_TENANT_ID,
    ),
  );
  const billsForList: ProjectTabsProps["vendorBills"] = vendorBillsData.map((bill) => ({
    id: bill.id,
    vendorId: bill.vendor?.tenantId === INSTANCE_TENANT_ID ? bill.vendorId : "",
    projectId: bill.projectId,
    projectBudgetItemId:
      bill.budgetItem?.tenantId === INSTANCE_TENANT_ID ? bill.projectBudgetItemId : null,
    projectBudgetCategoryId: bill.projectBudgetCategoryId,
    billNumber: bill.billNumber,
    amount: bill.amount,
    status: bill.status,
    dueDate: bill.dueDate,
    notes: bill.notes,
    vendor: bill.vendor?.tenantId === INSTANCE_TENANT_ID ? { name: bill.vendor.name } : null,
    project: bill.project?.tenantId === INSTANCE_TENANT_ID ? { name: bill.project.name } : null,
    budgetItem:
      bill.budgetItem?.tenantId === INSTANCE_TENANT_ID ? { name: bill.budgetItem.name } : null,
    payments: bill.payments.map((payment) =>
      redactExpensePaymentBankData(
        {
          id: payment.id,
          vendorBillId: payment.vendorBillId,
          bankAccountId: payment.bankAccountId,
          amountPaid: payment.amountPaid,
          status: payment.status,
          paymentDate: payment.paymentDate,
          referenceNumber: payment.referenceNumber,
          approvalStatus: paymentApproval(payment.id),
          bankAccount: payment.bankAccount,
        },
        isFinanceOperator && payment.bankAccount?.tenantId === INSTANCE_TENANT_ID,
      ),
    ),
  }));
  const invoicesResult = await readOperationRows(
    canReadInvoices,
    async () => {
      const invoices = await db.query.clientInvoice.findMany({
        where: and(
          eq(clientInvoice.projectId, projectId),
          eq(clientInvoice.tenantId, INSTANCE_TENANT_ID),
        ),
        with: { payments: { where: eq(clientPayment.tenantId, INSTANCE_TENANT_ID) } },
        orderBy: [desc(clientInvoice.createdAt)],
      });
      return mapClientInvoices(
        invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          status: invoice.status,
          dueDate: invoice.dueDate,
          createdAt: invoice.createdAt,
          stage: invoice.stage,
          payments: invoice.payments.map((payment) => ({
            id: payment.id,
            amountPaid: payment.amountPaid,
            paymentDate: payment.paymentDate,
            referenceNumber: payment.referenceNumber,
          })),
        })),
      );
    },
    "tagihan dan penerimaan klien",
  );

  const marginSource: ProjectOperationSource = canReadProfitability
    ? projectBudgetSource
    : { status: "restricted", message: "Anda belum memiliki izin melihat margin proyek." };
  const marginCashSource: ProjectOperationSource =
    marginSource.status !== "ready" ? marginSource : invoicesResult.source;
  const finalSnapshots = await readOperationRows(
    canReadProfitability,
    () =>
      db.query.projectProfitabilitySnapshot.findMany({
        columns: {
          id: true,
          snapshotAt: true,
          contractValue: true,
          internalBudget: true,
          actualCost: true,
          remainingBudget: true,
          targetGrossAmount: true,
          targetGrossPercentage: true,
          realizedMarginAmount: true,
          realizedMarginPercentage: true,
          cashPosition: true,
        },
        where: and(
          eq(projectProfitabilitySnapshot.projectId, projectId),
          eq(projectProfitabilitySnapshot.tenantId, INSTANCE_TENANT_ID),
          eq(projectProfitabilitySnapshot.snapshotType, "FINAL"),
        ),
        orderBy: [
          desc(projectProfitabilitySnapshot.snapshotAt),
          desc(projectProfitabilitySnapshot.id),
        ],
        limit: 1,
      }),
    "ringkasan margin akhir",
  );
  const projectMarginData: ProjectMarginData = {
    source: marginSource,
    cashSource: marginCashSource,
    cash:
      marginCashSource.status === "ready" && projectBudgetDashboard
        ? projectMarginCash(invoicesResult.rows, projectBudgetDashboard.paidCost)
        : null,
    finalSnapshotSource:
      finalSnapshots.source.status === "ready" && finalSnapshots.rows.length === 0
        ? { status: "missing", message: "Ringkasan margin akhir belum tersimpan." }
        : finalSnapshots.source,
    finalSnapshot: finalSnapshots.rows[0] ?? null,
  };

  const [clientsData, usersData] = await Promise.all([
    canEditProject
      ? db.query.client.findMany({
          columns: { id: true, name: true },
          where: eq(client.tenantId, INSTANCE_TENANT_ID),
          orderBy: (table, { asc }) => [asc(table.name)],
        })
      : Promise.resolve([]),
    canEditProject
      ? db.query.user.findMany({
          columns: { id: true, isActive: true, name: true, email: true },
          with: { role: { columns: { name: true, dataScope: true } } },
          orderBy: (table, { asc }) => [asc(table.name)],
        })
      : Promise.resolve([]),
  ]);

  const projectManagers = usersData
    .filter((candidate) => isProjectManagerOption(candidate, [projectData.projectManagerId]))
    .map(({ id, name, email }) => ({ id, name, email }));

  return {
    project: {
      id: projectData.id,
      name: projectData.name,
      clientId: projectData.clientId,
      projectManagerId: projectData.projectManagerId,
      totalContractValue: projectData.totalContractValue,
      financialHealth: projectData.financialHealth,
      location: projectData.location,
      roomArea: projectData.roomArea,
      projectType: projectData.projectType,
      coverImageUrl: projectData.coverImageUrl,
      startDate: projectData.startDate,
      endDate: projectData.endDate,
      notes: projectData.notes,
      status: projectData.status,
      createdAt: projectData.createdAt,
      client: projectData.client?.tenantId === INSTANCE_TENANT_ID ? projectData.client : null,
      projectManager: projectData.projectManager
        ? { name: projectData.projectManager.name, email: projectData.projectManager.email }
        : null,
      budget: projectData.budget?.tenantId === INSTANCE_TENANT_ID ? projectData.budget : null,
      raps: canReadRap
        ? projectData.raps.map((rap) => ({
            ...rap,
            items: rap.items.map((item) => ({
              ...item,
              material:
                item.material?.tenantId === INSTANCE_TENANT_ID
                  ? {
                      ...item.material,
                      inventory: item.material.inventory.filter(
                        (inventory) => inventory.location.tenantId === INSTANCE_TENANT_ID,
                      ),
                    }
                  : null,
            })),
          }))
        : [],
      rabEstimates: canReadRab
        ? projectData.rabEstimates.map((estimate) => ({
            ...estimate,
            bundles: estimate.bundles.map((bundle) => ({
              ...bundle,
              items: bundle.items.filter((item) => item.rabEstimateId === estimate.id),
            })),
          }))
        : [],
      categoryPlanItems: canReadRap
        ? projectData.categoryPlanItems
            .filter((item) => item.expenseCategory.tenantId === INSTANCE_TENANT_ID)
            .map((item) => ({
              ...item,
              vendor: item.vendor?.tenantId === INSTANCE_TENANT_ID ? item.vendor : null,
            }))
        : [],
      changeOrders: canReadRab
        ? projectData.changeOrders
            .filter(
              (order) =>
                order.baseRab.tenantId === INSTANCE_TENANT_ID &&
                order.baseRab.projectId === projectId &&
                order.revisedRab.tenantId === INSTANCE_TENANT_ID &&
                order.revisedRab.projectId === projectId,
            )
            .map((order) => ({
              ...order,
              baseRab: {
                ...order.baseRab,
                sourceRap:
                  canReadRap && order.baseRab.sourceRap?.tenantId === INSTANCE_TENANT_ID
                    ? order.baseRab.sourceRap
                    : null,
              },
              revisedRab: {
                ...order.revisedRab,
                sourceRap:
                  canReadRap && order.revisedRab.sourceRap?.tenantId === INSTANCE_TENANT_ID
                    ? order.revisedRab.sourceRap
                    : null,
              },
            }))
        : [],
    },
    costCategories: costCategoriesData,
    userRole: roleName,
    vendorPaymentApprovalThreshold: thresholdCentsToRupiah(
      (await getApprovalThresholds()).vendorPaymentCents,
    ),
    userId: session.user.id,
    bankAccounts: bankAccountsData,
    costs: costsForList,
    vendorBills: billsForList,
    vendorPayments: paymentsForList,
    vendors: vendorsData.map((entry) => ({ id: entry.id, name: entry.name })),
    projectsForForms,
    stockMovements: stockMovementsData.map((movement) => ({
      id: movement.id,
      movementType: movement.movementType,
      quantity: movement.quantity,
      unitCost: movement.unitCost,
      note: movement.note,
      createdAt: movement.createdAt,
      material: { name: movement.material.name, unit: movement.material.unit },
      location: { name: movement.location.name },
      createdBy: { name: movement.createdBy.name },
    })),
    projectStockData,
    projectExpensesSource: {
      costs: costsResult.source,
      vendorBills: [billsResult.source, paymentsResult.source, paymentApprovalsResult.source].find(
        (source) => source.status !== "ready",
      ) ?? { status: "ready" },
    },
    invoices: invoicesResult.rows,
    projectInvoicesSource: invoicesResult.source,
    projectMarginData,
    projectBudgetDashboard,
    projectBudgetSource,
    materialMasterCatalog,
    pricingTemplateCatalog: canReadRap ? mapPricingTemplateCatalog(pricingTemplateCatalog) : [],
    clients: canCreateProject
      ? clientsData
      : clientsData.filter((candidate) => candidate.id === projectData.clientId),
    projectManagers,
  };
}
