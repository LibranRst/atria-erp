#!/usr/bin/env node

/**
 * Antigravity PreToolUse Safety Hook
 * Inspects shell commands to prevent destructive or catastrophic operations.
 */

let inputData = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  inputData += chunk;
});

process.stdin.on("end", () => {
  try {
    const payload = inputData ? JSON.parse(inputData) : {};
    const toolCall = payload.toolCall;

    if (toolCall && toolCall.name === "run_command") {
      const cmd = toolCall.args?.CommandLine || "";

      // Check for destructive commands
      const dangerousPatterns = [
        /rm\s+-rf\s+(\/|~|\$HOME|\.\.)/i,
        /drop\s+database/i,
        /git\s+push\s+.*--force/i,
        /mkfs/i,
        /dd\s+if=/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(cmd)) {
          console.log(
            JSON.stringify({
              decision: "ask",
              reason: `Perintah terdeteksi berpotensi destruktif: "${cmd}". Mohon konfirmasi pengguna terlebih dahulu.`,
            }),
          );
          process.exit(0);
        }
      }
    }

    // Default allow
    console.log(JSON.stringify({ decision: "allow" }));
  } catch {
    // If parse fails, fail safe to allow
    console.log(JSON.stringify({ decision: "allow" }));
  }
});
