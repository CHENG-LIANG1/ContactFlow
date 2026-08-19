import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  actionContactName,
  actionTitle,
  normalizeActionProposal,
  normalizeInsight,
  type AgentAnalysis,
  type ActionProposal,
  type HistoryRecord,
  type Insight,
  type MemoryFact,
  type NativeReceipt,
} from "@/domain/actions";
import type { ChatSession } from "@/domain/chat";
import {
  resolveModelConfig,
  type ModelConfig,
  type ModelConfigInput,
} from "@/domain/model-config";
import type {
  AgentPermissionMode,
  AppLanguage,
  ThemeMode,
  UserProfile,
} from "@/domain/preferences";
import { deleteModelApiKey, saveModelApiKey } from "@/services/model-secrets";

type ContactFlowState = {
  actions: ActionProposal[];
  history: HistoryRecord[];
  memories: MemoryFact[];
  insights: Insight[];
  chatSessions: ChatSession[];
  modelConfigs: ModelConfig[];
  selectedModelConfigId: string | null;
  permissionMode: AgentPermissionMode;
  language: AppLanguage;
  themeMode: ThemeMode;
  profile: UserProfile;
  setActions: (actions: ActionProposal[]) => void;
  updateActionPayload: (id: string, patch: Record<string, string>) => void;
  setActionExecuting: (id: string) => void;
  failAction: (id: string, error: string) => void;
  completeAction: (id: string, receipt: NativeReceipt) => MemoryFact | null;
  setInsights: (insights: Insight[]) => void;
  saveChatSession: (session: ChatSession) => void;
  updateChatSessionAnalysis: (
    id: string,
    analysis: AgentAnalysis,
    durationMs?: number,
  ) => void;
  toggleChatSessionPinned: (id: string) => void;
  renameChatSession: (id: string, title: string) => void;
  deleteChatSession: (id: string) => void;
  deleteContactMemory: (contactName: string) => void;
  createModelConfig: (input: ModelConfigInput) => Promise<string>;
  updateModelConfig: (id: string, input: ModelConfigInput) => Promise<void>;
  deleteModelConfig: (id: string) => Promise<void>;
  selectModelConfig: (id: string) => void;
  setPermissionMode: (permissionMode: AgentPermissionMode) => void;
  setLanguage: (language: AppLanguage) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
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
    value: [
      `${action.payload.jobTitle} · ${action.payload.company}`,
      action.payload.email,
    ]
      .filter(Boolean)
      .join(" · "),
    source: "已确认的联系人更新",
    createdAt: executedAt,
  };
}

export const useContactFlow = create<ContactFlowState>()(
  persist(
    (set, get) => ({
      actions: [],
      history: [],
      memories: [],
      insights: [],
      chatSessions: [],
      modelConfigs: [],
      selectedModelConfigId: null,
      permissionMode: "ask",
      language: "zh",
      themeMode: "light",
      profile: {
        name: "Ray",
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
      completeAction: (id, receipt) => {
        const action = get().actions.find((candidate) => candidate.id === id);
        if (!action) return null;
        const memory = memoryFromAction(action, receipt.executedAt);
        set((state) => {
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
          };
        });
        return memory;
      },
      setInsights: (insights) => set({ insights }),
      saveChatSession: (session) =>
        set((state) => {
          const existing = state.chatSessions.find(
            (item) => item.id === session.id,
          );
          const nextSession: ChatSession = {
            ...session,
            isPinned: existing?.isPinned,
            isTitleEdited: existing?.isTitleEdited,
            title: existing?.isTitleEdited ? existing.title : session.title,
          };
          return {
            chatSessions: [
              nextSession,
              ...state.chatSessions.filter((item) => item.id !== session.id),
            ],
          };
        }),
      updateChatSessionAnalysis: (id, analysis, durationMs) =>
        set((state) => ({
          chatSessions: state.chatSessions.map((session) =>
            session.id === id
              ? {
                  ...session,
                  analysis,
                  ...(durationMs !== undefined
                    ? { analysisDurationMs: durationMs }
                    : {}),
                  updatedAt: new Date().toISOString(),
                }
              : session,
          ),
        })),
      toggleChatSessionPinned: (id) =>
        set((state) => ({
          chatSessions: state.chatSessions.map((session) =>
            session.id === id
              ? { ...session, isPinned: !session.isPinned }
              : session,
          ),
        })),
      renameChatSession: (id, title) =>
        set((state) => ({
          chatSessions: state.chatSessions.map((session) =>
            session.id === id
              ? { ...session, title, isTitleEdited: true }
              : session,
          ),
        })),
      deleteChatSession: (id) =>
        set((state) => ({
          chatSessions: state.chatSessions.filter(
            (session) => session.id !== id,
          ),
        })),
      deleteContactMemory: (contactName) =>
        set((state) => {
          const target = contactName.trim().toLocaleLowerCase();
          const belongsToContact = (name: string) =>
            name.trim().toLocaleLowerCase() === target;
          return {
            history: state.history.filter(
              (record) => !belongsToContact(record.contactName),
            ),
            memories: state.memories.filter(
              (memory) => !belongsToContact(memory.contactName),
            ),
          };
        }),
      createModelConfig: async (input) => {
        const now = new Date().toISOString();
        const id = `model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const apiKey = input.apiKey?.trim() ?? "";
        if (apiKey) await saveModelApiKey(id, apiKey);
        const config: ModelConfig = {
          id,
          provider: input.provider,
          model: input.model.trim(),
          baseUrl: input.baseUrl.trim().replace(/\/$/, ""),
          hasApiKey: Boolean(apiKey),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => {
          const modelConfigs = [...state.modelConfigs, config];
          return {
            modelConfigs,
            selectedModelConfigId:
              resolveModelConfig(modelConfigs, state.selectedModelConfigId)
                ?.id ?? null,
          };
        });
        return id;
      },
      updateModelConfig: async (id, input) => {
        const apiKey = input.apiKey?.trim() ?? "";
        if (apiKey) await saveModelApiKey(id, apiKey);
        set((state) => ({
          modelConfigs: state.modelConfigs.map((config) =>
            config.id === id
              ? {
                  ...config,
                  provider: input.provider,
                  model: input.model.trim(),
                  baseUrl: input.baseUrl.trim().replace(/\/$/, ""),
                  hasApiKey: apiKey ? true : config.hasApiKey,
                  updatedAt: new Date().toISOString(),
                }
              : config,
          ),
        }));
      },
      deleteModelConfig: async (id) => {
        await deleteModelApiKey(id);
        set((state) => {
          const modelConfigs = state.modelConfigs.filter(
            (config) => config.id !== id,
          );
          const selectedModelConfigId =
            state.selectedModelConfigId === id
              ? (modelConfigs[0]?.id ?? null)
              : (resolveModelConfig(modelConfigs, state.selectedModelConfigId)
                  ?.id ?? null);
          return { modelConfigs, selectedModelConfigId };
        });
      },
      selectModelConfig: (id) =>
        set((state) => ({
          selectedModelConfigId:
            state.modelConfigs.find((config) => config.id === id)?.id ??
            state.modelConfigs[0]?.id ??
            null,
        })),
      setPermissionMode: (permissionMode) => set({ permissionMode }),
      setLanguage: (language) => set({ language }),
      setThemeMode: (themeMode) => set({ themeMode }),
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
        const chatSessions = (
          restored.chatSessions ?? currentState.chatSessions
        ).map((session) =>
          session.analysis
            ? {
                ...session,
                analysis: {
                  ...session.analysis,
                  actions: session.analysis.actions.map(
                    normalizeActionProposal,
                  ),
                },
              }
            : session,
        );
        return {
          ...currentState,
          ...restored,
          actions: (restored.actions ?? currentState.actions).map(
            normalizeActionProposal,
          ),
          insights: (restored.insights ?? currentState.insights).map(
            normalizeInsight,
          ),
          chatSessions,
          modelConfigs: restored.modelConfigs ?? currentState.modelConfigs,
          selectedModelConfigId:
            resolveModelConfig(
              restored.modelConfigs ?? currentState.modelConfigs,
              restored.selectedModelConfigId ?? null,
            )?.id ?? null,
          permissionMode:
            restored.permissionMode ?? currentState.permissionMode,
          language: restored.language ?? currentState.language,
          themeMode: restored.themeMode ?? currentState.themeMode,
          profile: {
            ...currentState.profile,
            ...restored.profile,
            name: ["ContactFlow 用户", "Louis"].includes(
              restored.profile?.name ?? "",
            )
              ? "Ray"
              : (restored.profile?.name ?? currentState.profile.name),
          },
        };
      },
      partialize: (state) => ({
        actions: state.actions,
        history: state.history,
        memories: state.memories,
        insights: state.insights,
        chatSessions: state.chatSessions,
        modelConfigs: state.modelConfigs,
        selectedModelConfigId: state.selectedModelConfigId,
        permissionMode: state.permissionMode,
        language: state.language,
        themeMode: state.themeMode,
        profile: state.profile,
      }),
    },
  ),
);
