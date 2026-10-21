export class WebRpcAuthorizationError extends Error {
  constructor(
    readonly code: "UNAUTHORIZED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "WebRpcAuthorizationError";
  }
}
