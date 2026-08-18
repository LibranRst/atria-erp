import { Stack } from "expo-router/stack";

import { theme } from "@/theme";

export default function LedgerLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.colors.background },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontFamily: theme.fonts.bold },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Dashboard" }} />
    </Stack>
  );
}
