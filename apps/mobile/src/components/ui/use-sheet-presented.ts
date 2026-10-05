import { useNavigation, type NativeStackNavigationProp } from "expo-router";
import { useRoute, type ParamListBase } from "expo-router/react-navigation";
import { useLayoutEffect, useState } from "react";
import { Platform } from "react-native";

// Loading and ready bodies share a route session, including slow responses.
const completed = new Set<string>();
export function useSheetPresented(): boolean {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const route = useRoute();
  const [presented, setPresented] = useState(() => {
    const state = navigation.getState();
    return (
      Platform.OS === "web" ||
      completed.has(route.key) ||
      // A directly opened first route has no incoming stack transition to await.
      (state.index === 0 && state.routes[0]?.key === route.key)
    );
  });
  useLayoutEffect(
    () =>
      navigation.addListener("transitionEnd", (event): void => {
        if (event.data.closing) return;
        completed.add(route.key);
        if (completed.size > 128) {
          const oldest = completed.values().next().value;
          if (oldest) completed.delete(oldest);
        }
        setPresented(true);
      }),
    [navigation, route.key],
  );
  return presented;
}
