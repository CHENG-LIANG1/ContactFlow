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
  turn: ChatTurn;
  updatedAt: string;
};
