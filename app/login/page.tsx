import { redirect } from "next/navigation";
import { getOptionalTenantContext } from "@/lib/tenant";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getOptionalTenantContext();
  if (session) redirect("/");

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand" aria-label="Pedro ERP">
          <span className="login-brand-name">Pedro</span>
          <span className="login-brand-product">ERP</span>
        </div>

        <div className="login-heading">
          <h1 id="login-title">Entrar</h1>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
