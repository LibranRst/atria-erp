import { FormSection } from "@/components/ui";
import type { ProjectBudgetCategoryOption } from "@/features/expenses/types/expense-form-types";

interface ExpenseCategorySummary {
  readonly category: ProjectBudgetCategoryOption;
  readonly amount: number;
}

interface ExpenseFormReviewProps {
  readonly projectName: string;
  readonly documentName: string;
  readonly stockHandlingLabels: readonly string[];
  readonly categorySummaries: readonly ExpenseCategorySummary[];
}

export function ExpenseFormReview({
  projectName,
  documentName,
  stockHandlingLabels,
  categorySummaries,
}: ExpenseFormReviewProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <FormSection
        title="Ringkasan pengeluaran"
        helper="Periksa kembali proyek, dokumen, dan perlakuan stok sebelum mengajukan."
      >
        <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
          <ReviewFact label="Proyek" value={projectName} />
          <ReviewFact label="Dokumen" value={documentName} />
          <ReviewFact
            label="Perubahan Stok"
            value={
              stockHandlingLabels.length === 0
                ? "Tidak ada perubahan stok"
                : stockHandlingLabels.join(" · ")
            }
          />
          <ReviewFact
            label="Langkah Berikutnya"
            value="Finance memverifikasi, lalu approval mengikuti aturan budget proyek."
          />
        </div>
      </FormSection>

      {categorySummaries.length > 0 ? (
        <FormSection
          title="Dampak Budget"
          helper="Kondisi overbudget akan mengharuskan persetujuan khusus Owner."
        >
          <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
            {categorySummaries.map(({ category, amount }) => {
              const before = Number(category.remainingAmount);
              const after = before - amount;
              return (
                <div key={category.id} className="px-4 py-3 text-xs">
                  <div className="flex items-center justify-between gap-3 font-semibold">
                    <span className="text-on-surface">{category.name}</span>
                    <span className="font-bold text-primary tabular-nums">
                      Rp {amount.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <p
                    className={`mt-1 text-[11px] font-medium ${after < 0 ? "font-bold text-error" : "text-on-surface-variant"}`}
                  >
                    Sisa: Rp {before.toLocaleString("id-ID")} → Rp {after.toLocaleString("id-ID")}
                  </p>
                </div>
              );
            })}
          </div>
        </FormSection>
      ) : null}
    </div>
  );
}

function ReviewFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
