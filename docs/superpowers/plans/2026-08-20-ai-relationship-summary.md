# AI 关系总结 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在记忆页为选中联系人新增「选模型 / AI 总结 / 查看总结」三按钮区块，支持后台总结与完成后自动弹窗。

**Architecture:** store 层异步 action 驱动后台总结（离开页面不中断）；新增 domain 类型 + service 复用 `requestStructuredOutput`；UI 为独立组件 `relationship-summary.tsx`，复用 `ModelSwitcher` 与既有 Modal 模式。

**Tech Stack:** Expo Router / React Native / Zustand + persist / Zod / vitest。

**Spec:** `docs/superpowers/specs/2026-08-20-ai-relationship-summary-design.md`

**Commands（均在 `apps/mobile` 目录）:** `pnpm test`、`pnpm typecheck`、`pnpm lint`。

---

### Task 1: Domain 类型与 Schema

**Files:**
- Create: `apps/mobile/src/domain/relationship-summary.ts`
- Test: `apps/mobile/src/domain/relationship-summary.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// apps/mobile/src/domain/relationship-summary.test.ts
import { describe, expect, it } from "vitest";

import { RelationshipSummaryResultSchema } from "@/domain/relationship-summary";

describe("relationship summary schema", () => {
  it("accepts a summary string", () => {
    const result = RelationshipSummaryResultSchema.safeParse({
      summary: "你与 Taylor 保持稳定的互动节奏。",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing or non-string summary", () => {
    expect(RelationshipSummaryResultSchema.safeParse({}).success).toBe(false);
    expect(
      RelationshipSummaryResultSchema.safeParse({ summary: 42 }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- relationship-summary`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 domain 模块**

```ts
// apps/mobile/src/domain/relationship-summary.ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- relationship-summary`
Expected: PASS（2 个用例）。

---

### Task 2: 总结服务

**Files:**
- Create: `apps/mobile/src/services/relationship-summary-agent.ts`
- Test: `apps/mobile/src/services/relationship-summary-agent.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// apps/mobile/src/services/relationship-summary-agent.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelConfig } from "@/domain/model-config";
import type { RelationshipContact } from "@/domain/relationship-memory";
import { generateRelationshipSummary } from "@/services/relationship-summary-agent";

vi.mock("@/services/image-input", () => ({
  prepareImageDataUrl: vi.fn(),
}));

vi.mock("@/services/model-secrets", () => ({
  readModelApiKey: vi.fn(async () => "test-secret"),
}));

const config: ModelConfig = {
  baseUrl: "https://api.openai.com/v1",
  createdAt: "2026-08-19T00:00:00.000Z",
  hasApiKey: true,
  id: "model-1",
  model: "gpt-test",
  provider: "openai",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

const contact: RelationshipContact = {
  company: "Northstar",
  email: "taylor@northstar.ai",
  facts: [
    {
      contactName: "Taylor",
      createdAt: "2026-08-19T01:00:00.000Z",
      id: "memory-taylor",
      label: "联系方式",
      source: "已确认的新联系人",
      value: "13876543210",
    },
  ],
  id: "relationship-taylor",
  lastActivityAt: "2026-08-19T01:00:00.000Z",
  meetings: [
    {
      executedAt: "2026-08-19T01:00:00.000Z",
      id: "meeting-1",
      scheduledAt: "2026-08-21T15:00:00+08:00",
      title: "与 Taylor 同步",
    },
  ],
  name: "Taylor",
  phone: "13876543210",
};

const profile = { bio: "让每段关系都有下一步", email: "", name: "Ray" };

function jsonResponse(content: unknown) {
  return new Response(
    JSON.stringify({
      choices: [
        { finish_reason: "stop", message: { content: JSON.stringify(content) } },
      ],
    }),
    { status: 200 },
  );
}

describe("relationship summary agent", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts confirmed relationship data and parses the summary", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ summary: "You and Taylor keep a steady cadence." }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    const result = await generateRelationshipSummary({
      config,
      contact,
      locale: "en-US",
      profile,
    });

    expect(result.summary).toBe("You and Taylor keep a steady cadence.");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, request] = fetchImpl.mock.calls[0] as unknown as [
      string,
      { body: string; headers: Record<string, string> },
    ];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer test-secret");
    const body = JSON.parse(request.body);
    expect(body.response_format.json_schema.name).toBe(
      "contactflow_relationship_summary",
    );
    const payload = JSON.parse(body.messages[1].content);
    expect(payload.profile.name).toBe("Ray");
    expect(payload.contact).toMatchObject({
      name: "Taylor",
      phone: "13876543210",
    });
    expect(payload.contact.meetings[0].title).toBe("与 Taylor 同步");
    expect(payload.contact.facts[0].label).toBe("联系方式");
  });

  it("surfaces schema violations as AgentRequestError", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ summary: 42 }));
    vi.stubGlobal("fetch", fetchImpl);

    await expect(
      generateRelationshipSummary({ config, contact, locale: "zh-CN", profile }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- relationship-summary-agent`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现服务**

```ts
// apps/mobile/src/services/relationship-summary-agent.ts
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
Write the "summary" field as 3-6 natural sentences covering: the current state of the relationship between the user and this contact, the main themes of recent interactions, and one concrete next step phrased strictly as a suggestion.
Do not mention JSON, schemas, or system internals.`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- relationship-summary-agent`
Expected: PASS（2 个用例）。

---

### Task 3: Store 扩展

**Files:**
- Modify: `apps/mobile/src/store/use-contactflow.ts`
- Test: `apps/mobile/src/store/use-contactflow.test.ts`

- [ ] **Step 1: 在测试文件追加 mocks 与新 describe**

在 `use-contactflow.test.ts` 顶部 mocks 区追加：

```ts
vi.mock("@/services/relationship-summary-agent", () => ({
  generateRelationshipSummary: vi.fn(),
}));

vi.mock("@/services/openai-compatible-agent", () => ({
  agentErrorMessage: vi.fn(
    (error: unknown) =>
      `agent-error:${error instanceof Error ? error.message : "unknown"}`,
  ),
}));
```

在文件末尾追加：

```ts
import type { RelationshipContact } from "@/domain/relationship-memory";
import { generateRelationshipSummary } from "@/services/relationship-summary-agent";

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

    useContactFlow.getState().markRelationshipSummaryViewed("relationship-taylor");

    expect(
      useContactFlow.getState().relationshipSummaries["relationship-taylor"]?.viewed,
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
    expect(state.summaryErrors["relationship-taylor"]).toContain("agent-error");
    expect(state.summaryRunningIds).toEqual([]);
  });

  it("clears summaries with contact memory and local data", async () => {
    useContactFlow.setState({
      relationshipSummaries: {
        "relationship-taylor": {
          contactId: "relationship-taylor",
          contactName: "Taylor",
          content: "old",
          generatedAt: "2026-08-19T01:00:00.000Z",
          modelName: "gpt-test",
          viewed: true,
        },
      },
    });

    useContactFlow.getState().deleteContactMemory("Taylor");
    expect(useContactFlow.getState().relationshipSummaries).toEqual({});

    useContactFlow.setState({
      relationshipSummaries: {
        "relationship-taylor": {
          contactId: "relationship-taylor",
          contactName: "Taylor",
          content: "old",
          generatedAt: "2026-08-19T01:00:00.000Z",
          modelName: "gpt-test",
          viewed: true,
        },
      },
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
```

（import 语句按文件既有风格合并到顶部 import 区。）

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- use-contactflow`
Expected: FAIL（store 无对应字段/action）。

- [ ] **Step 3: 扩展 store**

对 `use-contactflow.ts` 的修改：

1) import 区追加/调整：

```ts
import {
  isChatCompletionsProvider,
  resolveModelConfig,
  type ModelConfig,
  type ModelConfigInput,
} from "@/domain/model-config";
import type { RelationshipContact } from "@/domain/relationship-memory";
import type { RelationshipSummary } from "@/domain/relationship-summary";
import { deleteModelApiKey, saveModelApiKey } from "@/services/model-secrets";
import { agentErrorMessage } from "@/services/openai-compatible-agent";
import { generateRelationshipSummary } from "@/services/relationship-summary-agent";
```

2) `ContactFlowState` 类型追加：

```ts
  relationshipSummaries: Record<string, RelationshipSummary>;
  summaryModelConfigId: string | null;
  summaryRunningIds: string[];
  summaryErrors: Record<string, string>;
  selectSummaryModelConfig: (id: string) => void;
  startRelationshipSummary: (contact: RelationshipContact) => Promise<void>;
  markRelationshipSummaryViewed: (contactId: string) => void;
```

3) 初始状态追加（`selectedModelConfigId: null,` 之后）：

```ts
      relationshipSummaries: {},
      summaryModelConfigId: null,
      summaryRunningIds: [],
      summaryErrors: {},
```

4) actions 追加（`selectModelConfig` 之后）：

```ts
      selectSummaryModelConfig: (id) =>
        set((state) => ({
          summaryModelConfigId:
            state.modelConfigs.find((config) => config.id === id)?.id ??
            state.modelConfigs[0]?.id ??
            null,
        })),
      markRelationshipSummaryViewed: (contactId) =>
        set((state) => {
          const summary = state.relationshipSummaries[contactId];
          if (!summary || summary.viewed) return {};
          return {
            relationshipSummaries: {
              ...state.relationshipSummaries,
              [contactId]: { ...summary, viewed: true },
            },
          };
        }),
      startRelationshipSummary: async (contact) => {
        const current = get();
        if (current.summaryRunningIds.includes(contact.id)) return;
        const config = resolveModelConfig(
          current.modelConfigs,
          current.summaryModelConfigId,
        );
        if (!config || !isChatCompletionsProvider(config.provider)) {
          set((state) => ({
            summaryErrors: {
              ...state.summaryErrors,
              [contact.id]:
                state.language === "zh"
                  ? "还没有可用模型，请先在模型设置中配置。"
                  : "No model available yet. Configure one in model settings.",
            },
          }));
          return;
        }
        set((state) => ({
          summaryRunningIds: [...state.summaryRunningIds, contact.id],
          summaryErrors: Object.fromEntries(
            Object.entries(state.summaryErrors).filter(
              ([id]) => id !== contact.id,
            ),
          ),
        }));
        try {
          const result = await generateRelationshipSummary({
            config,
            contact,
            locale: get().language === "zh" ? "zh-CN" : "en-US",
            profile: get().profile,
          });
          set((state) => ({
            relationshipSummaries: {
              ...state.relationshipSummaries,
              [contact.id]: {
                contactId: contact.id,
                contactName: contact.name,
                content: result.summary,
                generatedAt: new Date().toISOString(),
                modelName: config.model,
                viewed: false,
              },
            },
          }));
        } catch (error) {
          set((state) => ({
            summaryErrors: {
              ...state.summaryErrors,
              [contact.id]: agentErrorMessage(error, state.language),
            },
          }));
        } finally {
          set((state) => ({
            summaryRunningIds: state.summaryRunningIds.filter(
              (id) => id !== contact.id,
            ),
          }));
        }
      },
```

5) `deleteContactMemory` 的返回对象追加：

```ts
            relationshipSummaries: Object.fromEntries(
              Object.entries(state.relationshipSummaries).filter(
                ([, summary]) => !belongsToContact(summary.contactName),
              ),
            ),
```

6) `clearLocalData` 追加：

```ts
          relationshipSummaries: {},
          summaryErrors: {},
          summaryRunningIds: [],
```

7) `merge` 返回对象追加：

```ts
          relationshipSummaries:
            restored.relationshipSummaries ?? currentState.relationshipSummaries,
          summaryModelConfigId: (
            restored.modelConfigs ?? currentState.modelConfigs
          ).some((config) => config.id === restored.summaryModelConfigId)
            ? (restored.summaryModelConfigId as string)
            : null,
```

8) `partialize` 追加：

```ts
        relationshipSummaries: state.relationshipSummaries,
        summaryModelConfigId: state.summaryModelConfigId,
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- use-contactflow`
Expected: PASS（既有 + 新增用例全绿）。

---

### Task 4: UI 组件

**Files:**
- Create: `apps/mobile/src/components/relationship-summary.tsx`

- [ ] **Step 1: 创建组件（按钮行 + 错误行 + ModelSwitcher + 弹窗）**

```tsx
// apps/mobile/src/components/relationship-summary.tsx
import { useRouter } from "expo-router";
import { Bot, Eye, Sparkles, X } from "lucide-react-native";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable as NativePressable,
  ScrollView,
  StyleSheet,
} from "react-native";

import {
  type ComposerMenuAnchor,
  ModelSwitcher,
} from "@/components/model-switcher";
import { SectionHeading } from "@/components/screen";
import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  palette,
  radius,
  spacing,
  typeScale,
} from "@/constants/theme";
import { resolveModelConfig } from "@/domain/model-config";
import type { AppLanguage } from "@/domain/preferences";
import type { RelationshipContact } from "@/domain/relationship-memory";
import { useContactFlow } from "@/store/use-contactflow";

const summaryCopy = {
  zh: {
    section: "AI 关系总结",
    chooseModel: "选择模型",
    summarize: "AI 总结",
    regenerate: "重新生成",
    running: "总结中",
    viewSummary: "查看总结",
    modalTitle: "关系总结",
    close: "关闭",
  },
  en: {
    section: "AI RELATIONSHIP SUMMARY",
    chooseModel: "Choose model",
    summarize: "AI Summary",
    regenerate: "Regenerate",
    running: "Summarizing",
    viewSummary: "View summary",
    modalTitle: "Relationship summary",
    close: "Close",
  },
} as const;

/** Model picker + summarize + view-summary row for one selected contact. */
export function RelationshipSummarySection({
  contact,
  language,
}: {
  contact: RelationshipContact;
  language: AppLanguage;
}) {
  const router = useRouter();
  const copy = summaryCopy[language];
  const modelConfigs = useContactFlow((state) => state.modelConfigs);
  const summaryModelConfigId = useContactFlow(
    (state) => state.summaryModelConfigId,
  );
  const selectSummaryModelConfig = useContactFlow(
    (state) => state.selectSummaryModelConfig,
  );
  const startRelationshipSummary = useContactFlow(
    (state) => state.startRelationshipSummary,
  );
  const markRelationshipSummaryViewed = useContactFlow(
    (state) => state.markRelationshipSummaryViewed,
  );
  const summary = useContactFlow(
    (state) => state.relationshipSummaries[contact.id],
  );
  const running = useContactFlow((state) =>
    state.summaryRunningIds.includes(contact.id),
  );
  const error = useContactFlow((state) => state.summaryErrors[contact.id]);
  const [menuAnchor, setMenuAnchor] = useState<ComposerMenuAnchor | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const modelTriggerRef = useRef<ComponentRef<typeof NativePressable>>(null);
  const activeModel = resolveModelConfig(modelConfigs, summaryModelConfigId);

  useEffect(() => {
    if (summary && !summary.viewed && !running) setModalVisible(true);
  }, [running, summary]);

  const closeSummaryModal = () => {
    setModalVisible(false);
    markRelationshipSummaryViewed(contact.id);
  };

  return (
    <View style={styles.section}>
      <SectionHeading label={copy.section} />
      <View style={styles.buttonRow}>
        <NativePressable
          accessibilityLabel={copy.chooseModel}
          accessibilityRole="button"
          onPress={() =>
            modelTriggerRef.current?.measureInWindow((x, y, width, height) =>
              setMenuAnchor({ height, width, x, y }),
            )
          }
          ref={modelTriggerRef}
          style={({ pressed }) => [
            styles.sideButton,
            pressed && styles.pressed,
          ]}
        >
          <Bot
            color={palette.accent}
            size={iconSize.small}
            strokeWidth={1.7}
          />
          <Text numberOfLines={1} style={styles.sideButtonText}>
            {activeModel?.model ?? copy.chooseModel}
          </Text>
        </NativePressable>

        <Pressable
          accessibilityRole="button"
          disabled={running}
          onPress={() => void startRelationshipSummary(contact)}
          style={({ pressed }) => [
            styles.summarizeButton,
            (pressed || running) && styles.pressed,
          ]}
        >
          {running ? (
            <ActivityIndicator
              color={palette.void}
              size="small"
            />
          ) : (
            <Sparkles
              color={palette.void}
              size={iconSize.small}
              strokeWidth={1.7}
            />
          )}
          <Text numberOfLines={1} style={styles.summarizeButtonText}>
            {running ? copy.running : summary ? copy.regenerate : copy.summarize}
          </Text>
        </Pressable>

        {summary ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setModalVisible(true)}
            style={({ pressed }) => [
              styles.sideButton,
              pressed && styles.pressed,
            ]}
          >
            <Eye color={palette.mist} size={iconSize.small} strokeWidth={1.7} />
            <Text numberOfLines={1} style={styles.sideButtonText}>
              {copy.viewSummary}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ModelSwitcher
        anchor={menuAnchor}
        configs={modelConfigs}
        language={language}
        onClose={() => setMenuAnchor(null)}
        onManage={() => router.push("/settings-models")}
        onSelect={selectSummaryModelConfig}
        selectedId={activeModel?.id ?? null}
        visible={menuAnchor !== null}
      />

      <RelationshipSummaryModal
        contactName={contact.name}
        language={language}
        onClose={closeSummaryModal}
        summary={summary}
        visible={modalVisible}
      />
    </View>
  );
}

function RelationshipSummaryModal({
  contactName,
  language,
  onClose,
  summary,
  visible,
}: {
  contactName: string;
  language: AppLanguage;
  onClose: () => void;
  summary?: RelationshipSummary;
  visible: boolean;
}) {
  const copy = summaryCopy[language];
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.modalOverlay}>
        <NativePressable
          accessibilityLabel={copy.close}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Card style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalTitle}>{copy.modalTitle}</Text>
              <Text numberOfLines={1} style={styles.modalSubtitle}>
                {contactName}
              </Text>
            </View>
            <NativePressable
              accessibilityLabel={copy.close}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={styles.modalClose}
            >
              <X
                color={palette.smoke}
                size={iconSize.medium}
                strokeWidth={1.8}
              />
            </NativePressable>
          </View>
          {summary ? (
            <>
              <Text style={styles.modalMeta}>
                {summary.modelName} · {formatDateTime(summary.generatedAt, language)}
              </Text>
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                style={styles.modalScroll}
              >
                <Text selectable style={styles.modalBody}>
                  {summary.content}
                </Text>
              </ScrollView>
            </>
          ) : null}
        </Card>
      </View>
    </Modal>
  );
}

function formatDateTime(value: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type RelationshipSummary = NonNullable<
  ReturnType<typeof useContactFlow.getState>["relationshipSummaries"][string]
>;

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  sideButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    backgroundColor: palette.ink,
  },
  sideButtonText: {
    flexShrink: 1,
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
    lineHeight: 16,
  },
  summarizeButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
  },
  summarizeButtonText: {
    flexShrink: 1,
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
    lineHeight: 16,
  },
  pressed: { opacity: 0.58 },
  errorText: {
    color: palette.danger,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: palette.overlay,
  },
  modalCard: {
    width: "100%",
    maxHeight: "72%",
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.ink,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  modalTitleWrap: { flex: 1, minWidth: 0 },
  modalTitle: {
    color: palette.paper,
    fontFamily: fonts.display,
    fontSize: typeScale.subheading,
  },
  modalSubtitle: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    marginTop: 2,
  },
  modalClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: palette.graphite,
  },
  modalMeta: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: 10,
    lineHeight: 14,
    marginTop: spacing.md,
  },
  modalScroll: { marginTop: spacing.md, maxHeight: 320 },
  modalBody: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    lineHeight: 21,
  },
});
```

注意：`RelationshipSummary` 类型应直接从 `@/domain/relationship-summary` import（`import type { RelationshipSummary } from "@/domain/relationship-summary";`），删除文件底部的 type alias。

- [ ] **Step 2: 运行 typecheck**

Run: `pnpm typecheck`
Expected: PASS。

---

### Task 5: 记忆页接入

**Files:**
- Modify: `apps/mobile/src/app/memory.tsx`

- [ ] **Step 1: 渲染总结区块**

import 区追加：

```ts
import { RelationshipSummarySection } from "@/components/relationship-summary";
```

在「联系人信息」section（第一个 `{selectedContact ? (...) : null}` 块）之后插入：

```tsx
      {selectedContact ? (
        <RelationshipSummarySection
          contact={selectedContact}
          key={selectedContact.id}
          language={language}
        />
      ) : null}
```

- [ ] **Step 2: 运行 typecheck 与 lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS。

---

### Task 6: 全量验证

- [ ] **Step 1: 全量测试**

Run: `pnpm test`
Expected: 全部 PASS。

- [ ] **Step 2: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS。

- [ ] **Step 3: 手动验证清单（模拟器/真机 `pnpm start`）**

1. 记忆页选中联系人 → 出现「AI 关系总结」区块，初始两个按钮（选择模型 + AI 总结）。
2. 点模型按钮 → ModelSwitcher 弹出，可独立选择模型；「管理模型与 API」跳转设置页。
3. 无模型时点 AI 总结 → 行内红色错误文案。
4. 有模型时点 AI 总结 → 按钮转圈「总结中」；离开记忆页再返回，完成后弹窗自动打开。
5. 关闭弹窗 → 出现「查看总结」按钮；再次点击可查看；不再自动弹出。
6. 点「重新生成」→ 覆盖旧总结并再次自动弹窗。
