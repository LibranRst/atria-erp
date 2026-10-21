import { withRequestContext } from "@runtime/request-context";

/** Legacy action tests exercise real API header/cache context without global framework mocks. */
export function withTestRequest<Args extends readonly unknown[], Result>(
  handler: (...args: Args) => Result | Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    const execution = await withRequestContext(
      new Request("http://atria-api.test/api/internal/web-rpc", {
        headers: { cookie: "better-auth.session_token=mocked-cookies" },
      }),
      () => handler(...args),
    );
    return execution.value;
  };
}
