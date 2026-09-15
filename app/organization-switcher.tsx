"use client";

import { useState } from "react";

type OrganizationOption = {
  id: string;
  name: string;
};

export function OrganizationSwitcher(props: {
  activeOrganizationId: string;
  organizations: OrganizationOption[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function switchOrganization(organizationId: string) {
    if (organizationId === props.activeOrganizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/organization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Falha ao trocar empresa." }));
      setError(body.error ?? "Falha ao trocar empresa.");
      setLoading(false);
      return;
    }

    window.location.reload();
  }

  async function logout() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/logout", { method: "POST" });

    if (!response.ok) {
      setError("Falha ao encerrar a sessão.");
      setLoading(false);
      return;
    }

    window.location.assign("/login");
  }

  return (
    <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
      <label style={{ display: "grid", gap: 6 }}>
        Empresa ativa
        <select
          value={props.activeOrganizationId}
          disabled={loading}
          onChange={(event) => void switchOrganization(event.target.value)}
        >
          {props.organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>

      <button type="button" disabled={loading} onClick={() => void logout()}>
        Sair
      </button>

      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
