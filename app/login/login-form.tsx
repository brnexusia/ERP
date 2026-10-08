"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Falha ao entrar." }));
      setError(body.error ?? "Falha ao entrar.");
      setLoading(false);
      return;
    }

    window.location.assign("/");
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label>
        <span>E-mail</span>
        <input name="email" type="email" autoComplete="email" placeholder="seu@email.com" required />
      </label>

      <label>
        <span>Senha</span>
        <input name="password" type="password" autoComplete="current-password" placeholder="••••••••••" required />
      </label>

      {error ? <div className="login-error" role="alert">{error}</div> : null}

      <button className="login-submit" type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
