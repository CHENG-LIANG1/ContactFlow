import type { ModelConfig } from "@/domain/model-config";
import type { UserProfile } from "@/domain/preferences";
import type { RelationshipContact } from "@/domain/relationship-memory";
import {
  RelationshipSummaryResultSchema,
  type RelationshipSummaryResult,
} from "@/domain/relationship-summary";
import { readModelApiKey } from "@/services/model-secrets";
import { requestStructuredOutput } from "@/services/openai-compatible-agent";

export type GenerateRelationshipSummaryInput = {
  config: ModelConfig;
  contact: RelationshipContact;
  locale: string;
  profile: UserProfile;
};

/** Summarizes a confirmed relationship using only local memory data. */
export async function generateRelationshipSummary({
  config,
  contact,
  locale,
  profile,
}: GenerateRelationshipSummaryInput): Promise<RelationshipSummaryResult> {
  const apiKey = await readModelApiKey(config.id);
  return requestStructuredOutput({
    apiKey: apiKey ?? "",
    config,
    jsonSchemaName: "contactflow_relationship_summary",
    schema: RelationshipSummaryResultSchema,
    systemPrompt: summaryPrompt(locale),
    userContent: JSON.stringify({
      contact: {
        company: contact.company ?? "",
        email: contact.email ?? "",
        facts: contact.facts.map((fact) => ({
          createdAt: fact.createdAt,
          label: fact.label,
          source: fact.source,
          value: fact.value,
        })),
        jobTitle: contact.jobTitle ?? "",
        meetings: contact.meetings.map((meeting) => ({
          executedAt: meeting.executedAt,
          scheduledAt: meeting.scheduledAt ?? "",
          title: meeting.title,
        })),
        name: contact.name,
        phone: contact.phone ?? "",
      },
      profile: { bio: profile.bio, name: profile.name },
    }),
  });
}

function summaryPrompt(locale: string) {
  return `You are ContactFlow, a relationship memory summarizer.
Return only the provided JSON schema in locale ${locale}.
Use only the supplied confirmed contact details, meetings, and memory facts; never invent people, dates, facts, or actions.
Format the "summary" field as Markdown optimized for quick scanning:
- Line 1: a one-sentence overview of the relationship.
- Then 3-5 bullet lines, each starting with "- " and opening with a **bold** key label (for example **当前角色**, **近期互动**, **已确认联系方式**), followed by one concise detail.
- End with a final "- **下一步**" bullet phrased strictly as a suggestion.
- Use **bold** only for key labels, names, and dates.
Do not mention JSON, schemas, or system internals.`;
}
