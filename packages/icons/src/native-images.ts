import generated from "./native-images.generated.json";
import { isAppIconName } from "./index";

export function nativeIconImageData(name: string): string {
  return isAppIconName(name) ? generated[name] : generated.fallback;
}

export type NativeIconImageSource = {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
};

export function nativeIconImageSource(name: string): NativeIconImageSource {
  return {
    uri: `data:image/png;base64,${nativeIconImageData(name)}`,
    width: 20,
    height: 20,
    scale: 3,
  };
}
