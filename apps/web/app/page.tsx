import { redirect } from "next/navigation";
import { getPostLoginRedirectDestination } from "@/app/actions/auth-navigation";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly surface?: string }>;
}): Promise<never> {
  const query = await searchParams;
  const destination = await getPostLoginRedirectDestination({
    surface: query.surface === "mobile" ? "mobile" : undefined,
  });
  redirect(destination);
}
