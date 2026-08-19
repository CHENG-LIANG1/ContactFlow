import type { ActionType } from "@/domain/actions";
import type { AppLanguage } from "@/domain/preferences";

export type AgentPresetId =
  | "create_contact"
  | "create_meeting"
  | "update_contact";

export type AgentPreset = {
  id: AgentPresetId;
  expectedActionType: ActionType;
  imageLabel: string;
  assetFileName: string;
  label: Record<AppLanguage, string>;
  instruction: Record<AppLanguage, string>;
};

/** Real screenshot fixtures shared by the composer presets and live E2E contract. */
export const AGENT_PRESETS: readonly AgentPreset[] = [
  {
    id: "create_contact",
    expectedActionType: "create_contact",
    imageLabel: "Taylor · 初次交换联系方式",
    assetFileName: "create-contact.jpg",
    label: { zh: "新建联系人", en: "Create contact" },
    instruction: {
      zh: "帮我新建一个联系人。",
      en: "Create a contact for me.",
    },
  },
  {
    id: "create_meeting",
    expectedActionType: "create_meeting",
    imageLabel: "Taylor · 周五 AI 搜索沟通",
    assetFileName: "create-meeting.jpg",
    label: { zh: "新建会议", en: "Create meeting" },
    instruction: {
      zh: "帮我新建一个会议。",
      en: "Create a meeting for me.",
    },
  },
  {
    id: "update_contact",
    expectedActionType: "update_contact",
    imageLabel: "Taylor · Horizon AI 任职更新",
    assetFileName: "update-contact.jpg",
    label: { zh: "更新联系人", en: "Update contact" },
    instruction: {
      zh: "帮我更新一下联系人。",
      en: "Update the contact for me.",
    },
  },
] as const;

export function getAgentPreset(id: AgentPresetId) {
  return AGENT_PRESETS.find((preset) => preset.id === id)!;
}
