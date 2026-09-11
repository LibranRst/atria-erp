import { describe, expect, test } from "bun:test";

const bellButtonPath = new URL("./components/notification-bell-button.tsx", import.meta.url);
const morphDialogPath = new URL("./components/notification-morph-dialog.tsx", import.meta.url);

describe("Notification badge animation and close timing", () => {
  test("NotificationMorphDialog morphClosedContent contains only the bell icon without badge during morph closing animation", async () => {
    const source = await Bun.file(morphDialogPath).text();

    expect(source).toContain("morphClosedContent={");
    expect(source).toContain('<AppIcon name="bell" className="icon-md" />');
    // Badge must not be present in morphClosedContent so it doesn't appear during close animation
    expect(source).not.toContain("{summary.unreadCount > 0 ? (");
  });

  test("NotificationBellButton delays badge until close animation completes and animates it with scale", async () => {
    const source = await Bun.file(bellButtonPath).text();

    expect(source).toContain("AnimatePresence");
    expect(source).toContain("motion.span");
    expect(source).toContain("transitionSpringBouncy");
    expect(source).toContain("initial={{ scale: 0, opacity: 0 }}");
    expect(source).toContain("animate={{ scale: 1, opacity: 1 }}");
    expect(source).toContain("!dialogPresent && summary.unreadCount > 0");
    expect(source).toContain("onExitComplete={() => setDialogPresent(false)}");
  });
});
