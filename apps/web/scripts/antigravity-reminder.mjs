#!/usr/bin/env node

/**
 * Antigravity PreInvocation Context Hook
 * Injects helpful persistent reminders for Paduna Build invariants into agent context.
 */

let inputData = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  inputData += chunk;
});

process.stdin.on("end", () => {
  try {
    if (inputData) {
      JSON.parse(inputData);
    }

    // Inject persistent context reminders
    console.log(
      JSON.stringify({
        injectSteps: [
          {
            ephemeralMessage:
              "[Paduna Build Context] Invariants: Strict TypeScript (no any), Drizzle db.transaction + audit_log for balance/stock mutations, mobile 320-430px truth, iOS Paten form styling (rounded-full standalone, FormSection borderless grouped), MoneyValue formatting, RAP vs RAB isolation.",
          },
        ],
      }),
    );
  } catch {
    console.log(JSON.stringify({ injectSteps: [] }));
  }
});
