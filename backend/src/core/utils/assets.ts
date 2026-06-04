import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function readAsset(importMetaUrl: string, relativePath: string): string {
  const directory = dirname(fileURLToPath(importMetaUrl));
  return readFileSync(join(directory, relativePath), "utf8");
}

export function readJsonAsset<T>(importMetaUrl: string, relativePath: string): T {
  return JSON.parse(readAsset(importMetaUrl, relativePath)) as T;
}
