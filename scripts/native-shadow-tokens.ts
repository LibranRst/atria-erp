export type NativeShadowToken = {
  readonly shadowColor: string;
  readonly shadowOffset: { readonly width: number; readonly height: number };
  readonly shadowOpacity: number;
  readonly shadowRadius: number;
  readonly elevation: number;
};

/** Native shadow props represent one outer layer; use the final CSS drop shadow. */
export function deriveNativeShadow(value: string): NativeShadowToken {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === "," && depth === 0) {
      layers.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  layers.push(value.slice(start).trim());
  const outer = layers.filter((layer) => !layer.startsWith("inset ")).at(-1);
  const parsed = outer?.match(
    /^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)(?:px)?(?:\s+(-?[\d.]+)(?:px)?)?\s+rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\)$/,
  );
  if (depth !== 0 || !parsed) throw new Error(`Unsupported semantic native shadow: ${value}`);
  const [, x, y, blur, spread, red, green, blue, alpha] = parsed;
  const numbers = [x, y, blur, red, green, blue, alpha].map(Number);
  if (numbers.some((number) => !Number.isFinite(number)) || (spread && Number(spread) !== 0)) {
    throw new Error(`Unsupported native shadow dimensions: ${value}`);
  }
  const channels = [red, green, blue].map(Number);
  const opacity = Number(alpha);
  if (channels.some((channel) => channel < 0 || channel > 255) || opacity < 0 || opacity > 1) {
    throw new Error(`Invalid native shadow color: ${value}`);
  }
  const radius = Number(blur) / 2;
  return {
    shadowColor: `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`,
    shadowOffset: { width: Number(x), height: Number(y) },
    shadowOpacity: opacity,
    // CSS blur diameter maps to the native radius. Android elevation follows
    // the same derived extent; no platform-local visual constants are introduced.
    shadowRadius: radius,
    elevation: Math.round(radius),
  };
}
