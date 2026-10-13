"use client";
import * as React from "react";
import { FactRow, FormDisclosure, MoneyValue } from "@/components/ui";
import { ProposalDiffRow } from "./proposal-card-shell";
export type InlineProposalFact = {
  readonly label: string;
  readonly value: string | number;
  readonly money?: boolean;
};
export type InlineProposalComparison = {
  readonly label: string;
  readonly before: string | number;
  readonly after: string | number;
  readonly money?: boolean;
  readonly layout?: "inline" | "stacked" | "vertical";
};
export function inlineProposalValue(
  value: string | number,
  money = false,
  preciseMoney = false,
): React.ReactNode {
  return money && typeof value === "number" ? (
    <MoneyValue
      amount={value}
      variant="fullDynamic"
      size="sm"
      align="right"
      fractionDigits={preciseMoney && !Number.isInteger(value) ? 2 : 0}
    />
  ) : typeof value === "number" ? (
    value.toLocaleString("id-ID", { maximumFractionDigits: 2 })
  ) : (
    value
  );
}
/** AI-specific composition; shared primitives retain disclosure, money, motion and focus ownership. */
export function ProposalInlineReview({
  facts = [],
  comparisons = [],
  children,
  details,
  disclosure,
  preciseMoney = false,
}: {
  readonly facts?: readonly InlineProposalFact[];
  readonly comparisons?: readonly InlineProposalComparison[];
  readonly children?: React.ReactNode;
  readonly details?: React.ReactNode;
  readonly disclosure?: React.ReactNode;
  readonly preciseMoney?: boolean;
}): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div
      data-proposal-inline-review
      className="space-y-2 border-t border-outline-variant/20 px-4 py-3"
    >
      {children}
      <div className="divide-y divide-outline-variant/20">
        {comparisons.map((c, index) => (
          <ProposalDiffRow
            key={`${c.label}-${index}`}
            label={c.label}
            before={inlineProposalValue(c.before, c.money, preciseMoney)}
            after={inlineProposalValue(c.after, c.money, preciseMoney)}
            layout={c.layout ?? "inline"}
            inset={false}
            strikeBefore={false}
          />
        ))}
        {facts.map((f, index) => (
          <FactRow
            key={`${f.label}-${index}`}
            label={f.label}
            wrapLabel
            inset={false}
            value={inlineProposalValue(f.value, f.money, preciseMoney)}
          />
        ))}
      </div>
      {details ? (
        <FormDisclosure
          variant="plain"
          title="Rincian"
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        >
          {details}
        </FormDisclosure>
      ) : (
        (disclosure ?? null)
      )}
    </div>
  );
}
/** Keep factual before/after pairs together; unchanged reference pairs belong in disclosure. */
export function inlineFactChanges(
  facts: readonly InlineProposalFact[],
  keepPairs: readonly string[] = [],
): { facts: InlineProposalFact[]; comparisons: InlineProposalComparison[] } {
  const result: { facts: InlineProposalFact[]; comparisons: InlineProposalComparison[] } = {
    facts: [],
    comparisons: [],
  };
  for (const fact of facts) {
    if (fact.label.endsWith(" · sesudah")) continue;
    if (fact.label.endsWith(" · sebelumnya")) {
      const label = fact.label.replace(" · sebelumnya", "");
      const after = facts.find((f) => f.label === `${label} · sesudah`);
      if (after && (fact.value !== after.value || keepPairs.includes(label)))
        result.comparisons.push({
          label,
          before: fact.value,
          after: after.value,
          money: fact.money || after.money,
        });
    } else result.facts.push(fact);
  }
  return result;
}
