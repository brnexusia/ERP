/**
 * Configuration metadata is visible to tenant administrators. Credential
 * values must live in a secret store and only their opaque secretRef may be
 * recorded in Integration. This also masks legacy misconfigured records.
 */
function sensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return [
    "password", "passwd", "secret", "token", "apikey", "accesskey",
    "privatekey", "credential", "authorization", "bearer",
    "cookie", "passphrase", "signature", "clientkey",
  ].some((part) => normalized.includes(part));
}

export function findUnsafeSettingsPath(settings: unknown): Array<string | number> | null {
  const stack: Array<{ value: unknown; path: Array<string | number> }> =
    [{ value: settings, path: [] }];
  let visited = 0;
  while (stack.length) {
    const entry = stack.pop()!;
    visited += 1;
    if (visited > 10000 || entry.path.length > 32) return entry.path;
    if (entry.value == null || typeof entry.value !== "object") continue;
    if (Array.isArray(entry.value)) {
      for (let i = 0; i < entry.value.length; i++) {
        stack.push({ value: entry.value[i], path: [...entry.path, i] });
      }
    } else {
      for (const [key, value] of Object.entries(entry.value as Record<string, unknown>)) {
        if (sensitiveKey(key)) return [...entry.path, key];
        stack.push({ value, path: [...entry.path, key] });
      }
    }
  }
  return null;
}

export function redactUnsafeSettings(value: unknown, depth = 0): unknown {
  if (depth > 32) return null;
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactUnsafeSettings(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKey(key))
      .map(([key, child]) => [key, redactUnsafeSettings(child, depth + 1)]),
  );
}
