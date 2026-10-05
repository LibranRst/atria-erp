import type { DashboardPageTab } from "@atria/core/finance/dashboard-overview";
import { createContext, useContext, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import { theme } from "@/theme";

const SkeletonFontScale = createContext(1);
const SkeletonScaleOverride = createContext<number | undefined>(undefined);

/** A constrained canvas can preview Dynamic Type without changing device settings. */
export function SkeletonScaleProvider({
  value,
  children,
}: {
  readonly value: number;
  readonly children: ReactNode;
}): React.JSX.Element {
  const scale = Number.isFinite(value) ? Math.max(1, value) : 1;
  return (
    <SkeletonScaleOverride.Provider value={scale}>
      <SkeletonFontScale.Provider value={scale}>{children}</SkeletonFontScale.Provider>
    </SkeletonScaleOverride.Provider>
  );
}

/** Decorative geometry only. Its owning page or native sheet owns scrolling. */
export function SkeletonBlock({
  width = "100%",
  height = 16,
  radius = theme.radii.capsule,
  inverse = false,
  style,
}: {
  readonly width?: DimensionValue;
  readonly height?: number;
  readonly radius?: number;
  readonly inverse?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const fontScale = useContext(SkeletonFontScale);
  const textHeight = radius === theme.radii.capsule && height > 8 && height <= 36;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { width, height: textHeight ? height * fontScale : height, borderRadius: radius },
        inverse && styles.inverseBlock,
        style,
      ]}
    />
  );
}

export function SkeletonBusy({
  children,
  label = "Memuat data",
  gap = theme.spacing.md,
}: {
  readonly children: ReactNode;
  readonly label?: string;
  readonly gap?: number;
}): React.JSX.Element {
  const { fontScale } = useWindowDimensions();
  const override = useContext(SkeletonScaleOverride);
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={[styles.stack, { gap }]}
    >
      <SkeletonFontScale.Provider value={Math.max(1, override ?? fontScale)}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.stack, { gap }]}
        >
          {children}
        </View>
      </SkeletonFontScale.Provider>
    </View>
  );
}

function SkeletonFacts({
  count = 3,
  inset = false,
  inverse = false,
}: {
  readonly count?: number;
  readonly inset?: boolean;
  readonly inverse?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.metrics}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[styles.metric, inset && styles.inset, inverse && styles.inverseInset]}
        >
          <SkeletonBlock width="72%" height={10} inverse={inverse} />
          <SkeletonBlock width="90%" height={19} inverse={inverse} />
        </View>
      ))}
    </View>
  );
}

function SkeletonSummary({
  kind = "comparison",
}: {
  readonly kind?:
    | "cash"
    | "comparison"
    | "queue"
    | "account"
    | "material"
    | "legacy"
    | "expense"
    | "pending"
    | "due"
    | "approval";
}): React.JSX.Element {
  const inverse = kind === "cash";
  return (
    <View style={[styles.summary, inverse && styles.inverseSummary]}>
      {kind === "legacy" || kind === "expense" || kind === "pending" || inverse ? (
        <SkeletonBlock width="44%" height={12} inverse={inverse} />
      ) : (
        <View style={styles.heading}>
          <View style={styles.identity}>
            <SkeletonBlock width={28} height={28} radius={theme.radii.icon} />
            <SkeletonBlock width={128} height={12} />
          </View>
          <SkeletonBlock width={76} height={24} />
        </View>
      )}
      {kind === "approval" ? (
        <>
          <SkeletonBlock width="85%" height={20} />
          <SkeletonBlock width="58%" height={12} />
          <SkeletonBlock width="38%" height={12} />
          <SkeletonBlock width="76%" height={36} />
          <SkeletonBlock width="86%" height={12} />
        </>
      ) : kind === "queue" ? (
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <SkeletonBlock width="38%" height={36} />
            <SkeletonBlock width="90%" height={12} />
          </View>
          <View style={[styles.metric, styles.queueAmount]}>
            <SkeletonBlock width="70%" height={10} />
            <SkeletonBlock width="100%" height={22} />
          </View>
        </View>
      ) : inverse ||
        kind === "account" ||
        kind === "legacy" ||
        kind === "expense" ||
        kind === "pending" ? (
        <SkeletonBlock width="76%" height={36} inverse={inverse} />
      ) : (
        <SkeletonFacts count={2} />
      )}
      {kind === "legacy" || kind === "expense" || kind === "pending" ? (
        <SkeletonBlock width="44%" height={10} />
      ) : null}
      {inverse ? <SkeletonFacts inset inverse /> : null}
      {kind === "comparison" || kind === "material" || inverse ? (
        <View
          style={[styles.budget, inverse && styles.inverseBudget, inverse && styles.inverseInset]}
        >
          {inverse || kind === "material" ? (
            <View style={styles.heading}>
              <SkeletonBlock width="48%" height={11} inverse={inverse} />
              <SkeletonBlock width="30%" height={11} inverse={inverse} />
            </View>
          ) : null}
          {kind === "material" ? <SkeletonBlock width="38%" height={11} /> : null}
          {inverse ? (
            <View style={styles.heading}>
              <SkeletonBlock width="22%" height={19} inverse />
              <SkeletonBlock width="42%" height={19} inverse />
            </View>
          ) : null}
          <SkeletonBlock height={8} inverse={inverse} />
          <View style={styles.heading}>
            <SkeletonBlock width="40%" height={11} inverse={inverse} />
            <SkeletonBlock width="45%" height={11} inverse={inverse} />
          </View>
          {inverse ? (
            <View style={styles.heading}>
              <SkeletonBlock width="25%" height={11} inverse />
              <SkeletonBlock width="44%" height={11} inverse />
            </View>
          ) : null}
        </View>
      ) : null}
      {kind === "expense" || kind === "pending" ? (
        <SkeletonRows count={kind === "pending" ? 1 : 2} kind="fact" />
      ) : kind === "material" ? (
        <View style={styles.heading}>
          <SkeletonBlock width="56%" height={12} />
          <SkeletonBlock width="28%" height={24} />
        </View>
      ) : !inverse && kind !== "approval" ? (
        <SkeletonFacts
          count={kind === "queue" || kind === "comparison" || kind === "legacy" ? 2 : 3}
          inset
        />
      ) : null}
      {kind === "due" ? (
        <View style={styles.copy}>
          <SkeletonBlock width="96%" height={12} />
          <SkeletonBlock width="72%" height={12} />
        </View>
      ) : null}
    </View>
  );
}

type RowKind =
  | "list"
  | "project"
  | "risk"
  | "category"
  | "due"
  | "material"
  | "approval"
  | "approval-list"
  | "field"
  | "fact";

function SkeletonRow({
  kind,
  divided = false,
}: {
  readonly kind: RowKind;
  readonly divided?: boolean;
}): React.JSX.Element {
  const field = kind === "field";
  const fact = kind === "fact";
  return (
    <View
      style={[styles.row, divided && styles.divider, field && styles.field, fact && styles.fact]}
    >
      {field ? (
        <>
          <SkeletonBlock width="34%" height={12} />
          <SkeletonBlock width="72%" height={20} />
        </>
      ) : (
        <>
          <View style={styles.heading}>
            {!fact && kind !== "category" && kind !== "project" && kind !== "approval-list" ? (
              <SkeletonBlock width={36} height={36} radius={theme.radii.icon} />
            ) : null}
            <View style={styles.copy}>
              {kind === "approval" ? <SkeletonBlock width="76%" height={22} /> : null}
              {kind === "material" ? <SkeletonBlock width="44%" height={11} /> : null}
              <SkeletonBlock width={fact ? "70%" : "82%"} height={15} />
              {!fact ? <SkeletonBlock width="68%" height={11} /> : null}
              {kind === "approval-list" ? <SkeletonBlock width="84%" height={11} /> : null}
              {kind === "project" ? <SkeletonBlock width="40%" height={20} /> : null}
            </View>
            <View style={styles.rowValue}>
              <SkeletonBlock width="100%" height={18} />
              {!fact ? <SkeletonBlock width="64%" height={10} /> : null}
            </View>
          </View>
          {kind === "risk" ? <SkeletonFacts count={2} inset /> : null}
          {kind === "approval" || kind === "material" ? (
            <SkeletonBlock width="62%" height={11} />
          ) : null}
          {kind === "risk" || kind === "category" ? (
            <View style={styles.heading}>
              <SkeletonBlock width="32%" height={11} />
              <SkeletonBlock width="40%" height={11} />
            </View>
          ) : null}
          {kind === "category" ? <SkeletonBlock height={6} /> : null}
        </>
      )}
    </View>
  );
}

function SkeletonRows({
  count = 3,
  kind = "list",
}: {
  readonly count?: number;
  readonly kind?: RowKind;
}): React.JSX.Element {
  return (
    <View style={styles.group}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonRow key={index} kind={kind} divided={index > 0} />
      ))}
    </View>
  );
}

export function SkeletonSection({
  children,
  action = true,
  compact = false,
}: {
  readonly children: ReactNode;
  readonly action?: boolean;
  readonly compact?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.section, compact && styles.compactSection]}>
      <View style={[styles.sectionHeader, compact && styles.compactHeader]}>
        <SkeletonBlock width="46%" height={18} />
        {action ? <SkeletonBlock width="23%" height={12} /> : null}
      </View>
      {children}
    </View>
  );
}

/** Only render this in the actual floating-footer slot, never in body geometry. */
export function SkeletonFooter(): React.JSX.Element {
  return <SkeletonBlock height={52} />;
}

export function DashboardBodySkeleton({
  tab,
}: {
  readonly tab: DashboardPageTab;
}): React.JSX.Element {
  return (
    <SkeletonBusy label="Memuat Dashboard" gap={theme.spacing.sm}>
      <SkeletonSummary
        kind={
          tab === "overview"
            ? "cash"
            : tab === "approvals"
              ? "queue"
              : tab === "accounts"
                ? "account"
                : tab === "materials"
                  ? "material"
                  : tab === "cash"
                    ? "due"
                    : "comparison"
        }
      />
      {tab === "overview" ? (
        <>
          <SkeletonSection>
            <SkeletonRows count={2} />
          </SkeletonSection>
          <SkeletonSection>
            <SkeletonRows count={2} kind="risk" />
          </SkeletonSection>
          <SkeletonSection>
            <SkeletonRows kind="due" />
          </SkeletonSection>
          <SkeletonSection>
            <SkeletonRows count={2} kind="material" />
          </SkeletonSection>
          <SkeletonSection>
            <SkeletonRows />
          </SkeletonSection>
        </>
      ) : tab === "budget" ? (
        <>
          <SkeletonSection>
            <SkeletonRows count={2} kind="risk" />
          </SkeletonSection>
          <SkeletonSection>
            <SkeletonBlock width="80%" height={12} />
            <SkeletonRows count={5} kind="category" />
          </SkeletonSection>
        </>
      ) : tab === "cash" ? (
        <>
          <SkeletonSection action={false}>
            <SkeletonRows count={2} kind="due" />
          </SkeletonSection>
          <SkeletonSection action={false}>
            <SkeletonRows count={2} kind="due" />
          </SkeletonSection>
        </>
      ) : tab === "approvals" ? (
        <SkeletonSection>
          <SkeletonBlock width="84%" height={12} />
          <SkeletonRows kind="approval" />
        </SkeletonSection>
      ) : tab === "accounts" ? (
        <SkeletonSection>
          <SkeletonBlock width="85%" height={12} />
          <AccountIdentitySkeleton interactive />
          <AccountIdentitySkeleton interactive />
        </SkeletonSection>
      ) : (
        <>
          <SkeletonSection>
            <SkeletonRows count={2} kind="material" />
          </SkeletonSection>
          <SkeletonSection>
            <SkeletonRows count={2} kind="material" />
          </SkeletonSection>
        </>
      )}
    </SkeletonBusy>
  );
}

function AccountIdentitySkeleton({
  interactive = false,
}: {
  readonly interactive?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.account}>
      <View style={styles.heading}>
        <SkeletonBlock width={40} height={40} radius={theme.radii.icon} />
        <View style={styles.copy}>
          <SkeletonBlock width="68%" height={18} />
          <SkeletonBlock width="42%" height={11} />
        </View>
        <SkeletonBlock width={28} height={28} radius={theme.radii.icon} />
      </View>
      <SkeletonBlock width="38%" height={12} />
      <SkeletonBlock width="70%" height={30} />
      <View style={styles.heading}>
        <SkeletonBlock width="30%" height={11} />
        <SkeletonBlock width="40%" height={11} />
      </View>
      {interactive ? (
        <View style={styles.inset}>
          <SkeletonBlock width="80%" height={14} />
        </View>
      ) : null}
    </View>
  );
}

export function ProjectListSkeleton({
  canCreate = false,
}: {
  readonly canCreate?: boolean;
}): React.JSX.Element {
  return (
    <SkeletonBusy label="Memuat proyek">
      <SkeletonSummary kind="legacy" />
      <SkeletonRows count={2} kind="fact" />
      {canCreate ? <SkeletonBlock height={52} /> : null}
      <SkeletonBlock height={48} />
      <SkeletonBlock height={48} />
      {Array.from({ length: 3 }, (_, index) => (
        <View key={index} style={styles.group}>
          <SkeletonRow kind="project" />
        </View>
      ))}
    </SkeletonBusy>
  );
}

export function ExpenseListSkeleton({
  canCreate = false,
  hasDraft = false,
}: {
  readonly canCreate?: boolean;
  readonly hasDraft?: boolean;
}): React.JSX.Element {
  return (
    <SkeletonBusy label="Memuat biaya" gap={theme.spacing.lg}>
      <SkeletonSummary kind="expense" />
      {hasDraft ? (
        <View style={[styles.group, styles.recovery]}>
          <View style={styles.heading}>
            <SkeletonBlock width={32} height={32} radius={theme.radii.icon} />
            <View style={styles.copy}>
              <SkeletonBlock width="68%" height={15} />
              <SkeletonBlock width="84%" height={11} />
            </View>
            <SkeletonBlock width={14} height={14} />
          </View>
        </View>
      ) : null}
      {canCreate ? <SkeletonBlock height={52} /> : null}
      <SkeletonSection action={false} compact>
        <SkeletonRows />
      </SkeletonSection>
    </SkeletonBusy>
  );
}

export function ApprovalsSkeleton({
  tab = "queue",
}: {
  readonly tab?: "queue" | "payment";
}): React.JSX.Element {
  return (
    <SkeletonBusy label="Memuat persetujuan" gap={theme.spacing.lg}>
      <SkeletonBlock height={48} />
      {tab === "queue" ? (
        <>
          <SkeletonBlock height={48} />
          <SkeletonSummary kind="pending" />
          <SkeletonRows kind="approval-list" />
          <SkeletonBlock width="88%" height={12} />
        </>
      ) : (
        <>
          <SkeletonSection action={false} compact>
            <SkeletonRows count={3} kind="field" />
          </SkeletonSection>
          <SkeletonBlock height={52} />
          <SkeletonBlock width="90%" height={12} />
        </>
      )}
    </SkeletonBusy>
  );
}

export function ProjectOverviewSkeleton(): React.JSX.Element {
  return (
    <SkeletonBusy label="Memuat detail proyek">
      <View style={styles.overviewHeader}>
        <SkeletonBlock width="76%" height={28} />
        <SkeletonBlock width="64%" height={12} />
        <SkeletonBlock width="27%" height={24} />
        <SkeletonBlock width="70%" height={32} />
        <SkeletonBlock width="48%" height={10} />
      </View>
      <SkeletonRows count={4} kind="fact" />
      <SkeletonSection action={false} compact>
        <SkeletonRows count={3} kind="fact" />
      </SkeletonSection>
      <SkeletonSection action={false} compact>
        <SkeletonRows count={5} kind="fact" />
      </SkeletonSection>
    </SkeletonBusy>
  );
}

export function ProjectFormSkeleton({
  editMode = false,
  newClient = false,
  operationalExpanded = false,
}: {
  readonly editMode?: boolean;
  readonly newClient?: boolean;
  readonly operationalExpanded?: boolean;
}): React.JSX.Element {
  return (
    <SkeletonBusy label={editMode ? "Memuat form ubah proyek" : "Memuat form proyek baru"}>
      <SkeletonSection action={false} compact>
        <SkeletonRows count={editMode ? 3 : newClient ? 7 : 4} kind="field" />
      </SkeletonSection>
      <View style={styles.group}>
        <SkeletonRow kind="fact" />
      </View>
      {operationalExpanded ? (
        <>
          <SkeletonSection action={false} compact>
            <SkeletonRows count={5} kind="field" />
          </SkeletonSection>
          <SkeletonSection action={false} compact>
            <View style={styles.textarea}>
              <SkeletonBlock width="36%" height={12} />
              <SkeletonBlock width="86%" height={16} />
              <SkeletonBlock width="64%" height={16} />
            </View>
          </SkeletonSection>
        </>
      ) : null}
    </SkeletonBusy>
  );
}

export function ExpenseFormSkeleton({
  lineCount = 1,
}: {
  readonly lineCount?: number;
}): React.JSX.Element {
  return (
    <SkeletonBusy label="Memuat form biaya proyek">
      <SkeletonSection action={false} compact>
        <SkeletonRows count={1} kind="field" />
      </SkeletonSection>
      <View style={styles.receipt}>
        <SkeletonBlock width={52} height={52} radius={theme.radii.icon} />
        <View style={styles.copy}>
          <SkeletonBlock width="88%" height={14} />
          <SkeletonBlock width="100%" height={11} />
          <SkeletonBlock width="72%" height={11} />
        </View>
        <SkeletonBlock width={48} height={48} />
      </View>
      {Array.from({ length: Math.max(1, lineCount) }, (_, index) => (
        <SkeletonSection key={index} action={false} compact>
          <SkeletonRows count={5} kind="field" />
        </SkeletonSection>
      ))}
      <SkeletonBlock height={48} />
    </SkeletonBusy>
  );
}

export type DetailSkeletonKind = "account" | "activity" | "approval";

export function DetailSkeleton({ kind }: { readonly kind: DetailSkeletonKind }): React.JSX.Element {
  return (
    <SkeletonBusy
      label={
        kind === "account"
          ? "Memuat rekening"
          : kind === "approval"
            ? "Memuat persetujuan"
            : "Memuat transaksi"
      }
    >
      <SkeletonBlock width="40%" height={12} />
      {kind === "account" ? (
        <>
          <AccountIdentitySkeleton />
          <SkeletonRows count={3} kind="fact" />
          <SkeletonSection action={false} compact>
            <SkeletonRows />
          </SkeletonSection>
        </>
      ) : kind === "activity" ? (
        <>
          <View style={styles.heading}>
            <SkeletonBlock width={96} height={24} />
            <SkeletonBlock width={110} height={12} />
          </View>
          <SkeletonSection action={false} compact>
            <SkeletonRows count={4} kind="fact" />
          </SkeletonSection>
          <SkeletonSection action={false} compact>
            <SkeletonRows count={2} kind="fact" />
          </SkeletonSection>
          <SkeletonRows count={1} kind="fact" />
        </>
      ) : (
        <>
          <SkeletonSummary kind="approval" />
          <SkeletonSection action={false} compact>
            <SkeletonRows count={4} kind="fact" />
          </SkeletonSection>
          <SkeletonSection action={false} compact>
            <SkeletonBlock height={190} radius={theme.radii.inset} />
          </SkeletonSection>
          <SkeletonSection action={false} compact>
            <SkeletonRows count={2} kind="fact" />
          </SkeletonSection>
        </>
      )}
    </SkeletonBusy>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: theme.colors.surfaceContainerHigh },
  inverseBlock: { backgroundColor: theme.opacityColors.white10 },
  stack: { gap: theme.spacing.md },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, flexShrink: 1 },
  copy: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
  rowValue: { alignItems: "flex-end", width: "28%", gap: theme.spacing.xs },
  summary: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
    boxShadow: theme.shadows.surface,
  },
  inverseSummary: {
    backgroundColor: theme.colors.surfaceInverse,
    boxShadow: theme.shadows.inverse,
  },
  metrics: { flexDirection: "row", gap: theme.spacing.xs },
  metric: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
  queueAmount: { maxWidth: "45%", alignSelf: "center", alignItems: "flex-end" },
  inset: {
    padding: theme.spacing.sm,
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  inverseInset: { backgroundColor: theme.opacityColors.white10 },
  budget: { gap: theme.spacing.xs, borderRadius: theme.radii.inset },
  inverseBudget: { padding: theme.spacing.sm },
  group: {
    overflow: "hidden",
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
  row: { gap: theme.spacing.sm, padding: theme.spacing.md, minHeight: 64 },
  field: {
    minHeight: 72,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
    justifyContent: "center",
  },
  fact: { minHeight: 52, paddingVertical: theme.spacing.sm },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.outlineVariant,
  },
  section: { gap: theme.spacing.xs },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 48,
    paddingHorizontal: theme.spacing.base,
  },
  compactSection: { gap: theme.spacing.sm },
  compactHeader: { minHeight: 20 },
  overviewHeader: { gap: theme.spacing.base, paddingTop: theme.spacing.xs },
  recovery: { minHeight: 68, justifyContent: "center", padding: theme.spacing.md },
  receipt: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
  account: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainer,
  },
  textarea: {
    minHeight: 112,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
});
