# ContactFlow

ContactFlow 是一个面向 iOS 的截图驱动联系人 agent 概念项目。用户上传聊天截图并补充说明，系统理解上下文、提出可编辑且需确认的行动卡片；用户确认后，App 才会在设备上创建会议、创建联系人或更新联系人，并基于已确认信息生成可追溯的关系洞察。

仓库包含可运行的 React Native MVP，以及配套的产品与技术设计文档：

- [产品需求文档（PRD）](docs/PRD.md)
- [React Native 技术方案](docs/TECHNICAL_DESIGN.md)
- [iOS 应用源码](apps/mobile/src)
- [仓库 Wiki](docs/REPO_WIKI.md)

## MVP 能力

- 从聊天截图和补充文字进入分析流程，并在上传前压缩图片。
- 生成“创建会议 / 创建联系人 / 更新联系人”三类可编辑行动卡。
- 每张行动卡单独确认后，调用 iOS Calendar / Contacts 原生能力执行。
- 只有原生执行成功的结果才写入本地记忆，并生成带证据的关系洞察。
- 提供历史、记忆管理与一键清除；数据默认保存在设备本地。

当前版本内置一个确定性的本地 Demo Agent，用于无密钥演示完整交互和结构化 action contract；它不会把截图上传到服务端。接入真实视觉模型时，可在保留行动卡与确认执行层的前提下替换 `src/domain/demo-agent.ts`。

## 本地运行

要求 Node.js 24、pnpm、Xcode 26.4 或更高版本，以及 iOS 16.4 或更高版本的模拟器。

```bash
pnpm install
pnpm ios
```

常用质量检查：

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build:ios
```
