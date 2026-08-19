export type ModelProvider =
  "openai" | "anthropic" | "google" | "deepseek" | "openai-compatible";

export type ModelConfig = {
  id: string;
  provider: ModelProvider;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ModelConfigInput = Pick<
  ModelConfig,
  "provider" | "model" | "baseUrl"
> & {
  apiKey?: string;
};

export const modelProviders: ModelProvider[] = [
  "openai",
  "anthropic",
  "google",
  "deepseek",
  "openai-compatible",
];

export const providerBaseUrls: Record<ModelProvider, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com/v1beta",
  deepseek: "https://api.deepseek.com",
  "openai-compatible": "",
};

export const providerNames: Record<ModelProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  deepseek: "DeepSeek",
  "openai-compatible": "OpenAI Compatible",
};

export function isChatCompletionsProvider(provider: ModelProvider) {
  return (
    provider === "openai" ||
    provider === "deepseek" ||
    provider === "openai-compatible"
  );
}

export function resolveModelConfig(
  configs: ModelConfig[],
  selectedId: string | null,
) {
  return (
    configs.find((config) => config.id === selectedId) ?? configs[0] ?? null
  );
}
