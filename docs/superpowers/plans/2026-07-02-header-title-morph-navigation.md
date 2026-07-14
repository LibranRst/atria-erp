# Header Title Morph Navigation Revamp

## Summary
- Replace the old sidebar drawer with a morphing navigation menu opened from the centered header title.
- Keep bottom navigation unchanged as the fast thumb nav.
- Change the root-route left hamburger into a chat icon button that shows an AI Chat coming-soon toast.

## Implementation
- Move global page title and header navigation metadata into a shared layout config.
- Build a Framer Motion header menu using the existing motion tokens, rounded iOS controls, route-change close behavior, Escape close, and backdrop close.
- Remove the sidebar import/render path from the mobile shell and delete the unused sidebar component.

## Verification
- Run lint and production build.
- Manually check root pages, detail pages, role-filtered menu entries, `/login`, and close/navigation behavior at mobile shell width.
