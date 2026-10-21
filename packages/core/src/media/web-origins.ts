import { z } from "zod";

const webOriginSchema = z
  .string()
  .trim()
  .url()
  .refine((value: string): boolean => {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.hostname.includes("*") &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  }, "Gunakan origin HTTP/HTTPS tanpa path atau kredensial.");

export const additionalWebOriginsSchema = z
  .string()
  .default("")
  .transform((value: string): string[] =>
    value
      .split(",")
      .map((origin: string): string => origin.trim())
      .filter(Boolean),
  )
  .pipe(z.array(webOriginSchema).max(8))
  .transform((origins: string[]): string[] => [
    ...new Set(origins.map((origin: string): string => new URL(origin).origin)),
  ]);

export function configuredAttachmentOrigins(
  environment: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  return [
    ...new Set(
      [
        environment.WEB_ORIGIN ?? "http://localhost:3000",
        environment.API_PUBLIC_URL ?? "http://localhost:3001",
        ...additionalWebOriginsSchema.parse(environment.WEB_ADDITIONAL_ORIGINS),
      ].map((origin: string): string => new URL(origin).origin),
    ),
  ];
}
