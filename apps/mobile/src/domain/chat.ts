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
  analysisDurationMs?: number;
  updatedAt: string;
};
