# ContactFlow

![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react)
![Expo SDK](https://img.shields.io/badge/Expo%20SDK-57-000020?logo=expo)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)
![iOS](https://img.shields.io/badge/platform-iOS%2016.4%2B-blue?logo=apple)
![License](https://img.shields.io/badge/license-MIT-green)

> 截图驱动的 iOS 联系人 Agent：把聊天截图发给它，它读懂上下文，生成可编辑、需确认的行动卡片；你确认后，App 才会真正在设备上创建会议、创建或更新联系人，并把已确认的信息沉淀成可追溯的关系记忆。

ContactFlow 是一个面向 iOS 的概念项目。核心理念是 **模型提议、人来确认、系统执行**——AI 只负责理解和建议，任何写入日历或通讯录的动作都必须经过你逐张确认，只有原生执行成功的结果才会沉淀为记忆。

仓库包含可运行的 React Native MVP，以及配套的产品与技术设计文档：

- [产品需求文档（PRD）](docs/PRD.md)
- [React Native 技术方案](docs/TECHNICAL_DESIGN.md)
- [仓库 Wiki（新手友好版）](docs/REPO_WIKI.md)
- [iOS 应用源码](apps/mobile/src)

## 截图预览

| 主界面（聊天） | 行动卡片 |
| :---: | :---: |
| ![主界面](artifacts/contactflow-home.png) | ![行动卡片](artifacts/contactflow-action-cards.png) |
| 会话抽屉 | 设置 |
| ![会话抽屉](artifacts/contactflow-chat-history-drawer.png) | ![设置](artifacts/contactflow-settings.png) |

## 核心特性

- **截图驱动分析**：从聊天截图和补充文字进入分析流程，上传前自动压缩图片，思考过程流式可见。
- **三类可编辑行动卡**：生成「创建会议 / 创建联系人 / 更新联系人」三类卡片，每张可逐字段编辑。
- **确认即执行**：每张行动卡单独确认后，调用 iOS Calendar / Contacts 原生能力执行，权限模式可设为二次确认。
- **可追溯的关系记忆**：只有原生执行成功的结果才写入本地记忆，并据此生成带证据的关系洞察与下一步建议。
- **本地优先**：业务数据默认保存在设备本地，提供历史、记忆管理与一键清除；API Key 只存系统钥匙串。
- **双语与主题**：支持中英文界面与深浅色主题切换。

当前版本内置一个确定性的本地 Demo Agent，用于无密钥演示完整交互和结构化 action contract，它不会把截图上传到服务端。接入真实视觉模型时，可在保留行动卡与确认执行层的前提下替换 `src/domain/demo-agent.ts`。

## 工作原理

三者循环：**对话产生动作，动作沉淀记忆，记忆反哺对话。**

```mermaid
flowchart LR
  A["聊天截图 + 补充文字"] --> B("AI 分析<br/>流式思考")
  B --> C["可编辑行动卡<br/>会议 / 联系人"]
  C -->|"你确认"| D["原生执行<br/>日历 / 通讯录"]
  D -->|"成功"| E["关系记忆 + 洞察"]
  E -.->|"反哺下次分析"| B
```

每成功执行一个动作，App 会写一条执行历史（`HistoryRecord`）和一条事实（`MemoryFact`），记忆页据此按人名聚合成联系人节点和关系图，下次分析时作为上下文喂给模型。

## 技术栈

| 维度 | 选型 |
| --- | --- |
| 包管理 | pnpm monorepo（根目录管 workspace，App 在 `apps/mobile`） |
| 语言 | TypeScript 6.0 |
| 框架 | React Native 0.86 + Expo SDK 57（Expo Router 文件路由） |
| UI | Gluestack UI + NativeWind（Tailwind CSS），设计 token 集中在 `src/constants/theme.ts` |
| 聊天编排 | `@assistant-ui/react-native`（消息流、思考卡片、输入框骨架） |
| 全局状态 | Zustand（单一状态源 + persist 持久化） |
| 持久化 | AsyncStorage（业务数据）+ SecureStore（API Key） |
| 数据校验 | Zod（模型返回的 JSON 必须过 schema 校验） |
| 原生能力 | expo-calendar / expo-contacts / expo-image-manipulator / expo-media-library |
| 测试 | Vitest（纯逻辑测试，不碰 UI） |
| 代码规范 | ESLint + Prettier |

## 项目结构

```
ContactFlow
├── apps/mobile              # React Native (Expo) iOS 应用
│   ├── src
│   │   ├── app/             # Expo Router 路由（index / history / memory / settings ...）
│   │   ├── components/      # UI 组件（聊天、行动卡、洞察卡、关系图 ...）
│   │   ├── domain/          # 业务类型 + Zod schema（actions / chat / relationship-memory ...）
│   │   ├── services/        # 分析适配器、模型调用、图片处理
│   │   ├── native/          # 原生执行器（日历 / 通讯录）
│   │   └── store/          # Zustand 全局状态
│   └── ios/                 # 原生工程
├── docs/                    # PRD、技术方案、仓库 Wiki
├── artifacts/               # 截图素材
└── tests/                   # 端到端测试
```

## 快速开始

### 环境要求

- Node.js 24
- pnpm 10+
- Xcode 26.4 或更高版本
- iOS 16.4 或更高版本的模拟器

### 安装与运行

```bash
pnpm install
pnpm ios
```

## 常用脚本

在仓库根目录执行：

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 Metro 开发服务器 |
| `pnpm ios` | 构建并运行 iOS 模拟器 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 运行单元测试（Vitest） |
| `pnpm lint` | ESLint 代码检查 |
| `pnpm build:ios` | 导出 iOS 构建 |

## 文档

- [产品需求文档（PRD）](docs/PRD.md) — 产品定位、用户场景与功能定义
- [React Native 技术方案](docs/TECHNICAL_DESIGN.md) — 架构设计与实现细节
- [仓库 Wiki](docs/REPO_WIKI.md) — 面向新手的代码导读、调用链与字段词典

## 许可

Expo 脚手架部分遵循 MIT 许可（详见 [apps/mobile/LICENSE](apps/mobile/LICENSE)）。
