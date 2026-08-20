import type { AgentAnalysis } from "@/domain/actions";

export type ChatAttachment = {
  uri?: string;
  label: string;
  isDemo: boolean;
};

export type ChatTurn = {
  note: string;
  attachments: ChatAttachment[];
};

export type ChatSession = {
  id: string;
  title: string;
  modelConfigId?: string;
  isPinned?: boolean;
  isTitleEdited?: boolean;
  turn: ChatTurn;
  analysis?: AgentAnalysis;
  /** Persisted failure text so a failed run survives session switches. */
  analysisError?: string;
  analysisDurationMs?: number;
  updatedAt: string;
};
