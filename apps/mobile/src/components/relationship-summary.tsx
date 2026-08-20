import { useRouter } from "expo-router";
import { Bot, Eye, Sparkles, X } from "lucide-react-native";
import { useRef, useState, type ComponentRef } from "react";
import {
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
import { ThinkingDots } from "@/components/thinking-dots";
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
import type { RelationshipSummary } from "@/domain/relationship-summary";
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
  const [manualOpen, setManualOpen] = useState(false);
  const modelTriggerRef = useRef<ComponentRef<typeof NativePressable>>(null);
  const activeModel = resolveModelConfig(modelConfigs, summaryModelConfigId);
  const autoOpen = Boolean(summary && !summary.viewed && !running);
  const modalVisible = manualOpen || autoOpen;

  const closeSummaryModal = () => {
    setManualOpen(false);
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
          style={({ pressed }) => [styles.sideButton, pressed && styles.pressed]}
        >
          <Bot color={palette.accent} size={iconSize.small} strokeWidth={1.7} />
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
            <ThinkingDots color={palette.void as string} size={5} />
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
            onPress={() => setManualOpen(true)}
            style={({ pressed }) => [
              styles.sideButton,
              pressed && styles.pressed,
            ]}
          >
            <Eye
              color={palette.mist}
              size={iconSize.small}
              strokeWidth={1.7}
            />
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
                {summary.modelName} ·{" "}
                {formatDateTime(summary.generatedAt, language)}
              </Text>
              <ScrollView
                bounces={false}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                style={styles.modalScroll}
              >
                <MarkdownText content={summary.content} />
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

/** Renders the model's Markdown subset: bullet lines and **bold** spans. */
function MarkdownText({ content }: { content: string }) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return (
    <View style={styles.markdown}>
      {lines.map((line, index) => {
        const bullet = /^[-*•]\s+/.test(line);
        const text = line.replace(/^[-*•]\s+/, "");
        return (
          <View key={index} style={styles.markdownLine}>
            {bullet ? <View style={styles.bulletDot} /> : null}
            <Text
              selectable
              style={[styles.modalBody, bullet ? styles.bulletText : null]}
            >
              {renderInlineBold(text)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function renderInlineBold(text: string) {
  return text.split(/\*\*([^*]+)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <Text key={index} style={styles.strong}>
        {part}
      </Text>
    ) : (
      part
    ),
  );
}

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
    gap: 0,
    padding: spacing.xl,
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
    lineHeight: 24,
  },
  modalSubtitle: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
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
    marginTop: spacing.lg,
  },
  modalScroll: { marginTop: spacing.xl, maxHeight: 320 },
  modalScrollContent: { paddingBottom: spacing.xs },
  markdown: { gap: spacing.sm },
  markdownLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 8,
    backgroundColor: palette.accent,
  },
  bulletText: { flex: 1 },
  strong: {
    color: palette.paper,
    fontFamily: fonts.display,
  },
  modalBody: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    lineHeight: 21,
  },
});
