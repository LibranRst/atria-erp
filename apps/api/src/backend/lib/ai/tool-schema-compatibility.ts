import { asSchema, jsonSchema, type FlexibleSchema, type Schema, type ToolSet } from "ai";
import type { JSONSchema7, JSONSchema7Definition } from "@ai-sdk/provider";
import type { ChatProviderName } from "./providers";

function objectSchema(value: JSONSchema7Definition): value is JSONSchema7 {
  return typeof value === "object" && value.type === "object" && !!value.properties;
}

function mergeProperty(choices: JSONSchema7Definition[]): JSONSchema7Definition {
  const unique = choices.filter(
    (choice, index) =>
      choices.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(choice)) ===
      index,
  );
  if (unique.length === 1) return unique[0];
  if (
    unique.every(
      (choice) => typeof choice === "object" && (choice.const !== undefined || choice.enum),
    )
  ) {
    const values = unique.flatMap((choice) =>
      typeof choice === "object" ? (choice.enum ?? [choice.const ?? null]) : [],
    );
    const first = unique[0];
    const type = typeof first === "object" ? first.type : undefined;
    return {
      enum: [...new Set(values)],
      ...(type && unique.every((choice) => typeof choice === "object" && choice.type === type)
        ? { type }
        : {}),
    };
  }
  return exposeObjectUnions({ anyOf: unique });
}

/** Model hints only. Original SDK/Zod validation remains the execution boundary. */
function exposeObjectUnions(schema: JSONSchema7): JSONSchema7 {
  const branches = schema.oneOf ?? schema.anyOf;
  if (branches?.length && branches.every(objectSchema)) {
    const names = [...new Set(branches.flatMap((branch) => Object.keys(branch.properties ?? {})))];
    const properties = Object.fromEntries(
      names.map((name) => [
        name,
        mergeProperty(
          branches.flatMap((branch) => {
            const property = branch.properties?.[name];
            return property === undefined ? [] : [property];
          }),
        ),
      ]),
    );
    const required = (branches[0].required ?? []).filter((name) =>
      branches.every((branch) => branch.required?.includes(name)),
    );
    const descriptions = branches.map((branch) => {
      const discriminator = Object.entries(branch.properties ?? {}).find(
        ([, value]) => typeof value === "object" && value.const !== undefined,
      );
      const value = discriminator?.[1];
      const optional = Object.keys(branch.properties ?? {}).filter(
        (name) => !branch.required?.includes(name),
      );
      return `${typeof value === "object" ? String(value.const) : "Branch"}: required ${(branch.required ?? []).join(", ")}; optional ${optional.join(", ") || "none"}.`;
    });
    const rest = { ...schema };
    delete rest.oneOf;
    delete rest.anyOf;
    return exposeObjectUnions({
      ...rest,
      type: "object",
      properties,
      required,
      additionalProperties: false,
      description: [schema.description, ...descriptions].filter(Boolean).join(" "),
    });
  }
  const mapDefinition = (value: JSONSchema7Definition): JSONSchema7Definition =>
    typeof value === "boolean" ? value : exposeObjectUnions(value);
  return {
    ...schema,
    ...(schema.properties
      ? {
          properties: Object.fromEntries(
            Object.entries(schema.properties).map(([name, value]) => [name, mapDefinition(value)]),
          ),
        }
      : {}),
    ...(schema.items
      ? {
          items: Array.isArray(schema.items)
            ? schema.items.map(mapDefinition)
            : mapDefinition(schema.items),
        }
      : {}),
    ...(schema.oneOf ? { oneOf: schema.oneOf.map(mapDefinition) } : {}),
    ...(schema.anyOf ? { anyOf: schema.anyOf.map(mapDefinition) } : {}),
    ...(schema.allOf ? { allOf: schema.allOf.map(mapDefinition) } : {}),
  };
}

export function compatibleToolSchema<T>(input: FlexibleSchema<T>): Schema<T> {
  const original = asSchema(input);
  return jsonSchema(async () => exposeObjectUnions(await original.jsonSchema), {
    validate: original.validate,
  });
}

export function providerTools(tools: ToolSet, provider: ChatProviderName): ToolSet {
  if (provider !== "NINEROUTER") return tools;
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [
      name,
      {
        ...tool,
        inputSchema: compatibleToolSchema(tool.inputSchema),
      },
    ]),
  );
}
