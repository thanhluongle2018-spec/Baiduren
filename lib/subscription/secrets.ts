const SECRET_KEYS = new Set([
  "password",
  "passwd",
  "uuid",
  "id",
  "token",
  "secret",
  "auth",
  "authorization",
]);

const SECRET_PATTERN =
  /(password|passwd|uuid|token|secret|authorization|ss:\/\/|vmess:\/\/|trojan:\/\/|vless:\/\/)/gi;

export function redactSecrets(value: string) {
  return value.replace(SECRET_PATTERN, "[redacted]");
}

export function omitSecrets<T extends Record<string, unknown>>(input: T) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEYS.has(key.toLowerCase())) continue;
    output[key] = value;
  }
  return output;
}

export function containsSecret(value: string, secrets: string[]) {
  return secrets.some((secret) => secret.length > 0 && value.includes(secret));
}
