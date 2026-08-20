# AI 关系总结（记忆页）设计

## 概述

在记忆页（`src/app/memory.tsx`）选中联系人后，新增「AI 关系总结」区块，提供三个按钮：

1. **选模型**：从已配置模型中为总结功能独立选择一个模型（不影响聊天页的全局选择）。
2. **AI 总结**：点击后立即开始后台总结（按钮转圈）；已有总结时按钮文案变为「重新生成」。
3. **查看总结**：仅当该联系人存在总结时显示；点击打开总结弹窗。

总结在 store 层异步执行，离开记忆页仍继续（后台总结）。总结完成后弹窗自动打开；关闭弹窗后总结标记为已读，之后通过「查看总结」按钮再次打开。

## 领域层：`src/domain/relationship-summary.ts`（新增）

```ts
export type RelationshipSummary = {
  contactId: string;
  contactName: string;
  content: string;      // 模型生成的总结正文
  modelName: string;    // 生成时使用的模型名（用于弹窗 meta 展示）
  generatedAt: string;  // ISO-8601
  viewed: boolean;      // 弹窗是否已展示过（关闭后置 true）
};

export const RelationshipSummaryResultSchema = z.object({
  summary: z.string(),
});
export type RelationshipSummaryResult = z.infer<typeof RelationshipSummaryResultSchema>;
```

每个联系人仅保留最新一份总结（重新生成即覆盖），key 为 `RelationshipContact.id`。

## 服务层：`src/services/relationship-summary-agent.ts`（新增）

```ts
export type GenerateRelationshipSummaryInput = {
  config: ModelConfig;
  contact: RelationshipContact;
  locale: string;
  profile: UserProfile;
};

export async function generateRelationshipSummary(
  input: GenerateRelationshipSummaryInput,
): Promise<RelationshipSummaryResult>
```

- 通过 `readModelApiKey(config.id)` 读取 key，复用 `requestStructuredOutput`（schema 为 `RelationshipSummaryResultSchema`，`jsonSchemaName: "contactflow_relationship_summary"`）。
- system prompt 要点：你是 ContactFlow 的关系总结器；只使用提供的已确认事实与会议，不得编造；`summary` 字段输出便于扫读的 Markdown：第一行一句话总览，随后 3–5 条 `- ` 开头的 bullet，每条以 **加粗** 关键标签（如 **当前角色**、**近期互动**、**下一步**）开头，**bold** 仅用于关键标签/人名/日期。
- userContent 为 JSON：`{ profile: { name, bio }, contact: { name, company, jobTitle, phone, email, meetings: [{title, scheduledAt, executedAt}], facts: [{label, value, source, createdAt}] } }`。
- 错误直接抛出 `AgentRequestError`，由 store 用 `agentErrorMessage` 本地化。

## Store：`src/store/use-contactflow.ts`（扩展）

持久化（加入 `partialize` 与 `merge` 归一化）：

- `relationshipSummaries: Record<string, RelationshipSummary>`（key = contactId；merge 时默认 `{}`）。
- `summaryModelConfigId: string | null`（独立模型选择；merge 时用 `resolveModelConfig` 校验，失效则回落到 `null`/首个配置）。

运行时（不持久化，app 重启后不会残留转圈状态）：

- `summaryRunningIds: string[]`
- `summaryErrors: Record<string, string>`

新增 actions：

- `selectSummaryModelConfig(id: string)`：同 `selectModelConfig` 语义，作用于 `summaryModelConfigId`。
- `startRelationshipSummary(contact: RelationshipContact): Promise<void>`：
  1. 若 `summaryRunningIds` 已含 `contact.id`，直接返回（防重入）。
  2. `config = resolveModelConfig(modelConfigs, summaryModelConfigId)`；若不存在或 `!isChatCompletionsProvider(config.provider)`，写入本地化错误（“还没有可用模型…”）并返回。
  3. 置 running、清除该联系人错误。
  4. 调用 `generateRelationshipSummary`；成功则写入 `relationshipSummaries[contact.id] = { ..., viewed: false }`；失败则 `summaryErrors[contact.id] = agentErrorMessage(error, language)`。
  5. `finally` 中移除 running。
- `markRelationshipSummaryViewed(contactId: string)`：`viewed: true`。

既有 actions 联动：

- `deleteContactMemory(contactName)`：同时删除该联系人的总结（按 contactName 匹配，复用现有 `belongsToContact` 逻辑）。
- `clearLocalData()`：重置 `relationshipSummaries: {}`（`summaryModelConfigId` 保留）。

## UI：`src/components/relationship-summary.tsx`（新增）

导出 `RelationshipSummarySection({ contact, language })`，在 `memory.tsx` 中于「联系人信息」卡片之后渲染，并以 `key={selectedContact.id}` 挂载以在切换联系人时重置内部状态。

### 按钮行（三个按钮）

- **模型按钮**：Bot 图标 + 当前总结模型名（无配置时显示「选择模型」）。点击时用 `ref.measureInWindow` 取 anchor（同 `chat-composer.tsx` 模式），打开复用的 `ModelSwitcher`（`selectedId` 为解析后的总结模型，`onSelect` 调 `selectSummaryModelConfig`，`onManage` 路由到 `/settings-models`）。
- **AI 总结按钮**（accent 实心）：点击调 `startRelationshipSummary(contact)`；running 时显示 `ActivityIndicator` + 「总结中」且 disabled；已有总结时文案为「重新生成 / Regenerate」。
- **查看总结按钮**：仅当 `relationshipSummaries[contact.id]` 存在时渲染；点击打开弹窗。

布局：`flexDirection: "row"`，无总结时两个按钮、有总结时三个；样式沿用 theme 常量（pill 圆角、spacing、typeScale）。

### 错误展示

`summaryErrors[contact.id]` 非空时在按钮行下方以 `palette.danger` caption 文案内联展示；下次成功启动总结时清除。

### 弹窗 `RelationshipSummaryModal`

- `Modal transparent overFullScreen`（同 `ModelSwitcher`/`ProfileEditorModal` 模式），居中 Card。
- 标题：`关系总结 · {contact.name}`；meta 行：`{modelName} · {formatted generatedAt}`；正文 `ScrollView` 内以轻量 Markdown 渲染器展示 `content`（仅支持 bullet 行与 `**bold**`，bullet 用 accent 圆点、bold 用 paper 色 DemiBold，selectable）；关闭按钮。
- 关闭时：`setModalVisible(false)` + `markRelationshipSummaryViewed(contact.id)`。

### 自动打开规则

组件内 `useEffect` 监听当前联系人的总结：当 `summary && !summary.viewed && !running` 时 `setModalVisible(true)`。该规则同时覆盖「在页面内等待完成」与「后台完成后返回页面」两种场景；关闭后即已读，不再自动弹出。

## 文案（zh / en，随 `language` 切换）

| key | zh | en |
| --- | --- | --- |
| section | AI 关系总结 | AI RELATIONSHIP SUMMARY |
| chooseModel | 选择模型 | Choose model |
| summarize | AI 总结 | AI Summary |
| regenerate | 重新生成 | Regenerate |
| running | 总结中 | Summarizing |
| viewSummary | 查看总结 | View summary |
| modalTitle | 关系总结 | Relationship summary |
| close | 关闭 | Close |
| noModelError | 还没有可用模型，请先在模型设置中配置。 | No model available yet. Configure one in model settings. |

## 错误处理

- 无模型 / provider 未接通 / 缺 API Key / 网络等：统一 `agentErrorMessage` 本地化后内联展示，按钮保持可用以便重试。
- 请求超时沿用 `requestStructuredOutput` 的 60s 超时与重试策略。

## 测试计划

- `src/domain/relationship-summary.test.ts`（新增）：schema 正/反例解析。
- `src/store/use-contactflow.test.ts`（扩展，`vi.mock` 服务层）：
  - 启动 → 成功写入 `viewed: false` 的总结并清除 running；
  - `markRelationshipSummaryViewed` 置已读；
  - 无模型时写入错误且不进入 running；
  - `deleteContactMemory` / `clearLocalData` 清理总结；
  - `selectSummaryModelConfig` 独立于全局 `selectedModelConfigId`。
- `src/services/relationship-summary-agent.test.ts`（新增，仿 `openai-compatible-agent.test.ts` 的 `fetchImpl` stub 与 `model-secrets` mock）：payload 组装与 schema 校验路径。

## 假设与边界

- 每联系人只保留最新一份总结；不保留历史版本。
- 后台任务存活于 app 进程生命周期内；app 被杀则 running 状态丢失、旧总结保留。
- 总结输入仅来自已确认的 history/memories（与记忆页承诺一致），不含聊天截图。
