import { describe, expect, test } from "bun:test";

import { navigateAfterLogin } from "./login-navigation";

describe("navigateAfterLogin", () => {
  test("uses one document navigation so the authenticated root layout mounts atomically", () => {
    const destinations: string[] = [];

    navigateAfterLogin({
      replace(destination: string): void {
        destinations.push(destination);
      },
    });

    expect(destinations).toEqual(["/"]);
  });

  test("uses provided destination when specified", () => {
    const destinations: string[] = [];

    navigateAfterLogin(
      {
        replace(destination: string): void {
          destinations.push(destination);
        },
      },
      "/onboarding?step=welcome",
    );

    expect(destinations).toEqual(["/onboarding?step=welcome"]);
  });
});
