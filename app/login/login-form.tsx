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
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 24 }}>
      <label style={{ display: "grid", gap: 6 }}>
        E-mail
        <input name="email" type="email" autoComplete="email" required />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        Senha
        <input name="password" type="password" autoComplete="current-password" required />
      </label>

      {error ? <p role="alert">{error}</p> : null}

      <button type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
