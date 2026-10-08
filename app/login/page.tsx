import { redirect } from "next/navigation";
import { getOptionalTenantContext } from "@/lib/tenant";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getOptionalTenantContext();

  if (session) {
    redirect("/");
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <span className="login-brand-mark">P</span>
          <div>
            <strong>Pedro ERP</strong>
            <small>Gestão comercial</small>
          </div>
        </div>

        <div className="login-heading">
          <p className="erp-kicker">Acesso seguro</p>
          <h1>Entrar no sistema</h1>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
