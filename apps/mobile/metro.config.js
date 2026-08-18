const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

/**
 * Bun menaruh dua salinan fisik `react-native-css-interop` yang berbeda
 * karena peer dependency-nya (`tailwindcss: "~3"`) beririsan dengan
 * `tailwindcss@4` milik apps/web di monorepo yang sama — bukan konflik versi
 * asli, cuma cara Bun menghitung hash peer-context. Tanpa paksaan ini, style
 * yang di-generate NativeWind teregistrasi di satu salinan sementara
 * `View`/`Text` merender lewat jsx-runtime di salinan lain, jadi className
 * dihitung tapi tidak pernah terlihat.
 *
 * `resolver.extraNodeModules` TIDAK cukup — itu cuma fallback yang dipakai
 * kalau resolusi normal gagal, bukan override paksa, dan resolusi normal ke
 * kedua salinan itu selalu berhasil. `resolveRequest` custom di sini
 * memaksa SEMUA require (langsung maupun relatif, termasuk dari dalam
 * salinan lain) ke satu salinan kanonik di root node_modules.
 */
const CSS_INTEROP_ROOT = path.resolve(projectRoot, "../../node_modules/react-native-css-interop");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react-native-css-interop" ||
    moduleName.startsWith("react-native-css-interop/")
  ) {
    const rest = moduleName.slice("react-native-css-interop".length);
    return context.resolveRequest(context, path.join(CSS_INTEROP_ROOT, "." + rest), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
