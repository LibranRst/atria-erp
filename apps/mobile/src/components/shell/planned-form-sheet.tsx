import { useRouter } from "expo-router";

import { BottomSheet, Button, FactRow, GroupedSurface } from "@/components/ui";

export function PlannedFormSheet({
  description,
  sourceLabel,
  title,
}: {
  readonly description: string;
  readonly sourceLabel: string;
  readonly title: string;
}): React.JSX.Element {
  const router = useRouter();

  return (
    <BottomSheet description={description} title={title}>
      <GroupedSurface>
        <FactRow label="Presentasi" value="Form sheet native" />
        <FactRow label="Pemetaan" value={sourceLabel} />
        <FactRow label="Status" value="Route siap" />
      </GroupedSurface>
      <Button onPress={() => router.back()} variant="secondary">
        Tutup
      </Button>
    </BottomSheet>
  );
}
