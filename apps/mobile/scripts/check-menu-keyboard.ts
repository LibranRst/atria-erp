/** Pemeriksaan UI nyata; jalankan pada simulator yang sudah login. */
const deviceIndex = process.argv.indexOf("--udid");
const udid = process.argv[deviceIndex + 1];
if (deviceIndex < 0 || !udid) throw new Error("Gunakan --udid <simulator-id>");
const labelIndex = process.argv.indexOf("--label");
const label = labelIndex >= 0 ? process.argv[labelIndex + 1] : "Aksi cepat";

async function run(args: readonly string[]): Promise<string> {
  const child = Bun.spawn(["argent", "run", ...args, "--udid", udid, "--json"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(child.stdout).text();
  if ((await child.exited) !== 0) throw new Error("Argent gagal membaca simulator.");
  return output;
}

function description(output: string): string {
  const parsed: unknown = JSON.parse(output);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("description" in parsed) ||
    typeof parsed.description !== "string"
  ) {
    throw new Error("Respons accessibility tidak dikenali.");
  }
  return parsed.description;
}

let screen = description(await run(["describe"]));
if (screen.includes("Dismiss context menu") || screen.includes("Tutup menu"))
  throw new Error("Tutup menu yang sudah terbuka sebelum pemeriksaan.");
const row = screen.split("\n").find((line) => line.includes(`"${label}"`));
const bounds = row?.match(/\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)/);
if (!bounds) throw new Error(`Trigger ${label} tidak terlihat.`);
const x = Number(bounds[1]) + Number(bounds[3]) / 2;
const y = Number(bounds[2]) + Number(bounds[4]) / 2;
await run(["gesture-tap", "--x", String(x), "--y", String(y)]);
screen = description(await run(["describe"]));
const menuOpen = screen.includes("Dismiss context menu") || screen.includes("Tutup menu");
const keyboard = screen.includes('id="space"') || screen.includes("AXKeyboard");
if (!menuOpen) throw new Error("FAIL: menu tidak terbuka.");
if (keyboard) throw new Error("FAIL: membuka menu menampilkan keyboard.");
console.log(`PASS: ${label} terbuka tanpa keyboard.`);
