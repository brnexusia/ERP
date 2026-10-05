import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenant";

export default async function HomePage() {
  await requireTenantContext();
  redirect("/clients");
}
