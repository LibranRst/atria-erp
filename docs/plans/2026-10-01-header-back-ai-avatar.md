# Native header Back, AI and profile photo

Follow the website's left cluster: insert a native Back button at the left on pushed screens; AI remains available to its right instead of being replaced. Keep the AI bar-button identifier stable and headerBackVisible enabled so UIKit owns the iOS 26 navigation-bar transition and reduced-motion behavior. Preserve the persistent center menu and native notification/profile placement; no full-width background.

Expose Better Auth session user.image through MobileSessionUser. When an image is present, compose the shared ChromeButton with a rounded expo-image inside SwiftUI RNHostView in the native toolbar's custom slot. SwiftUI owns button action/material, expo-image owns asynchronous image loading. Failed/missing URLs use the existing profile symbol. Generic fallback uses the same shared button image contract. No profile or finance mutations; no dependency additions.

Validate TypeScript/lint, native simulator root/detail/back layout and transition recording. Actual profile-photo acceptance depends on session data; do not change user data solely to fabricate visual proof.

## Results

- Proyek → detail shows native Back at the left and AI adjacent to its right, matching the website's left cluster. Native Back returns to Proyek and AI resumes its root position. Recording shows UIKit's navigation-bar transition; no JS-authored toolbar animation or native rebuild was needed.
- Session image is exposed as a nullable typed field. Shared ChromeButton now supports imageUri with a rounded 28pt expo-image and URL-specific failure fallback. The iOS profile slot uses a real SwiftUI button; its own material suppresses duplicate native shared background.
- Typecheck/lint, 10 mobile tests and diff whitespace passed. Native inspection on iPhone 17 Pro/iOS 26.5 portrait, 402pt. Image rendering was verified with the local public app-icon fixture, then with a missing URL to verify fallback. All temporary URL overrides were removed; no user profile changed. The active demo session had no image, so an actual user portrait was not tested.
- Evidence under `.atria-demo/verification/2026-10-01-native-chrome/`: `back-ai-transition.mp4`, `back-ai-detail.jpg`, `profile-image-fixture.jpg`, `profile-image-fallback.jpg`. Android runtime, iOS 27, physical-device motion/reduced-motion and 320pt runtime layout were not tested in this pass. Native UIKit owns transition accessibility/reduced motion.
