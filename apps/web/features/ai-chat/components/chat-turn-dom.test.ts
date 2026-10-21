import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

for (const motion of ["normal", "reduced"] as const) {
  test(`reply handoff preserves real activity and recovery (${motion} motion)`, async (): Promise<void> => {
    const fixture = fileURLToPath(new URL("./chat-turn-dom.fixture.tsx", import.meta.url));
    const child = Bun.spawn(["bun", "--preload", "./scripts/test-preload.ts", fixture, motion], {
      cwd: fileURLToPath(new URL("../../../", import.meta.url)),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    // Happy DOM does not implement every browser CSS initial value; Motion's
    // known fallback diagnostic is distinct from application errors. Retain
    // every other warning/error so the subprocess cannot pass silently.
    let unexpectedStderr = stderr.replaceAll(
      'You are trying to animate opacity from "undefined" to "1". "undefined" is not an animatable value.. For more information and steps for solving, visit https://motion.dev/troubleshooting/value-not-animatable\n',
      "",
    );
    if (motion === "reduced")
      unexpectedStderr = unexpectedStderr.replace(
        "You have Reduced Motion enabled on your device. Animations may not appear as expected.. For more information and steps for solving, visit https://motion.dev/troubleshooting/reduced-motion-disabled\n",
        "",
      );
    expect({ exitCode, stderr: unexpectedStderr }).toEqual({ exitCode: 0, stderr: "" });
    expect(stdout).toContain(`reply handoff DOM passed (${motion})`);
  }, 30_000);
}
