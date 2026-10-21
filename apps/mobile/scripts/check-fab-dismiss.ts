import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

/** Real simulator seam: dismissal must keep the FAB rendered and not navigate. */
const udidIndex = process.argv.indexOf("--udid");
const udid = process.argv[udidIndex + 1];
if (udidIndex < 0 || !udid) throw new Error("Gunakan --udid <simulator-id>");

async function command(args: readonly string[]): Promise<string> {
  const process = Bun.spawn([...args], { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(process.stdout).text();
  if ((await process.exited) !== 0) throw new Error(`Command failed: ${args[0]}`);
  return output;
}

async function describe(): Promise<string> {
  const value: unknown = JSON.parse(
    await command(["argent", "run", "describe", "--udid", udid, "--json"]),
  );
  if (
    typeof value !== "object" ||
    value === null ||
    !("description" in value) ||
    typeof value.description !== "string"
  )
    throw new Error("Accessibility response invalid");
  return value.description;
}

const before = await describe();
if (before.includes("Dismiss context menu")) throw new Error("Tutup menu sebelum pemeriksaan.");
const fab = before.split("\n").find((line) => line.includes('AXButton "Aksi cepat"'));
const bounds = fab?.match(/\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)/);
if (!bounds) throw new Error("FAB tidak terlihat.");
const [x, y, width, height] = bounds.slice(1).map(Number);
const page = before
  .split("\n")
  .find((line) => line.includes('AXButton "Menu halaman'))
  ?.split('"')[1];
await command([
  "argent",
  "run",
  "gesture-tap",
  "--udid",
  udid,
  "--x",
  String(x + width / 2),
  "--y",
  String(y + height / 2),
  "--json",
]);
await Bun.sleep(350);
if (!(await describe()).includes("Dismiss context menu")) throw new Error("Menu tidak terbuka.");
await command([
  "argent",
  "run",
  "gesture-tap",
  "--udid",
  udid,
  "--x",
  "0.04",
  "--y",
  "0.45",
  "--json",
]);
// Inspect dismissal itself, not only a later resting state that hides the bug.
await Bun.sleep(700);
const after = await describe();
if (after.includes("Dismiss context menu")) throw new Error("FAIL: menu tidak tertutup.");
if (after.includes("Sheet Grabber") || (page && !after.includes(`"${page}"`)))
  throw new Error("FAIL: dismiss membuka form atau berpindah halaman.");
if (after.includes('id="space"')) throw new Error("FAIL: dismiss membuka keyboard.");

const directory = path.resolve(
  import.meta.dir,
  "../../../.atria-demo/verification/native-dock-2026-09-30",
);
mkdirSync(directory, { recursive: true });
const screenshot = path.join(directory, `fab-dismiss-${Date.now()}.png`);
const capture: unknown = JSON.parse(
  await command([
    "argent",
    "run",
    "screenshot",
    "--udid",
    udid,
    "--scale",
    "1",
    "--includeImageInContext",
    "false",
    "--json",
  ]),
);
if (
  typeof capture !== "object" ||
  capture === null ||
  !("image" in capture) ||
  typeof capture.image !== "string"
)
  throw new Error("Screenshot response invalid");
copyFileSync(capture.image, screenshot);
const analysis = await command([
  "python3",
  "-c",
  `
import json, sys
from PIL import Image
image = Image.open(sys.argv[1]).convert('RGB')
x,y,w,h = map(float,sys.argv[2:])
def brightness(cx,cy):
    radius = max(1,round(min(w*image.width,h*image.height)*0.018))
    values = []
    for dy in range(-radius,radius+1):
        for dx in range(-radius,radius+1):
            values.append(sum(image.getpixel((round(cx*image.width)+dx,round(cy*image.height)+dy)))/3)
    return sum(values)/len(values)
center = brightness(x+w*.5,y+h*.5)
surround = sum(brightness(x+w*(.5+dx),y+h*(.5+dy)) for dx,dy in [(-.22,-.22),(.22,-.22),(-.22,.22),(.22,.22)])/4
print(json.dumps({'glyphContrast':abs(center-surround)}))
`,
  screenshot,
  String(x),
  String(y),
  String(width),
  String(height),
]);
const result: unknown = JSON.parse(analysis);
if (
  typeof result !== "object" ||
  result === null ||
  !("glyphContrast" in result) ||
  typeof result.glyphContrast !== "number"
)
  throw new Error("Pixel analysis invalid");
if (result.glyphContrast < 80)
  throw new Error(
    `FAIL: glyph FAB hilang/salah selama dismiss (${result.glyphContrast.toFixed(3)}). Screenshot: ${screenshot}`,
  );
console.log(
  `PASS: dismiss mempertahankan FAB, halaman, dan keyboard (glyph contrast ${result.glyphContrast.toFixed(1)}). Screenshot: ${screenshot}`,
);
