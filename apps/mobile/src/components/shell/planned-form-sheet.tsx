import { BottomSheet, Button } from "@/components/ui";
import { useAtriaNavigation } from "@/lib/use-atria-navigation";

export function PlannedFormSheet({
  description,
  webDestination,
  title,
}: {
  readonly description: string;
  readonly webDestination: string;
  readonly title: string;
}): React.JSX.Element {
  const navigate = useAtriaNavigation();

  return (
    <BottomSheet
      description={description}
      title={title}
      footer={<Button onPress={() => navigate(webDestination, true)}>Buka di web</Button>}
    />
  );
}
