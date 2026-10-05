import { ScrollView, Text, View } from "react-native";
import { Button, GroupedSurface } from "@/components/ui";
import { useAtriaNavigation } from "@/lib/use-atria-navigation";
import { theme } from "@/theme";
import { TAB_BAR_CLEARANCE } from "@/constants/scroll-insets";

export function WebBridgeScreen({
  title,
  description,
  destination,
}: {
  readonly title: string;
  readonly description: string;
  readonly destination: string;
}): React.JSX.Element {
  const navigate = useAtriaNavigation();
  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: theme.spacing.marginMobile,
          gap: theme.spacing.md,
          paddingBottom: theme.spacing.xl + TAB_BAR_CLEARANCE,
        }}
      >
        <GroupedSurface>
          <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
            <Text
              style={{
                color: theme.colors.onSurface,
                fontFamily: theme.fonts.bold,
                ...theme.typography.section,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: theme.colors.muted,
                fontFamily: theme.fonts.medium,
                ...theme.typography.support,
              }}
            >
              {description}
            </Text>
            <Button onPress={() => navigate(destination, true)}>Buka di web</Button>
          </View>
        </GroupedSurface>
      </ScrollView>
    </>
  );
}
