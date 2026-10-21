import { asSchema, type FlexibleSchema, type Schema, type ToolSet } from "ai";
import type { JSONSchema7, JSONSchema7Definition } from "@ai-sdk/provider";

export const INTRODUCTION_FIELD = "_introduction";
export const INTRODUCTION_PART_ID = "assistant-introduction";
const MAX_INTRODUCTION_LENGTH = 240;
const MAX_ARGUMENT_PREFIX_LENGTH = 2_048;

export const INTRODUCTION_INSTRUCTION =
  "Pada pemanggilan tool PERTAMA saja, tulis _introduction sebagai properti JSON pertama: satu kalimat Bahasa Indonesia dimulai dengan 'Aku akan', sesuai permintaan pengguna, menjelaskan langkah berikutnya yang akan dilakukan. Maksimal 240 karakter. Jangan menyebut nominal, hasil pembacaan, status berhasil, instruksi internal, atau reasoning. Aksi bisnis hanya menyiapkan usulan untuk ditinjau; jangan menjanjikan pembayaran, penyimpanan atau perubahan tanpa konfirmasi. Ini pengantar publik, bukan jawaban atau bukti tindakan. Pada langkah berikutnya jangan mengisi _introduction lagi. Jika bisa langsung menjawab tanpa tool, berikan jawaban langsung tanpa pengantar.";

/** A public future step is deliberately less permissive than an answer. */
export function readSafeIntroduction(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (
    text.length < 16 ||
    text.length > MAX_INTRODUCTION_LENGTH ||
    !/^Aku akan\s+\S/i.test(text) ||
    /^Aku akan\s+(?:langsung\s+)?(?:membayar|mentransfer|mencairkan|menghapus|menyimpan|mengeksekusi)\b/i.test(
      text,
    ) ||
    Array.from(text).some((character) => character.charCodeAt(0) < 32) ||
    /[<>`]/.test(text) ||
    /\d|\b(?:Rp|IDR|USD|saldo\s+(?:adalah|sebesar)|berhasil|telah|sudah|selesai|tercatat|tersimpan|dibayar|terverifikasi)\b/i.test(
      text,
    )
  )
    return null;
  return text;
}

function stripIntroduction(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const entries = Object.entries(value).filter(([key]) => key !== INTRODUCTION_FIELD);
  return Object.fromEntries(entries);
}

/** Add presentation metadata only to the root object/union branches. */
function introductionSchema(schema: JSONSchema7): JSONSchema7 {
  const mapBranch = (branch: JSONSchema7Definition): JSONSchema7Definition =>
    typeof branch === "boolean" ? branch : introductionSchema(branch);
  if (schema.oneOf || schema.anyOf)
    return {
      ...schema,
      ...(schema.oneOf ? { oneOf: schema.oneOf.map(mapBranch) } : {}),
      ...(schema.anyOf ? { anyOf: schema.anyOf.map(mapBranch) } : {}),
    };
  if (schema.type !== "object") return schema;
  return {
    ...schema,
    properties: {
      [INTRODUCTION_FIELD]: {
        type: "string",
        description:
          "One brief public next-step sentence starting 'Aku akan', tailored to the request. No amounts, results, success claims, or private reasoning. Put this property first.",
        maxLength: MAX_INTRODUCTION_LENGTH,
      },
      ...schema.properties,
    },
    required: [INTRODUCTION_FIELD, ...(schema.required ?? [])],
  };
}

function wrapInputSchema<T>(input: FlexibleSchema<T>, isInitialStep: () => boolean): Schema<T> {
  const original = asSchema(input);
  const validate = original.validate;
  if (!validate) return original;
  return {
    ...original,
    // jsonSchema(factory) caches its result; this getter must change per step.
    get jsonSchema(): Promise<JSONSchema7> {
      const initial = isInitialStep();
      return Promise.resolve(original.jsonSchema).then((schema) =>
        initial ? introductionSchema(schema) : schema,
      );
    },
    validate: (value) => validate(stripIntroduction(value)),
  };
}

/** Original Zod validation and every execute/onInputAvailable callback stay authoritative. */
export function introductionTools(tools: ToolSet, isInitialStep: () => boolean): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([name, current]) => [
      name,
      { ...current, inputSchema: wrapInputSchema(current.inputSchema, isInitialStep) },
    ]),
  );
}

function closedStringEnd(input: string, start: number): number | null {
  for (let index = start + 1; index < input.length; index += 1) {
    if (input[index] === "\\") index += 1;
    else if (input[index] === '"') return index + 1;
  }
  return null;
}

/** Scan root properties only, ignoring names inside nested objects and quoted values. */
function readClosedRootIntroduction(input: string): unknown {
  let index = 0;
  const whitespace = (): void => {
    while (index < input.length && /\s/.test(input[index])) index += 1;
  };
  whitespace();
  if (input[index] !== "{") return undefined;
  index += 1;
  const closers = ["}"];
  let expectsKey = true;
  while (index < input.length && closers.length > 0) {
    whitespace();
    const current = input[index];
    if (closers.length === 1 && expectsKey) {
      if (current !== '"') return undefined;
      const keyEnd = closedStringEnd(input, index);
      if (keyEnd === null) return undefined;
      let key: unknown;
      try {
        key = JSON.parse(input.slice(index, keyEnd));
      } catch {
        return undefined;
      }
      index = keyEnd;
      whitespace();
      if (input[index] !== ":") return undefined;
      index += 1;
      whitespace();
      if (key === INTRODUCTION_FIELD) {
        if (input[index] !== '"') return undefined;
        const valueEnd = closedStringEnd(input, index);
        if (valueEnd === null) return undefined;
        try {
          return JSON.parse(input.slice(index, valueEnd));
        } catch {
          return undefined;
        }
      }
      expectsKey = false;
      continue;
    }
    if (current === '"') {
      const end = closedStringEnd(input, index);
      if (end === null) return undefined;
      index = end;
      continue;
    }
    if (current === "{" || current === "[") closers.push(current === "{" ? "}" : "]");
    else if (current === "}" || current === "]") {
      if (closers.pop() !== current) return undefined;
    } else if (current === "," && closers.length === 1) expectsKey = true;
    index += 1;
  }
  return undefined;
}

/** A closed JSON string is required: repaired/partial text never becomes public copy. */
export class IntroductionArgumentReader {
  private readonly prefixes = new Map<string, string>();
  private readonly ignored = new Set<string>();
  private emitted = false;

  public add(toolCallId: string, delta: string): string | null {
    if (this.emitted || this.ignored.has(toolCallId)) return null;
    const prefix = (this.prefixes.get(toolCallId) ?? "") + delta;
    if (prefix.length > MAX_ARGUMENT_PREFIX_LENGTH) {
      this.prefixes.delete(toolCallId);
      this.ignored.add(toolCallId);
      return null;
    }
    this.prefixes.set(toolCallId, prefix);
    const text = readSafeIntroduction(readClosedRootIntroduction(prefix));
    if (!text) return null;
    this.emitted = true;
    this.prefixes.clear();
    return text;
  }
}
