// Metro resolves this side-effect import to src/global.css via the @/* alias.
declare module "@/global.css" {}

declare module "*.png" {
  const source: import("expo-image").ImageSource | number;
  export default source;
}
