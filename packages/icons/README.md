# Atria icons

One platform-independent registry for free Hugeicons Stroke Rounded SVG data.
Both clients keep their existing `AppIcon` public adapter and import the same
names, fallback and 1.5 stroke default from this package. All 144 previous aliases
remain supported; seven additional names cover existing caller gaps and chrome.

The React/React Native renderers stay inside their client adapters. Legacy
`weight` values remain accepted for compatibility and render the same free
outline family. Phosphor is confined to the historical web Storybook reference.

Native UIKit/menu image slots consume local 20pt @3x PNG templates generated
from the same free SVG data. Regenerate them from the workspace root after
changing the registry:

```sh
bun --filter @atria/icons generate:native-images
bun --filter @atria/icons test
```

The iOS dock remains on SF Symbols. Rebuild the native development client after
changing its module's image-data props. Native visual verification was explicitly
deferred by the user for this migration.

Hugeicons glyphs and generated templates are covered by the MIT notice in
[NOTICE.md](NOTICE.md).
