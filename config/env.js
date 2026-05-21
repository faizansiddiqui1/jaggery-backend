import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Minimal .env loader to avoid external deps.
 * Only sets variables that are not already present in process.env.
 */
export function loadEnv() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(moduleDir, "..", ".env"),
  ];
  const envPath = candidates.find((p) => fs.existsSync(p));
  if (!envPath) return;

  const content = fs.readFileSync(envPath, "utf8");
  content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const idx = line.indexOf("=");
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      // strip inline comments after a space + #
      const hashIdx = value.indexOf(" #");
      if (hashIdx !== -1) value = value.slice(0, hashIdx).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value.trim();
      }
    });
}

// Auto-load on import
loadEnv();
