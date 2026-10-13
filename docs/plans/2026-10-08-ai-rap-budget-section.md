# RAP budget section: decision-first grouped facts

The user rejected the inset metric-box budget section and invoked Grilling to audit neighboring sheets before choosing its redesign. All frontier decisions were explicitly approved: decision first, grouped white rows, two visible financial facts.

## Benchmark

Read-only source audit of category detail, budget defaults review, expense review and material operation review; category Material sheet also inspected in dev @Browser at716px. Category detail uses white divided rows with labels left and amounts right. Budget defaults use public FormSection/FactRow. Expense and material operations expose an operation's result before secondary context. Current RAP component's deterministic scan returned no findings; that does not establish visual quality.

The existing warning compares `afterPlan` (existing RAP plus addition) with Material allocation. Current headline addition-versus-allocation does not expose the amount driving that warning when an existing RAP exists. Financial remaining is allocated minus actual spending; proposed plans do not consume it.

## Approved design and implementation

- One shared GroupedSurface owns the section. Status with icon and concise planning-specific Indonesian copy leads the reading order. Over-allocation names the exceeded amount.
- Two public FactRow comparisons show RAP after proposal and Material allocation, with fullDynamic MoneyValue. No nested gray metric box. Labels can wrap in the narrow desktop aside while monetary values retain a readable exact value.
- Plain FormDisclosure contains existing RAP, proposal addition, actual/pending spending and financial remaining. Describe planning separately from realization. No before→after cash or stock effect is implied.
- Keep existing draft/permission/calculation/operation contracts, material editor, pagination, Apply/Save and sheet geometry unchanged.

Verify dev @Browser mobile320/360/390/430 and intermediate716, desktop1024/1280/1440; over-allocation and in-allocation proposals, expanded disclosure and dirty recalculation. Avoid business saves. Run scoped shared UI/consent tests, type/style/format/lint gates; document the shipped composition and refresh the graph.

## Delivered

Implemented the approved decision-first public GroupedSurface + FactRow + MoneyValue composition, with one plain disclosure. FactRow's additive wrapLabel option supports the224px desktop aside while preserving default consumers. Two literal legacy shared captions now use the existing Support role. The RAP consent fixture now includes an existing RAP and asserts the visible total after proposal and exceeded amount; Apply remains separate from Save.

Dev @Browser verified all eight widths with no document overflow, over-allocation and within-allocation states, expanded details at320px, and local correction recalculation with Save disabled before Apply. Temporary quantity edits were restored; no business Save. Evidence: output/ai-chat-qa/rap-budget/.

Scoped tests18passed, web types/build, workspace lint, shared styles check and changed-file formatting passed. Existing unrelated Material Master effect-dependency lint warning remains. Fresh Impeccable review: ship, no material findings. Root design rule/sidecar and existing RAP surface brief updated from the shipped component; graph refreshed after documentation.
