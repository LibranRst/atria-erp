export function parseNumericToCents(val: string): bigint {
  const parts = val.split(".");
  const integerPart = parts[0] || "0";
  const absoluteIntegerPart = integerPart.replace("-", "");

  let fractionalPart = parts[1] || "";
  fractionalPart = fractionalPart.padEnd(2, "0").slice(0, 2);

  const isNegative = integerPart.startsWith("-");
  const cents = BigInt(absoluteIntegerPart) * BigInt(100) + BigInt(fractionalPart);

  return isNegative ? -cents : cents;
}

export function fromCents(cents: bigint): string {
  const isNegative = cents < BigInt(0);
  const absoluteCents = isNegative ? -cents : cents;

  const integerPart = absoluteCents / BigInt(100);
  const fractionalPart = absoluteCents % BigInt(100);

  const formattedFraction = fractionalPart.toString().padStart(2, "0");
  const sign = isNegative ? "-" : "";

  return `${sign}${integerPart}.${formattedFraction}`;
}
