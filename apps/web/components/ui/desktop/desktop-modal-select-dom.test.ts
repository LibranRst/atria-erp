import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { runDomFixture } from "../../../scripts/run-dom-fixture";

test("desktop selection variants remain usable inside nested shared modals", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./desktop-modal-select-dom.fixture.tsx", import.meta.url));
  const { stdout, stderr, exitCode } = await runDomFixture({
    name: "Nested desktop selection variants",
    fixture,
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    timeoutMs: 10_000,
  });
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(stdout).toContain("nested desktop selection variants passed");
}, 60000);
