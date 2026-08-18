export type ActionType = "create_meeting" | "create_contact" | "update_contact";
export type ActionStatus = "proposed" | "executing" | "succeeded" | "failed";
export type Confidence = "high" | "medium" | "low";

export type Evidence = {
  source: "image" | "user_note" | "system_default";
  excerpt: string;
};

export type MeetingPayload = {
  title: string;
  contactName: string;
  startAt: string;
  endAt: string;
  location: string;
};

export type CreateContactPayload = {
  givenName: string;
  familyName: string;
  phone: string;
  company: string;
};

export type UpdateContactPayload = {
  contactName: string;
  company: string;
  jobTitle: string;
};

type ActionBase = {
  id: string;
  status: ActionStatus;
  confidence: Confidence;
  evidence: Evidence[];
  error?: string;
};

export type MeetingAction = ActionBase & {
  type: "create_meeting";
  payload: MeetingPayload;
};

export type CreateContactAction = ActionBase & {
  type: "create_contact";
  payload: CreateContactPayload;
};

export type UpdateContactAction = ActionBase & {
  type: "update_contact";
  payload: UpdateContactPayload;
};

export type ActionProposal =
  | MeetingAction
  | CreateContactAction
  | UpdateContactAction;

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

export type Insight = {
  id: string;
  title: string;
  body: string;
  evidence: string;
  createdAt: string;
};

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
