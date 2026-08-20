import { beforeEach, describe, expect, it, vi } from "vitest";
import * as SecureStore from "expo-secure-store";

import type { ChatSession } from "@/domain/chat";
import type { ActionProposal } from "@/domain/actions";
import type { RelationshipContact } from "@/domain/relationship-memory";
import { useContactFlow } from "@/store/use-contactflow";
import { generateRelationshipSummary } from "@/services/relationship-summary-agent";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

vi.mock("expo-secure-store", () => ({
  setItemAsync: vi.fn(async () => undefined),
  getItemAsync: vi.fn(async () => null),
  deleteItemAsync: vi.fn(async () => undefined),
}));

vi.mock("@/services/relationship-summary-agent", () => ({
  generateRelationshipSummary: vi.fn(),
}));

vi.mock("@/services/openai-compatible-agent", () => ({
  agentErrorMessage: vi.fn(
    (error: unknown) =>
      `agent-error:${error instanceof Error ? error.message : "unknown"}`,
  ),
}));

function session(id: string, title: string): ChatSession {
  return {
    id,
    title,
    turn: { note: title, attachments: [] },
    updatedAt: "2026-08-19T00:00:00.000Z",
  };
}

describe("chat session management", () => {
  beforeEach(() => {
    useContactFlow.setState({ chatSessions: [] });
  });

  it("pins, renames, and deletes a saved session", () => {
    const store = useContactFlow.getState();
    store.saveChatSession(session("chat-1", "Original"));
    useContactFlow.getState().toggleChatSessionPinned("chat-1");
    useContactFlow.getState().renameChatSession("chat-1", "Renamed");

    expect(useContactFlow.getState().chatSessions[0]).toMatchObject({
      id: "chat-1",
      isPinned: true,
      isTitleEdited: true,
      title: "Renamed",
    });

    useContactFlow.getState().deleteChatSession("chat-1");
    expect(useContactFlow.getState().chatSessions).toEqual([]);
  });

  it("preserves pin and a manually edited title when the chat is saved again", () => {
    useContactFlow.getState().saveChatSession(session("chat-1", "Original"));
    useContactFlow.getState().toggleChatSessionPinned("chat-1");
    useContactFlow.getState().renameChatSession("chat-1", "Manual title");
    useContactFlow
      .getState()
      .saveChatSession(session("chat-1", "Generated title"));

    expect(useContactFlow.getState().chatSessions[0]).toMatchObject({
      isPinned: true,
      isTitleEdited: true,
      title: "Manual title",
    });
  });

  it("persists model analysis so opening history does not require regeneration", () => {
    useContactFlow.getState().saveChatSession(session("chat-1", "Live result"));
    useContactFlow.getState().updateChatSessionAnalysis("chat-1", {
      actions: [],
      contextSummary: "模型已经分析完成",
      notices: [{ code: "NO_ACTION", message: "没有可执行动作" }],
      participantNames: [],
      thinking: "没有可执行动作。",
    });

    expect(useContactFlow.getState().chatSessions[0].analysis).toEqual({
      actions: [],
      contextSummary: "模型已经分析完成",
      notices: [{ code: "NO_ACTION", message: "没有可执行动作" }],
      participantNames: [],
      thinking: "没有可执行动作。",
    });
  });
});

describe("confirmed memory", () => {
  it("writes memory only after success and never inserts a fixed insight", () => {
    const action: ActionProposal = {
      confidence: "high",
      evidence: [
        {
          excerpt: "周宁 · 13800138000",
          source: "user_note",
          sourceId: "user_note",
        },
      ],
      id: "action-contact",
      payload: {
        company: "",
        familyName: "周",
        givenName: "宁",
        phone: "13800138000",
        email: "",
      },
      status: "proposed",
      type: "create_contact",
    };
    useContactFlow.setState({ actions: [action], insights: [], memories: [] });

    expect(useContactFlow.getState().memories).toEqual([]);
    const memory = useContactFlow.getState().completeAction(action.id, {
      executedAt: "2026-08-19T01:00:00.000Z",
      nativeObjectId: "native-contact-1",
    });

    expect(memory).toMatchObject({ contactName: "周宁", value: "13800138000" });
    expect(useContactFlow.getState().memories).toHaveLength(1);
    expect(useContactFlow.getState().insights).toEqual([]);
  });

  it("deletes memory and activity for only the selected contact", () => {
    useContactFlow.setState({
      chatSessions: [session("chat-preserved", "Taylor chat")],
      history: [
        {
          actionId: "action-taylor",
          contactName: "Taylor",
          executedAt: "2026-08-19T01:00:00.000Z",
          id: "history-taylor",
          nativeObjectId: "native-taylor",
          title: "Taylor meeting",
          type: "create_meeting",
        },
        {
          actionId: "action-lin",
          contactName: "林澈",
          executedAt: "2026-08-19T02:00:00.000Z",
          id: "history-lin",
          nativeObjectId: "native-lin",
          title: "林澈 meeting",
          type: "create_meeting",
        },
      ],
      memories: [
        {
          contactName: "Taylor",
          createdAt: "2026-08-19T01:00:00.000Z",
          id: "memory-taylor",
          label: "下一次互动",
          source: "已确认的日历事件",
          value: "8月21日 15:00",
        },
        {
          contactName: "林澈",
          createdAt: "2026-08-19T02:00:00.000Z",
          id: "memory-lin",
          label: "下一次互动",
          source: "已确认的日历事件",
          value: "8月25日 10:00",
        },
      ],
    });

    useContactFlow.getState().deleteContactMemory("Taylor");

    expect(useContactFlow.getState().memories.map((item) => item.contactName)).toEqual(["林澈"]);
    expect(useContactFlow.getState().history.map((item) => item.contactName)).toEqual(["林澈"]);
    expect(useContactFlow.getState().chatSessions).toHaveLength(1);
  });
});

describe("BYOK model management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useContactFlow.setState({
      modelConfigs: [],
      selectedModelConfigId: null,
    });
  });

  it("uses the first model as fallback and keeps API keys out of state", async () => {
    const firstId = await useContactFlow.getState().createModelConfig({
      provider: "openai",
      model: "gpt-test",
      baseUrl: "https://api.openai.com/v1/",
      apiKey: " secret-key ",
    });
    const secondId = await useContactFlow.getState().createModelConfig({
      provider: "anthropic",
      model: "claude-test",
      baseUrl: "https://api.anthropic.com",
      apiKey: "backup-key",
    });

    const state = useContactFlow.getState();
    expect(state.selectedModelConfigId).toBe(firstId);
    expect(state.modelConfigs[0]).toMatchObject({
      id: firstId,
      baseUrl: "https://api.openai.com/v1",
      hasApiKey: true,
    });
    expect(state.modelConfigs[0]).not.toHaveProperty("apiKey");
    expect(state.modelConfigs[0]).not.toHaveProperty("name");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      `contactflow.model-key.${firstId}`,
      "secret-key",
    );

    state.selectModelConfig(secondId);
    expect(useContactFlow.getState().selectedModelConfigId).toBe(secondId);
  });

  it("updates metadata, preserves an existing key, and falls back after delete", async () => {
    const firstId = await useContactFlow.getState().createModelConfig({
      provider: "openai",
      model: "gpt-old",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "first-key",
    });
    const secondId = await useContactFlow.getState().createModelConfig({
      provider: "deepseek",
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com",
      apiKey: "second-key",
    });
    useContactFlow.getState().selectModelConfig(secondId);

    await useContactFlow.getState().updateModelConfig(secondId, {
      provider: "deepseek",
      model: "deepseek-reasoner",
      baseUrl: "https://api.deepseek.com",
      apiKey: "",
    });
    expect(
      useContactFlow
        .getState()
        .modelConfigs.find((config) => config.id === secondId),
    ).toMatchObject({
      model: "deepseek-reasoner",
      hasApiKey: true,
    });

    await useContactFlow.getState().deleteModelConfig(secondId);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      `contactflow.model-key.${secondId}`,
    );
    expect(useContactFlow.getState().selectedModelConfigId).toBe(firstId);
  });
});

describe("agent permission preference", () => {
  it("changes the approval mode", () => {
    useContactFlow.setState({ permissionMode: "ask" });

    useContactFlow.getState().setPermissionMode("full");

    expect(useContactFlow.getState().permissionMode).toBe("full");
  });
});

describe("relationship summary", () => {
  const contact: RelationshipContact = {
    company: "Northstar",
    email: "taylor@northstar.ai",
    facts: [],
    id: "relationship-taylor",
    lastActivityAt: "2026-08-19T01:00:00.000Z",
    meetings: [],
    name: "Taylor",
    phone: "13876543210",
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    useContactFlow.setState({
      modelConfigs: [],
      relationshipSummaries: {},
      selectedModelConfigId: null,
      summaryErrors: {},
      summaryModelConfigId: null,
      summaryRunningIds: [],
    });
  });

  it("stores an unviewed summary and clears the running flag", async () => {
    await useContactFlow.getState().createModelConfig({
      apiKey: "key",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-test",
      provider: "openai",
    });
    vi.mocked(generateRelationshipSummary).mockResolvedValue({
      summary: "与 Taylor 的互动稳定。",
    });

    await useContactFlow.getState().startRelationshipSummary(contact);

    const state = useContactFlow.getState();
    expect(state.summaryRunningIds).toEqual([]);
    expect(state.relationshipSummaries["relationship-taylor"]).toMatchObject({
      contactName: "Taylor",
      content: "与 Taylor 的互动稳定。",
      modelName: "gpt-test",
      viewed: false,
    });
  });

  it("marks a summary viewed so the modal does not reopen", async () => {
    await useContactFlow.getState().createModelConfig({
      apiKey: "key",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-test",
      provider: "openai",
    });
    vi.mocked(generateRelationshipSummary).mockResolvedValue({ summary: "ok" });
    await useContactFlow.getState().startRelationshipSummary(contact);

    useContactFlow
      .getState()
      .markRelationshipSummaryViewed("relationship-taylor");

    expect(
      useContactFlow.getState().relationshipSummaries["relationship-taylor"]
        ?.viewed,
    ).toBe(true);
  });

  it("writes a localized error when no model is configured", async () => {
    await useContactFlow.getState().startRelationshipSummary(contact);

    expect(
      useContactFlow.getState().summaryErrors["relationship-taylor"],
    ).toBe("还没有可用模型，请先在模型设置中配置。");
    expect(generateRelationshipSummary).not.toHaveBeenCalled();
    expect(useContactFlow.getState().summaryRunningIds).toEqual([]);
  });

  it("stores agent errors and stays retryable", async () => {
    await useContactFlow.getState().createModelConfig({
      apiKey: "key",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-test",
      provider: "openai",
    });
    vi.mocked(generateRelationshipSummary).mockRejectedValue(
      new Error("boom"),
    );

    await useContactFlow.getState().startRelationshipSummary(contact);

    const state = useContactFlow.getState();
    expect(state.summaryErrors["relationship-taylor"]).toContain(
      "agent-error",
    );
    expect(state.summaryRunningIds).toEqual([]);
  });

  it("clears summaries with contact memory and local data", () => {
    const summary = {
      contactId: "relationship-taylor",
      contactName: "Taylor",
      content: "old",
      generatedAt: "2026-08-19T01:00:00.000Z",
      modelName: "gpt-test",
      viewed: true,
    };
    useContactFlow.setState({
      relationshipSummaries: { "relationship-taylor": summary },
    });

    useContactFlow.getState().deleteContactMemory("Taylor");
    expect(useContactFlow.getState().relationshipSummaries).toEqual({});

    useContactFlow.setState({
      relationshipSummaries: { "relationship-taylor": summary },
    });
    useContactFlow.getState().clearLocalData();
    expect(useContactFlow.getState().relationshipSummaries).toEqual({});
  });

  it("keeps the summary model selection independent from the chat model", async () => {
    const firstId = await useContactFlow.getState().createModelConfig({
      apiKey: "key",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-a",
      provider: "openai",
    });
    const secondId = await useContactFlow.getState().createModelConfig({
      apiKey: "key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      provider: "deepseek",
    });

    useContactFlow.getState().selectModelConfig(secondId);
    useContactFlow.getState().selectSummaryModelConfig(firstId);

    expect(useContactFlow.getState().selectedModelConfigId).toBe(secondId);
    expect(useContactFlow.getState().summaryModelConfigId).toBe(firstId);
  });
});
