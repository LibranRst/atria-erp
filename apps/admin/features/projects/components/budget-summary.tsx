import { MoneyValue, StatusChip, Table } from "@/components/ui";
import type { ProjectBudget } from "../types";

export function BudgetSummary({ budget }: { readonly budget: ProjectBudget }): React.JSX.Element {
  return (
    <div className="space-y-6">
      <section aria-label="Posisi budget proyek" className="rounded-xl bg-surface p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Posisi budget</h2>
          <StatusChip status={budget.status} />
        </div>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Nilai kontrak", amount: budget.contractValue },
            { label: "Budget internal", amount: budget.internalBudget },
            { label: "Terpakai", amount: budget.actualCost },
            { label: "Dibayar", amount: budget.paidCost },
            { label: "Sisa budget", amount: budget.remainingBudget },
            { label: "Proyeksi margin", amount: budget.projectedMarginAmount },
          ].map((metric) => (
            <div key={metric.label}>
              <dt className="mb-1 text-xs text-muted">{metric.label}</dt>
              <dd className="font-semibold">
                <MoneyValue compact amount={metric.amount} />
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-xs text-muted">
          <span>
            Menunggu review <MoneyValue amount={budget.pendingCost} />
          </span>
          <span>
            RAB disetujui <MoneyValue amount={budget.approvedRabValue} />
          </span>
          <span>
            Penggunaan {budget.usedPercentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
            %
          </span>
          <span>
            Margin{" "}
            {budget.projectedMarginPercentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
            % · target{" "}
            {budget.targetGrossPercentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
          </span>
        </div>
      </section>
      <section className="space-y-3" aria-labelledby="category-title">
        <h2 id="category-title" className="font-semibold">
          Penggunaan kategori
        </h2>
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Alokasi dan penggunaan kategori budget"
              className="min-w-[760px]"
            >
              <Table.Header>
                <Table.Column isRowHeader>Kategori</Table.Column>
                <Table.Column>Alokasi</Table.Column>
                <Table.Column>Menunggu review</Table.Column>
                <Table.Column>Terpakai</Table.Column>
                <Table.Column>Dibayar</Table.Column>
                <Table.Column>Sisa</Table.Column>
                <Table.Column>Penggunaan</Table.Column>
                <Table.Column>Status</Table.Column>
              </Table.Header>
              <Table.Body
                items={budget.categories}
                renderEmptyState={() => (
                  <p className="py-8 text-center text-sm text-muted">
                    Kategori budget belum tersedia.
                  </p>
                )}
              >
                {(category) => (
                  <Table.Row id={category.id} textValue={category.name}>
                    <Table.Cell>{category.name}</Table.Cell>
                    <Table.Cell>
                      <MoneyValue amount={category.allocatedAmount} compact />
                    </Table.Cell>
                    <Table.Cell>
                      <MoneyValue amount={category.pendingAmount} compact />
                    </Table.Cell>
                    <Table.Cell>
                      <MoneyValue amount={category.actualAmount} compact />
                    </Table.Cell>
                    <Table.Cell>
                      <MoneyValue amount={category.paidAmount} compact />
                    </Table.Cell>
                    <Table.Cell>
                      <MoneyValue
                        amount={category.remainingAmount}
                        compact
                        className={category.remainingAmount < 0 ? "text-danger" : ""}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <span className="tabular-nums">
                        {category.usedPercentage.toLocaleString("id-ID", {
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusChip status={category.status} />
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>
    </div>
  );
}
