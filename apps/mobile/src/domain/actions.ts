import { z } from "zod";

export const ActionTypeSchema = z.enum([
  "create_meeting",
  "create_contact",
  "update_contact",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const ActionStatusSchema = z.enum([
  "proposed",
  "executing",
  "succeeded",
  "failed",
]);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const EvidenceSchema = z.strictObject({
  source: z.enum([
    "image",
    "user_note",
    "confirmed_memory",
    "system_default",
  ]),
  sourceId: z.string().trim().min(1).max(120),
  excerpt: z.string().trim().min(1).max(160),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

const isoDateTime = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date-time");

const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .refine(
    (value) => value.length === 0 || z.email().safeParse(value).success,
    "Invalid email",
  );

export const MeetingPayloadSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(120),
    contactName: z.string().trim().min(1).max(80),
    startAt: isoDateTime,
    endAt: isoDateTime,
    location: z.string().trim().max(200),
  })
  .refine(
    (payload) => Date.parse(payload.endAt) > Date.parse(payload.startAt),
    { message: "Meeting end must be after start", path: ["endAt"] },
  );
export type MeetingPayload = z.infer<typeof MeetingPayloadSchema>;

export const CreateContactPayloadSchema = z
  .strictObject({
    givenName: z.string().trim().max(80),
    familyName: z.string().trim().max(80),
    phone: z.string().trim().min(3).max(40),
    company: z.string().trim().max(120),
    email: optionalEmail,
  })
  .refine((payload) => Boolean(payload.givenName || payload.familyName), {
    message: "At least one contact name is required",
    path: ["givenName"],
  });
export type CreateContactPayload = z.infer<
  typeof CreateContactPayloadSchema
>;

export const UpdateContactPayloadSchema = z.strictObject({
  contactName: z.string().trim().min(1).max(80),
  company: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().min(1).max(120),
  email: optionalEmail,
});
export type UpdateContactPayload = z.infer<
  typeof UpdateContactPayloadSchema
>;

const ModelActionBaseSchema = z.strictObject({
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema).min(1).max(5),
});

export const ModelActionDraftSchema = z.discriminatedUnion("type", [
  ModelActionBaseSchema.extend({
    type: z.literal("create_meeting"),
    payload: MeetingPayloadSchema,
  }),
  ModelActionBaseSchema.extend({
    type: z.literal("create_contact"),
    payload: CreateContactPayloadSchema,
  }),
  ModelActionBaseSchema.extend({
    type: z.literal("update_contact"),
    payload: UpdateContactPayloadSchema,
  }),
]);
export type ModelActionDraft = z.infer<typeof ModelActionDraftSchema>;

export const AnalysisNoticeSchema = z.strictObject({
  code: z.enum([
    "NO_ACTION",
    "AMBIGUOUS_TIME",
    "LOW_IMAGE_QUALITY",
    "MODEL_REFUSAL",
  ]),
  message: z.string().trim().min(1).max(240),
});
export type AnalysisNotice = z.infer<typeof AnalysisNoticeSchema>;

export const AnalysisResultSchema = z.strictObject({
  contextSummary: z.string().trim().max(500),
  participantNames: z.array(z.string().trim().min(1).max(80)).max(12),
  proposals: z.array(ModelActionDraftSchema).max(8),
  notices: z.array(AnalysisNoticeSchema).max(6),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const InsightDraftSchema = z.strictObject({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(360),
  evidenceIds: z.array(z.string().trim().min(1).max(120)).min(1).max(5),
});
export type InsightDraft = z.infer<typeof InsightDraftSchema>;

export const InsightResultSchema = z.strictObject({
  insights: z.array(InsightDraftSchema).min(1).max(3),
});
export type InsightResult = z.infer<typeof InsightResultSchema>;

type RuntimeAction = {
  id: string;
  status: ActionStatus;
  error?: string;
};

export type MeetingAction = Extract<
  ModelActionDraft,
  { type: "create_meeting" }
> &
  RuntimeAction;
export type CreateContactAction = Extract<
  ModelActionDraft,
  { type: "create_contact" }
> &
  RuntimeAction;
export type UpdateContactAction = Extract<
  ModelActionDraft,
  { type: "update_contact" }
> &
  RuntimeAction;

export type ActionProposal =
  | MeetingAction
  | CreateContactAction
  | UpdateContactAction;

export type AgentAnalysis = Omit<AnalysisResult, "proposals"> & {
  actions: ActionProposal[];
};

export type NativeReceipt = {
  nativeObjectId: string;
  executedAt: string;
};

export type HistoryRecord = {
  id: string;
  actionId: string;
  type: ActionType;
  title: string;
  contactName: string;
  executedAt: string;
  nativeObjectId: string;
};

export type MemoryFact = {
  id: string;
  contactName: string;
  label: string;
  value: string;
  source: string;
  createdAt: string;
};

export type Insight = InsightDraft & {
  id: string;
  createdAt: string;
};

export function normalizeActionProposal(
  action: ActionProposal,
): ActionProposal {
  if (action.type !== "create_contact") return action;

  const { familyName, givenName } = action.payload;
  const isSingleLatinName = /^[A-Za-zÀ-ÖØ-öø-ÿ'’-]+$/.test(givenName);
  if (
    isSingleLatinName &&
    familyName.localeCompare(givenName, undefined, { sensitivity: "accent" }) ===
      0
  ) {
    // Vision models sometimes copy a single Western name into both fields.
    // Keep the evidenced token once instead of writing a fabricated full name.
    return {
      ...action,
      payload: { ...action.payload, familyName: "" },
    };
  }
  return action;
}

/** Runtime ids and execution state are assigned locally, never by the model. */
export function proposalsFromAnalysis(
  analysis: AnalysisResult,
  now = new Date(),
): ActionProposal[] {
  const stamp = now.getTime();
  return analysis.proposals.map((proposal, index) => {
    const action = {
      ...proposal,
      id: `action-${stamp}-${index}`,
      status: "proposed" as const,
    } as ActionProposal;
    return normalizeActionProposal(action);
  });
}

export function isActionValidForExecution(action: ActionProposal) {
  return ModelActionDraftSchema.safeParse({
    confidence: action.confidence,
    evidence: action.evidence,
    payload: action.payload,
    type: action.type,
  }).success;
}

export function actionTitle(action: ActionProposal): string {
  if (action.type === "create_meeting") return action.payload.title;
  if (action.type === "create_contact") {
    return `保存 ${action.payload.familyName}${action.payload.givenName}`;
  }
  return `更新 ${action.payload.contactName}`;
}

export function actionContactName(action: ActionProposal): string {
  if (action.type === "create_meeting") return action.payload.contactName;
  if (action.type === "create_contact") {
    return `${action.payload.familyName}${action.payload.givenName}`;
  }
  return action.payload.contactName;
}
