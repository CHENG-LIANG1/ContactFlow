import { AssistantOutput } from "@/components/assistant-output";
import type { AppLanguage } from "@/domain/preferences";
import type { AnalysisProgressStage } from "@/services/openai-compatible-agent";

type AnalysisProcessProps = {
  attachmentCount: number;
  elapsedMs: number;
  language: AppLanguage;
  modelName: string;
  stage: AnalysisProgressStage;
};

const stageRank: Record<AnalysisProgressStage, number> = {
  preparing_input: 0,
  requesting_model: 1,
  validating_schema: 2,
};

/** Displays auditable pipeline progress without exposing private model reasoning. */
export function AnalysisProcess({
  attachmentCount,
  elapsedMs,
  language,
  modelName,
  stage,
}: AnalysisProcessProps) {
  const current = stageRank[stage];
  const prefix = (rank: number) => (rank < current ? "✓" : rank === current ? "●" : "○");
  const imageCount = language === "zh" ? `${attachmentCount} 张截图` : `${attachmentCount} image${attachmentCount === 1 ? "" : "s"}`;
  const steps =
    language === "zh"
      ? [
          `${prefix(0)} 读取文字与${imageCount}`,
          `${prefix(0)} 压缩图片并移除原始元数据`,
          `${prefix(1)} 请求 ${modelName} 返回结构化动作`,
          `${prefix(2)} 用 ContactFlow Schema 校验证据与必填字段`,
        ]
      : [
          `${prefix(0)} Read text and ${imageCount}`,
          `${prefix(0)} Compress images and remove original metadata`,
          `${prefix(1)} Ask ${modelName} for structured actions`,
          `${prefix(2)} Validate evidence and required fields with the ContactFlow schema`,
        ];

  return (
    <AssistantOutput
      defaultExpanded
      elapsedMs={elapsedMs}
      language={language}
      message={
        language === "zh"
          ? "正在理解这段对话"
          : "Understanding this conversation"
      }
      reasoning={steps.join("\n")}
      running
    />
  );
}
