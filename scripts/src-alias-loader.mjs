import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

function withExtension(base) {
  if (existsSync(base)) return base;
  for (const ext of [".ts", ".tsx", ".mjs", ".js", ".json"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  if (existsSync(join(base, "index.ts"))) return join(base, "index.ts");
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const hit = withExtension(join(SRC, specifier.slice(2)));
    if (!hit) throw new Error(`Cannot resolve ${specifier}`);
    return nextResolve(pathToFileURL(hit).href, context);
  }
  const parent = context.parentURL ?? "";
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    parent.includes("/src/") &&
    !specifier.match(/\.[a-z]+$/i)
  ) {
    const hit = withExtension(join(dirname(fileURLToPath(parent)), specifier));
    if (hit) return nextResolve(pathToFileURL(hit).href, context);
  }
  return nextResolve(specifier, context);
}
