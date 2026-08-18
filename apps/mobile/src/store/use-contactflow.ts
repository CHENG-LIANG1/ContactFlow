import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  actionContactName,
  actionTitle,
  type ActionProposal,
  type HistoryRecord,
  type Insight,
  type MemoryFact,
  type NativeReceipt,
} from "@/domain/actions";
import type { ChatSession } from "@/domain/chat";
import type {
  AccentId,
  AppLanguage,
  UserProfile,
} from "@/domain/preferences";

type ContactFlowState = {
  actions: ActionProposal[];
  history: HistoryRecord[];
  memories: MemoryFact[];
  insights: Insight[];
  chatSessions: ChatSession[];
  language: AppLanguage;
  accentId: AccentId;
  profile: UserProfile;
  setActions: (actions: ActionProposal[]) => void;
  updateActionPayload: (id: string, patch: Record<string, string>) => void;
  setActionExecuting: (id: string) => void;
  failAction: (id: string, error: string) => void;
  completeAction: (id: string, receipt: NativeReceipt) => void;
  saveChatSession: (session: ChatSession) => void;
  setLanguage: (language: AppLanguage) => void;
  setAccentId: (accentId: AccentId) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  clearChatCache: () => void;
  clearLocalData: () => void;
};

function memoryFromAction(
  action: ActionProposal,
  executedAt: string,
): MemoryFact {
  const contactName = actionContactName(action);
  if (action.type === "create_meeting") {
    return {
      id: `memory-${action.id}`,
      contactName,
      label: "下一次互动",
      value: new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(action.payload.startAt)),
      source: "已确认的日历事件",
      createdAt: executedAt,
    };
  }

  if (action.type === "create_contact") {
    return {
      id: `memory-${action.id}`,
      contactName,
      label: "联系方式",
      value: action.payload.phone,
      source: "已确认的新联系人",
      createdAt: executedAt,
    };
  }

  return {
    id: `memory-${action.id}`,
    contactName,
    label: "当前角色",
    value: `${action.payload.jobTitle} · ${action.payload.company}`,
    source: "已确认的联系人更新",
    createdAt: executedAt,
  };
}

export const useContactFlow = create<ContactFlowState>()(
  persist(
    (set) => ({
      actions: [],
      history: [],
      memories: [],
      insights: [],
      chatSessions: [],
      language: "zh",
      accentId: "paper",
      profile: {
        name: "ContactFlow 用户",
        bio: "让每段关系都有下一步",
        email: "",
      },
      setActions: (actions) => set({ actions, insights: [] }),
      updateActionPayload: (id, patch) =>
        set((state) => ({
          actions: state.actions.map((action) =>
            action.id === id
              ? ({
                  ...action,
                  payload: { ...action.payload, ...patch },
                } as ActionProposal)
              : action,
          ),
        })),
      setActionExecuting: (id) =>
        set((state) => ({
          actions: state.actions.map((action) =>
            action.id === id
              ? { ...action, status: "executing", error: undefined }
              : action,
          ),
        })),
      failAction: (id, error) =>
        set((state) => ({
          actions: state.actions.map((action) =>
            action.id === id ? { ...action, status: "failed", error } : action,
          ),
        })),
      completeAction: (id, receipt) =>
        set((state) => {
          const action = state.actions.find((candidate) => candidate.id === id);
          if (!action) return state;
          const contactName = actionContactName(action);
          const record: HistoryRecord = {
            id: `history-${action.id}`,
            actionId: action.id,
            type: action.type,
            title: actionTitle(action),
            contactName,
            executedAt: receipt.executedAt,
            nativeObjectId: receipt.nativeObjectId,
          };
          const memory = memoryFromAction(action, receipt.executedAt);
          const insight: Insight = {
            id: `insight-${action.id}`,
            title:
              action.type === "create_meeting"
                ? "把承诺带进会面"
                : "关系信息已补全",
            body:
              action.type === "create_meeting"
                ? `你已经安排与 ${contactName} 的下一次互动。建议会前回看本次聊天里提到的演示重点。`
                : `${contactName} 的确认资料已写入系统，后续行动会优先使用这次确认后的信息。`,
            evidence: memory.value,
            createdAt: receipt.executedAt,
          };
          return {
            actions: state.actions.map((candidate) =>
              candidate.id === id
                ? { ...candidate, status: "succeeded" }
                : candidate,
            ),
            history: [
              record,
              ...state.history.filter((item) => item.actionId !== action.id),
            ],
            memories: [
              memory,
              ...state.memories.filter((item) => item.id !== memory.id),
            ],
            insights: [
              insight,
              ...state.insights.filter((item) => item.id !== insight.id),
            ],
          };
        }),
      saveChatSession: (session) =>
        set((state) => ({
          chatSessions: [
            session,
            ...state.chatSessions.filter((item) => item.id !== session.id),
          ],
        })),
      setLanguage: (language) => set({ language }),
      setAccentId: (accentId) => set({ accentId }),
      updateProfile: (patch) =>
        set((state) => ({ profile: { ...state.profile, ...patch } })),
      clearChatCache: () =>
        set({ actions: [], insights: [], chatSessions: [] }),
      clearLocalData: () =>
        set({
          actions: [],
          history: [],
          memories: [],
          insights: [],
          chatSessions: [],
        }),
    }),
    {
      name: "contactflow:mvp:v1",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const restored = persistedState as Partial<ContactFlowState>;
        return {
          ...currentState,
          ...restored,
          chatSessions: restored.chatSessions ?? currentState.chatSessions,
          language: restored.language ?? currentState.language,
          accentId: restored.accentId ?? currentState.accentId,
          profile: {
            ...currentState.profile,
            ...restored.profile,
          },
        };
      },
      partialize: (state) => ({
        actions: state.actions,
        history: state.history,
        memories: state.memories,
        insights: state.insights,
        chatSessions: state.chatSessions,
        language: state.language,
        accentId: state.accentId,
        profile: state.profile,
      }),
    },
  ),
);
