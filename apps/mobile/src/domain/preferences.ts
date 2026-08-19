export type AppLanguage = "zh" | "en";

export type ThemeMode = "light" | "dark";

export type AgentPermissionMode = "ask" | "assist" | "full";

export type UserProfile = {
  avatarUri?: string;
  name: string;
  bio: string;
  email: string;
};
