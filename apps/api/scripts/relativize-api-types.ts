import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const declarationRoot = fileURLToPath(new URL("../dist/api-types/apps/api/src/", import.meta.url));

async function declarationFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const filename = path.join(directory, entry.name);
      return entry.isDirectory()
        ? declarationFiles(filename)
        : entry.name.endsWith(".d.ts")
          ? [filename]
          : [];
    }),
  );
  return groups.flat();
}

for (const filename of await declarationFiles(declarationRoot)) {
  const source = await readFile(filename, "utf8");
  const rewritten = source.replace(
    /(["'])@(backend|runtime)\/([^"']+)\1/g,
    (_match: string, quote: string, namespace: string, modulePath: string): string => {
      const directory = namespace === "backend" ? "backend" : "runtime";
      const relative = path
        .relative(path.dirname(filename), path.join(declarationRoot, directory, modulePath))
        .split(path.sep)
        .join("/");
      return `${quote}${relative.startsWith(".") ? relative : `./${relative}`}${quote}`;
    },
  );
  if (rewritten !== source) await writeFile(filename, rewritten);
}
