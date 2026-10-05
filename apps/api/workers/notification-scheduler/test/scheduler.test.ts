import { afterEach, beforeEach, describe, expect, spyOn, test, type Mock } from "bun:test";
import worker, { type Env } from "../src/index";

const environment: Env = {
  NOTIFICATION_JOB_SECRET: "fixture-secret",
  ATRIA_API_URL: "https://fixture.invalid",
};
let upstream: Mock<typeof fetch>;
beforeEach(() => {
  upstream = spyOn(globalThis, "fetch");
});
afterEach(() => {
  upstream.mockRestore();
});

function request(method: string, secret?: string, task = "deliveries"): Request {
  return new Request(`https://worker.invalid?task=${task}`, {
    method,
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("manual notification scheduler access", () => {
  test("rejects missing/invalid bearer and never reaches backend", async () => {
    for (const secret of [undefined, "wrong-secret"]) {
      const response = await worker.fetch(request("POST", secret), environment);
      expect(response.status).toBe(401);
    }
    expect(upstream).not.toHaveBeenCalled();
  });
  test("rejects GET before reaching backend", async () => {
    const response = await worker.fetch(request("GET", "fixture-secret"), environment);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(upstream).not.toHaveBeenCalled();
  });
  test("valid bearer sends the intended task with server-side authorization", async () => {
    upstream.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const response = await worker.fetch(request("POST", "fixture-secret"), environment);
    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream.mock.calls[0][0]).toBe(
      "https://fixture.invalid/api/internal/notifications?task=deliveries",
    );
    expect(upstream.mock.calls[0][1]?.headers).toEqual({
      Authorization: "Bearer fixture-secret",
      "Content-Type": "application/json",
    });
  });
  test("valid bearer with unknown task does not send upstream request", async () => {
    const response = await worker.fetch(request("POST", "fixture-secret", "unknown"), environment);
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  test("missing configured secret cannot authorize a caller", async () => {
    const response = await worker.fetch(request("POST", "fixture-secret"), {
      NOTIFICATION_JOB_SECRET: "",
    });
    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });
  test("missing explicit API origin never falls back to the web host", async () => {
    await expect(
      worker.fetch(request("POST", "fixture-secret"), {
        NOTIFICATION_JOB_SECRET: "fixture-secret",
      }),
    ).rejects.toThrow("ATRIA_API_URL");
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe("independent backend schedules", () => {
  for (const [cron, task] of [
    ["*/30 * * * *", "deliveries"],
    ["0 17 * * *", "all"],
  ] as const) {
    test(`${cron} triggers ${task} directly on the API`, async (): Promise<void> => {
      upstream.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      const pending: Promise<unknown>[] = [];
      await worker.scheduled({ cron }, environment, {
        waitUntil: (effect: Promise<unknown>): void => {
          pending.push(effect);
        },
      });
      await Promise.all(pending);
      expect(upstream.mock.calls[0][0]).toBe(
        `https://fixture.invalid/api/internal/notifications?task=${task}`,
      );
    });
  }
});
