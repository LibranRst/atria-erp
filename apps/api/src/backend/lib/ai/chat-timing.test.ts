import { expect, test } from "bun:test";
import { ChatTiming, type ChatTimingRecord } from "./chat-timing";

test("completion includes persistence and reports model/tool timing without payloads", (): void => {
  let now = 100;
  const records: ChatTimingRecord[] = [];
  const timing = new ChatTiming(
    (record): void => {
      records.push(record);
    },
    (): number => now,
    "test-request",
  );
  now = 150;
  timing.mark("context");
  timing.model({ model: "test-model", durationMs: 800, firstOutputMs: 500 });
  timing.tool("getProjectBudget", 12);
  now = 950;
  timing.mark("first-answer");
  now = 970;
  timing.mark("assistant-persisted");
  timing.finish("complete");
  now = 1200;
  timing.finish("error");
  expect(records).toHaveLength(1);
  expect(records[0]?.totalMs).toBe(870);
  expect(records[0]?.stages).toEqual({
    context: 50,
    "first-answer": 850,
    "assistant-persisted": 870,
  });
  expect(Object.keys(records[0] ?? {}).sort()).toEqual([
    "modelCalls",
    "outcome",
    "requestId",
    "stages",
    "toolCalls",
    "totalMs",
  ]);
});

test("a failed diagnostic sink cannot affect the request", (): void => {
  const timing = new ChatTiming((): never => {
    throw new Error("sink unavailable");
  });
  expect((): void => timing.finish("complete")).not.toThrow();
});
