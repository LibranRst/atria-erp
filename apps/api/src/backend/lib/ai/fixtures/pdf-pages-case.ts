import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PDF_RENDER_LIMITS, PdfRenderError, renderPdfPages } from "../pdf-pages";

const statement = new URL("./pdf-pages-statement.pdf", import.meta.url);
const helperFile = new URL("../pdf-pages.ts", import.meta.url);

function syntheticPdf(pageCount: number, width = 612, height = 792, jpeg?: Buffer): Uint8Array {
  const fontIndex = 3;
  const imageIndex = jpeg ? 4 : 0;
  const start = jpeg ? 5 : 4;
  const kids = Array.from({ length: pageCount }, (_, i) => `${start + i * 2} 0 R`).join(" ");
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from(`<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
  ];
  if (jpeg)
    objects.push(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width 1200 /Height 1552 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>\nstream\n`,
        ),
        jpeg,
        Buffer.from("\nendstream"),
      ]),
    );
  for (let i = 0; i < pageCount; i++) {
    const contentIndex = start + i * 2 + 1;
    const content = jpeg
      ? `q ${width} 0 0 ${height} 0 0 cm /Im1 Do Q`
      : `BT /F1 18 Tf 20 ${height - 35} Td (SYNTHETIC PAGE ${i + 1} - NOT REAL) Tj ET`;
    const resources = jpeg
      ? `/XObject << /Im1 ${imageIndex} 0 R >>`
      : `/Font << /F1 ${fontIndex} 0 R >>`;
    objects.push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << ${resources} >> /Contents ${contentIndex} 0 R >>`,
      ),
    );
    objects.push(
      Buffer.from(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`),
    );
  }
  const parts = [Buffer.from("%PDF-1.7\n")];
  const offsets: number[] = [];
  let offset = parts[0].byteLength;
  objects.forEach((object, index): void => {
    offsets.push(offset);
    const part = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      object,
      Buffer.from("\nendobj\n"),
    ]);
    parts.push(part);
    offset += part.byteLength;
  });
  parts.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(parts);
}

async function expectFailure(operation: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(operation, (error: unknown): boolean => {
    assert.ok(error instanceof PdfRenderError);
    assert.equal(error.code, code);
    assert.ok(error.message.length > 0 && error.message.length < 180);
    assert.doesNotMatch(error.message, /fixture-secret|password|Bearer|https?:|\/Users\//);
    if (code === "PDF_PAGE_LIMIT") assert.match(error.message, /5 halaman/);
    if (code === "PDF_INPUT_LIMIT") assert.match(error.message, /10 MB/);
    return true;
  });
}

async function renderCase(): Promise<void> {
  const result = await renderPdfPages(
    new Uint8Array(await readFile(statement)),
    AbortSignal.timeout(5000),
  );
  assert.equal(result.total, 1);
  assert.equal(result.pages.length, 1);
  const page = result.pages[0];
  assert.equal(page.pageNumber, 1);
  assert.equal(page.mediaType, "image/png");
  assert.equal(page.width, 1200);
  assert.equal(page.height, 1552);
  assert.equal(result.byteLength, page.bytes.byteLength);
  const image = await loadImage(page.bytes);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  let darkPixels = 0;
  for (let i = 0; i < pixels.length; i += 4)
    if (pixels[i] < 200 && pixels[i + 1] < 200 && pixels[i + 2] < 200) darkPixels++;
  // Catches the otherwise-valid blank PNG caused by missing Linux standard fonts.
  assert.ok(darkPixels > 5000);
  const tall = await renderPdfPages(syntheticPdf(1, 100, 10_000), AbortSignal.timeout(5000));
  assert.equal(tall.pages[0].height, 2400);
  assert.ok(tall.pages[0].width <= 1200);
}

async function limitsCase(): Promise<void> {
  await expectFailure(
    renderPdfPages(new Uint8Array([1, 2, 3]), AbortSignal.timeout(5000)),
    "PDF_INPUT_INVALID",
  );
  await expectFailure(
    renderPdfPages(
      Buffer.from("%PDF- malformed sensitive-synthetic-marker"),
      AbortSignal.timeout(5000),
    ),
    "PDF_RENDER_FAILED",
  );
  await expectFailure(
    renderPdfPages(new Uint8Array(PDF_RENDER_LIMITS.sourceBytes + 1), AbortSignal.timeout(5000)),
    "PDF_INPUT_LIMIT",
  );
  await expectFailure(renderPdfPages(syntheticPdf(6), AbortSignal.timeout(5000)), "PDF_PAGE_LIMIT");
  const five = await renderPdfPages(syntheticPdf(5), AbortSignal.timeout(5000));
  assert.equal(five.total, 5);
  assert.deepEqual(
    five.pages.map((p) => p.pageNumber),
    [1, 2, 3, 4, 5],
  );
  await expectFailure(renderPdfPages(syntheticPdf(1), AbortSignal.abort()), "PDF_ABORTED");
}

async function imageLimitCase(): Promise<void> {
  const canvas = createCanvas(1200, 1552);
  const context = canvas.getContext("2d");
  const image = context.createImageData(1200, 1552);
  let state = 0x13579bdf;
  for (let i = 0; i < image.data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      image.data[i + channel] = state & 255;
    }
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const jpeg = canvas.toBuffer("image/jpeg", 90);
  const pdf = syntheticPdf(3, 1200, 1552, jpeg);
  assert.ok(pdf.byteLength < PDF_RENDER_LIMITS.sourceBytes);
  await expectFailure(renderPdfPages(pdf, AbortSignal.timeout(12_000)), "PDF_IMAGE_LIMIT");
  assert.equal((await renderPdfPages(syntheticPdf(1), AbortSignal.timeout(5000))).total, 1);
}

async function concurrencyAbortCase(): Promise<void> {
  const pdf = syntheticPdf(5);
  const controller = new AbortController();
  const first = renderPdfPages(pdf, controller.signal);
  await expectFailure(renderPdfPages(pdf, AbortSignal.timeout(5000)), "PDF_BUSY");
  controller.abort("synthetic reason must not leak");
  await expectFailure(first, "PDF_ABORTED");
  assert.equal((await renderPdfPages(syntheticPdf(1), AbortSignal.timeout(5000))).total, 1);
}

async function environmentCase(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "atria-pdf-env-"));
  const previous = process.cwd();
  try {
    await writeFile(join(directory, ".env"), "FORBIDDEN_RENDER_ENV=synthetic-dotenv-marker\n", {
      mode: 0o600,
    });
    process.chdir(directory);
    await renderCase();
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
}

async function deadlineCase(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "atria-pdf-deadline-"));
  try {
    const source = join(directory, "src/backend/lib/ai");
    const runtime = join(directory, "src/runtime");
    await mkdir(source, { recursive: true });
    await mkdir(runtime, { recursive: true });
    await writeFile(join(source, "pdf-pages.ts"), await readFile(helperFile));
    const repository = fileURLToPath(new URL("../../../../../../..", import.meta.url));
    await symlink(join(repository, "node_modules"), join(directory, "node_modules"));
    // A deliberately hung isolated renderer tests actual SIGKILL/deadline cleanup.
    await writeFile(join(runtime, "pdf-render-worker.ts"), "await Bun.sleep(30_000);\n");
    const isolated: { renderPdfPages: typeof renderPdfPages } = await import(
      join(source, "pdf-pages.ts")
    );
    const start = performance.now();
    await assert.rejects(
      isolated.renderPdfPages(syntheticPdf(1), AbortSignal.timeout(22_000)),
      (error: unknown): boolean => {
        assert.ok(error instanceof Error && "code" in error);
        assert.equal(error.code, "PDF_TIMEOUT");
        return true;
      },
    );
    assert.ok(performance.now() - start < 20_000);
    await writeFile(
      join(runtime, "pdf-render-worker.ts"),
      "await Bun.write(Bun.stdout, JSON.stringify({success:false,code:'PDF_PAGE_LIMIT'}));\n",
    );
    await assert.rejects(
      isolated.renderPdfPages(syntheticPdf(1), AbortSignal.timeout(5000)),
      (error: unknown): boolean => {
        assert.ok(error instanceof Error && "code" in error);
        assert.equal(error.code, "PDF_PAGE_LIMIT");
        return true;
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const scenarios: Readonly<Record<string, () => Promise<void>>> = {
  render: renderCase,
  limits: limitsCase,
  "image-limit": imageLimitCase,
  "concurrency-abort": concurrencyAbortCase,
  environment: environmentCase,
  deadline: deadlineCase,
};
const scenario = scenarios[process.argv[2] ?? ""];
if (!scenario) throw new Error("Unknown PDF renderer fixture case");
await scenario();
console.log("PASS");
