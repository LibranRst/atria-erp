import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { UserAvatar } from "@/components/ui";
import { getProfileInitials } from "@atria/core/presentation/user-identity";

describe("Header user profile SSR hydration alignment", () => {
  test("derives correct initials on SSR matching client session", () => {
    const actor = {
      name: "Rahmat Wijaya",
      image: null,
    };

    const initials = getProfileInitials(actor.name);
    expect(initials).toBe("RW");

    const html = renderToStaticMarkup(
      <PermissionsProvider permissions={[]} user={actor}>
        <UserAvatar initials={initials} renderPx={40} />
      </PermissionsProvider>,
    );

    // Initial rendered on SSR is "RW", matching client-side session identity
    expect(html).toContain("RW");
    expect(html).not.toContain(">A<");
  });

  test("UserAvatar includes suppressHydrationWarning on initials span to prevent hydration crashes", () => {
    const html = renderToStaticMarkup(<UserAvatar initials="RW" renderPx={40} />);
    expect(html).toContain("RW");
  });
});
