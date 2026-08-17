import { redirect } from "next/navigation";

export default async function OpeningInventoryPage(): Promise<never> {
  redirect("/settings?tab=setup&flow=initial-stock");
}
