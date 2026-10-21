import { eq, asc } from "drizzle-orm";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { asSchema, convertToModelMessages } from "ai";
import { db, pool } from "../src/backend/db";
import { user, role, aiMessage } from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import { getCompanyIdentity } from "../src/backend/lib/company/identity";
import { loadConversationMessages } from "../src/backend/lib/ai/conversation-store";
import { loadAiPreference } from "../src/backend/lib/ai/user-preference";
import { readCompanyBudgetPolicy } from "../src/backend/lib/ai/tools/company-budget-tools";
import { buildAiTools } from "../src/backend/lib/ai/tools";
import { providerTools } from "../src/backend/lib/ai/tool-schema-compatibility";
import { buildSystemPrompt } from "../src/backend/lib/ai/prompts";
import type { AiToolContext } from "../src/backend/lib/ai/tools/context";
import { generationMessages, initialActiveTools } from "../src/backend/lib/ai/chat-context";

const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Disposable performance QA only");
const fixture = z
  .object({ ownerId: z.guid() })
  .parse(JSON.parse(readFileSync("/tmp/atria-ai-operational-fixture.json", "utf8")));
const owner = await db.query.user.findFirst({ where: eq(user.id, fixture.ownerId) });
if (!owner || owner.email !== "ai-role-owner@fixture.invalid")
  throw new Error("Synthetic QA Owner only");
const r = await db.query.role.findFirst({ where: eq(role.id, owner.roleId) }),
  access = await getRoleAccess(owner.roleId);
if (!r || !access) throw new Error("Actual access required");
const context: AiToolContext = {
  ...access,
  userId: owner.id,
  roleId: owner.roleId,
  roleName: r.name,
};
const conversationId = "8c3b39ca-5165-4b16-bac8-214a4dd94759";
const label = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .parse(process.argv[2] ?? "baseline");
const history = (await loadConversationMessages(conversationId)).slice(0, 24);
const probeText =
  "Ambil data terbaru dari sistem untuk Proyek Operasional QA: siapa PM-nya, nilai kontrak, realisasi dan sisa alokasi Material, saldo Rekening Operasional QA, serta stok fisik/tercadang/tersedia Panel Operasional QA di Gudang Operasional QA. Jangan menyimpan perubahan. Jawab singkat dengan angka yang tepat.";
const currentMessages = [
  ...history,
  {
    id: "performance-probe",
    role: "user" as const,
    parts: [{ type: "text" as const, text: probeText }],
  },
];
const preference = await loadAiPreference(owner.id),
  company = await getCompanyIdentity(),
  policy = await readCompanyBudgetPolicy(context);
const tools = providerTools(buildAiTools(context), "NINEROUTER");
const definitions = await Promise.all(
  Object.entries(tools).map(async ([name, tool]) => ({
    name,
    description: tool.description,
    parameters: await asSchema(tool.inputSchema).jsonSchema,
  })),
);
const selectedNames = initialActiveTools(currentMessages, Object.keys(tools));
const selectedDefinitions = definitions.filter((definition) =>
  selectedNames.includes(definition.name),
);
const system = buildSystemPrompt(
  "NINEROUTER",
  owner.name,
  context,
  preference,
  company.name,
  policy,
);
const messages = await convertToModelMessages(generationMessages(currentMessages));
const packet = { context, history, system, definitions, messages };
const directory = "../../output/ai-chat-qa/performance";
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/${label}-packet.json`, JSON.stringify(packet, null, 2));
const statistics = {
  label,
  toolCount: definitions.length,
  selectedToolCount: selectedDefinitions.length,
  systemCharacters: system.length,
  toolCharacters: JSON.stringify(selectedDefinitions).length,
  historyCharacters: JSON.stringify(messages).length,
  historyMessages: history.length,
  reasoningCharacters: history
    .flatMap((m) => m.parts)
    .filter((p) => p.type === "reasoning")
    .reduce((n, p) => n + ("text" in p ? String(p.text).length : 0), 0),
};
writeFileSync(`${directory}/${label}-sizes.json`, JSON.stringify(statistics, null, 2));
console.log(JSON.stringify(statistics));
if (label !== "baseline") {
  const baseline = z
    .object({ system: z.string(), definitions: z.array(z.unknown()) })
    .parse(JSON.parse(readFileSync(`${directory}/baseline-packet.json`, "utf8")));
  const originalMessages = await convertToModelMessages(currentMessages);
  const before = {
    systemCharacters: baseline.system.length,
    toolCharacters: JSON.stringify(baseline.definitions).length,
    historyCharacters: JSON.stringify(originalMessages).length,
    toolCount: baseline.definitions.length,
  };
  const after = {
    systemCharacters: system.length,
    toolCharacters: JSON.stringify(selectedDefinitions).length,
    historyCharacters: JSON.stringify(messages).length,
    toolCount: selectedDefinitions.length,
  };
  const beforeTotal = before.systemCharacters + before.toolCharacters + before.historyCharacters,
    afterTotal = after.systemCharacters + after.toolCharacters + after.historyCharacters;
  writeFileSync(
    `${directory}/context-comparison.json`,
    JSON.stringify(
      {
        before,
        after,
        beforeTotal,
        afterTotal,
        reductionPercent: Math.round((1 - afterTotal / beforeTotal) * 10000) / 100,
        measurement:
          "Same first24 stored messages plus identical current probe. Serialized character counts are not provider token billing.",
      },
      null,
      2,
    ),
  );
}
const observations = await db.query.aiMessage.findMany({
  where: eq(aiMessage.conversationId, conversationId),
  orderBy: asc(aiMessage.createdAt),
});
writeFileSync(
  `${directory}/${label}-observation.json`,
  JSON.stringify(
    observations.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
      createdAt: m.createdAt,
      provider: m.provider,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
    })),
    null,
    2,
  ),
);
await pool.end();
