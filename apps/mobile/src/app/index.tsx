import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";

import { LaunchScreen } from "@/components/shell/launch-screen";
import { trpcClient } from "@/lib/trpc-client";
import { useAuth } from "@/providers/auth-provider";

export default function IndexScreen(): React.JSX.Element {
  const { isAuthenticated, isLoading, user } = useAuth();
  const home = useQuery({
    enabled: isAuthenticated && user?.mustChangePassword !== true,
    queryKey: ["screen", "home", user?.id],
    queryFn: () => trpcClient.screen.home.query(),
  });

  if (isLoading) return <LaunchScreen />;
  if (!isAuthenticated || user?.mustChangePassword) return <Redirect href="/login" />;
  if (home.isPending) return <LaunchScreen />;
  if (home.data?.route === "/onboarding") {
    return (
      <Redirect href={{ pathname: "/onboarding", params: { step: home.data.onboardingStep } }} />
    );
  }
  return <Redirect href={home.data?.route ?? "/projects"} />;
}
