import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";

export async function requireTenantContext() {
  const session = await getSessionContext();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function getOptionalTenantContext() {
  return getSessionContext();
}
