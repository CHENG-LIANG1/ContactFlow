import { z } from "zod";

export type RelationshipSummary = {
  contactId: string;
  contactName: string;
  content: string;
  modelName: string;
  generatedAt: string;
  viewed: boolean;
};

export const RelationshipSummaryResultSchema = z.object({
  summary: z.string(),
});

export type RelationshipSummaryResult = z.infer<
  typeof RelationshipSummaryResultSchema
>;
