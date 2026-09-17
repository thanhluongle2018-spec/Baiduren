import { existsSync } from "node:fs";
import path from "node:path";
import { MIHOMO_BINARY_ENV } from "@/lib/proxy-runtime/constants";

const CANDIDATES = ["mihomo", "clash-meta", "clash"];

export function resolveMihomoBinary(explicit?: string | null) {
  if (explicit) {
    return existsSync(explicit) ? explicit : null;
  }
  const fromEnv = process.env[MIHOMO_BINARY_ENV];
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(path.delimiter)) {
    for (const name of CANDIDATES) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export function isMihomoAvailable(explicit?: string | null) {
  return resolveMihomoBinary(explicit) != null;
}
