import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Bun 1.3 dapat mempertahankan peer-context copy lama setelah patchedDependencies.
// Perbaikan identik diterapkan hanya ke versi yang dipin sebelum build native.
const root = path.resolve(import.meta.dir, "..");
const store = path.join(root, "node_modules/.bun");
const directories = [
  path.join(root, "node_modules/expo-constants"),
  ...readdirSync(store)
    .filter((entry) => entry.startsWith("expo-constants@57.0.11"))
    .map((entry) => path.join(store, entry, "node_modules/expo-constants")),
];

for (const directory of directories) {
  const script = path.join(directory, "scripts/get-app-config-ios.sh");
  const spec = path.join(directory, "ios/EXConstants.podspec");
  if (!existsSync(script) || !existsSync(spec)) continue;
  const packageData: unknown = JSON.parse(
    readFileSync(path.join(directory, "package.json"), "utf8"),
  );
  if (
    typeof packageData !== "object" ||
    packageData === null ||
    !("version" in packageData) ||
    packageData.version !== "57.0.11"
  )
    continue;
  const beforeScript = readFileSync(script, "utf8");
  const afterScript = beforeScript.replace(
    "PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)",
    'PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")',
  );
  if (afterScript !== beforeScript) writeFileSync(script, afterScript);
  const beforeSpec = readFileSync(spec, "utf8");
  const afterSpec = beforeSpec.replace(
    String.raw`:script => "bash -l -c \"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"",`,
    String.raw`:script => "bash -l -c \"#{env_vars}\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\"\"",`,
  );
  if (afterSpec !== beforeSpec) writeFileSync(spec, afterSpec);
}
console.log("Expo Constants native path quoting checked.");
