import { useScreenQuery } from "@/lib/use-screen-query";
import { isAccessRevoked } from "@/lib/access-error";
import { ScreenQueryState } from "@/components/ui";
import { Redirect } from "expo-router";

import { LaunchScreen } from "@/components/shell/launch-screen";
import { trpcClient } from "@/lib/trpc-client";
import { useAuth } from "@/providers/auth-provider";

export default function IndexScreen(): React.JSX.Element {
  const { isAuthenticated, isLoading, user } = useAuth();
  const home = useScreenQuery(
    "home",
    (signal) => trpcClient.screen.home.query(undefined, { signal }),
    [],
    isAuthenticated && user?.mustChangePassword !== true,
  );

  if (isLoading) return <LaunchScreen />;
  if (!isAuthenticated || user?.mustChangePassword) return <Redirect href="/login" />;
  if (home.data === undefined || isAccessRevoked(home.error))
    return (
      <ScreenQueryState
        query={home}
        skeleton={<LaunchScreen />}
        onRetry={() => void home.refetch()}
      />
    );
  if (home.data?.route === "/onboarding") {
    return (
      <Redirect href={{ pathname: "/onboarding", params: { step: home.data.onboardingStep } }} />
    );
  }
  return <Redirect href={home.data.route} />;
}
