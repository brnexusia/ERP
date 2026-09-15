import { redirect } from "next/navigation";
import { getOptionalTenantContext } from "@/lib/tenant";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getOptionalTenantContext();

  if (session) {
    redirect("/");
  }

  return (
    <main className="foundation-shell">
      <section className="foundation-card">
        <p className="eyebrow">ERP PEDRO</p>
        <h1>Acesso ao sistema</h1>
        <p>Interface provisória da fundação. O visual definitivo seguirá o Stitch aprovado.</p>
        <LoginForm />
      </section>
    </main>
  );
}
