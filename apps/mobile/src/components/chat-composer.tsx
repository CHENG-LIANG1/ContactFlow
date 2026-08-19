import { Image } from "expo-image";
import {
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  ComposerPrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
  useLocalRuntime,
} from "@assistant-ui/react-native";
import {
  ArrowUp,
  Bot,
  CalendarPlus,
  ChevronRight,
  ContactRound,
  Plus,
  X,
} from "lucide-react-native";
import {
  type ComponentRef,
  type MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Image as NativeImage,
  Modal,
  Pressable as NativePressable,
  ScrollView,
  StyleSheet,
  type ColorValue,
} from "react-native";
import Animated, {
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";

import {
  PhotoLibraryPicker,
  type PhotoLibraryItem,
} from "@/components/photo-library-picker";
import type { ComposerMenuAnchor } from "@/components/model-switcher";
import { Box as View } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  motion,
  palette,
  radius,
  spacing,
  typeScale,
} from "@/constants/theme";
import type { ChatAttachment } from "@/domain/chat";
import {
  AGENT_PRESETS,
  type AgentPreset,
  type AgentPresetId,
} from "@/domain/agent-presets";
import type { AgentPermissionMode, AppLanguage } from "@/domain/preferences";

type ChatComposerProps = {
  analyzing: boolean;
  accent: ColorValue;
  language: AppLanguage;
  modelName?: string;
  onModelPress?: (anchor: ComposerMenuAnchor) => void;
  onPermissionPress?: (anchor: ComposerMenuAnchor) => void;
  onSend: (note: string, attachments: ChatAttachment[]) => Promise<void> | void;
  permissionMode: AgentPermissionMode;
};

type ComposerBoxProps = {
  accent: ColorValue;
  analyzing: boolean;
  attachments: ChatAttachment[];
  language: AppLanguage;
  onAttachPress?: () => void;
  onRemoveAttachment: (index: number) => void;
  photoTrayOpen?: boolean;
};

const MAX_ATTACHMENTS = 9;
const INPUT_MIN_HEIGHT = 44;
const INPUT_MAX_HEIGHT = 112;

const PRESET_IMAGE_MODULES: Record<AgentPresetId, number> = {
  create_contact: require("../../assets/e2e/create-contact.jpg"),
  create_meeting: require("../../assets/e2e/create-meeting.jpg"),
  update_contact: require("../../assets/e2e/update-contact.jpg"),
};

function textFromLastUserMessage(messages: Parameters<ChatModelAdapter["run"]>[0]["messages"]) {
  const message = [...messages].reverse().find((item) => item.role === "user");
  if (!message) return "";
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/** Capture, context, and send stay inside one familiar chat composer. */
export function ChatComposer({
  accent,
  analyzing,
  language,
  modelName,
  onModelPress,
  onPermissionPress,
  onSend,
  permissionMode,
}: ChatComposerProps) {
  const onSendRef = useRef(onSend);
  const attachmentsRef = useRef<ChatAttachment[]>([]);
  const resetComposerUiRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async run({ messages }) {
        const note = textFromLastUserMessage(messages);
        const attachments = attachmentsRef.current;
        resetComposerUiRef.current();
        await onSendRef.current(note, attachments);
        return { content: [] };
      },
    }),
    [],
  );
  const runtime = useLocalRuntime(adapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root>
        <ChatComposerSurface
          accent={accent}
          analyzing={analyzing}
          attachmentsRef={attachmentsRef}
          language={language}
          modelName={modelName}
          onModelPress={onModelPress}
          onPermissionPress={onPermissionPress}
          permissionMode={permissionMode}
          resetComposerUiRef={resetComposerUiRef}
        />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

function ChatComposerSurface({
  accent,
  analyzing,
  attachmentsRef,
  language,
  modelName,
  onModelPress,
  resetComposerUiRef,
}: Omit<ChatComposerProps, "onSend"> & {
  attachmentsRef: MutableRefObject<ChatAttachment[]>;
  resetComposerUiRef: MutableRefObject<() => void>;
}) {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [photoTrayOpen, setPhotoTrayOpen] = useState(false);
  const [galleryExpanded, setGalleryExpanded] = useState(false);
  const composerText = useAuiState((state) => state.composer.text);
  const aui = useAui();
  const modelTriggerRef = useRef<ComponentRef<typeof NativePressable>>(null);
  const copy = composerCopy[language];

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments, attachmentsRef]);

  useEffect(() => {
    resetComposerUiRef.current = () => {
      setAttachments([]);
      setPhotoTrayOpen(false);
      setGalleryExpanded(false);
    };
    return () => {
      resetComposerUiRef.current = () => undefined;
    };
  }, [resetComposerUiRef]);

  const selectPreset = (preset: AgentPreset) => {
    const uri = NativeImage.resolveAssetSource(
      PRESET_IMAGE_MODULES[preset.id],
    ).uri;
    setAttachments([{ uri, label: preset.imageLabel, isDemo: false }]);
    setPhotoTrayOpen(false);
    setGalleryExpanded(false);
  };

  const togglePhoto = (photo: PhotoLibraryItem) => {
    if (!composerText.trim()) aui.composer.setText(copy.imageOnlyPrompt);
    setAttachments((current) => {
      const selectedIndex = current.findIndex(
        (attachment) => attachment.uri === photo.uri,
      );
      if (selectedIndex >= 0) {
        return current.filter((_, index) => index !== selectedIndex);
      }
      if (current.length >= MAX_ATTACHMENTS) {
        Alert.alert(copy.limitTitle, copy.limitBody);
        return current;
      }
      return [
        ...current,
        { uri: photo.uri, label: photo.label, isDemo: false },
      ];
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const togglePhotoTray = () => {
    setPhotoTrayOpen((current) => !current);
    if (photoTrayOpen) setGalleryExpanded(false);
  };

  const composerBox = (
    <ComposerBox
      accent={accent}
      analyzing={analyzing}
      attachments={attachments}
      language={language}
      onRemoveAttachment={removeAttachment}
    />
  );

  return (
    <View style={styles.shell}>
      <View style={styles.suggestionBar}>
        <ScrollView
          contentContainerStyle={styles.suggestions}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.suggestionScroll}
        >
          {onModelPress ? (
            <NativePressable
              accessibilityLabel={copy.chooseModel}
              accessibilityRole="button"
              hitSlop={4}
              onPress={() =>
                modelTriggerRef.current?.measureInWindow(
                  (x, y, width, height) =>
                    onModelPress({ height, width, x, y }),
                )
              }
              ref={modelTriggerRef}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={[styles.suggestion, styles.modelSuggestion]}>
                <Bot
                  color={palette.accent}
                  size={iconSize.small}
                  strokeWidth={1.7}
                />
                <Text numberOfLines={1} style={styles.suggestionText}>
                  {modelName || copy.chooseModel}
                </Text>
                <ChevronRight
                  color={palette.smoke}
                  size={iconSize.small}
                  strokeWidth={1.7}
                />
              </View>
            </NativePressable>
          ) : null}
          {AGENT_PRESETS.map((preset) => (
            <PresetSuggestion
              analyzing={analyzing}
              key={preset.id}
              language={language}
              onSelect={selectPreset}
              preset={preset}
            />
          ))}
        </ScrollView>
      </View>

      <Animated.View
        layout={LinearTransition.duration(motion.standard).reduceMotion(
          ReduceMotion.System,
        )}
        style={styles.composerCluster}
      >
        <ComposerBox
          accent={accent}
          analyzing={analyzing}
          attachments={attachments}
          language={language}
          onAttachPress={togglePhotoTray}
          onRemoveAttachment={removeAttachment}
          photoTrayOpen={photoTrayOpen}
        />

        <PhotoLibraryPicker
          expanded={galleryExpanded}
          footer={<View style={styles.galleryComposerDock}>{composerBox}</View>}
          language={language}
          onExpandedChange={setGalleryExpanded}
          onTogglePhoto={togglePhoto}
          open={photoTrayOpen}
          selected={attachments}
        />
      </Animated.View>
    </View>
  );
}

function PresetSuggestion({
  analyzing,
  language,
  onSelect,
  preset,
}: {
  analyzing: boolean;
  language: AppLanguage;
  onSelect: (preset: AgentPreset) => void;
  preset: AgentPreset;
}) {
  const Icon = preset.id === "create_meeting" ? CalendarPlus : ContactRound;
  const aui = useAui();
  return (
    <NativePressable
      accessibilityHint={
        language === "zh"
          ? `载入真实截图：${preset.imageLabel}`
          : `Load real screenshot: ${preset.imageLabel}`
      }
      accessibilityLabel={preset.label[language]}
      accessibilityRole="button"
      disabled={analyzing}
      hitSlop={4}
      onPress={() => {
        onSelect(preset);
        aui.composer.setText(preset.instruction[language]);
      }}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={[styles.suggestion, styles.presetSuggestion]}>
        <Icon
          color={palette.mist}
          size={iconSize.small}
          strokeWidth={1.7}
        />
        <Text style={styles.suggestionText}>{preset.label[language]}</Text>
      </View>
    </NativePressable>
  );
}

function ComposerBox({
  accent,
  analyzing,
  attachments,
  language,
  onAttachPress,
  onRemoveAttachment,
  photoTrayOpen = false,
}: ComposerBoxProps) {
  const copy = composerCopy[language];
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const note = useAuiState((state) => state.composer.text);
  const canSend =
    !analyzing && (note.trim().length > 0 || attachments.length > 0);

  return (
    <ComposerPrimitive.Root style={styles.composer}>
      {attachments.length > 0 ? (
        <View style={styles.attachmentTray}>
          <ScrollView
            contentContainerStyle={styles.attachments}
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
          >
            {attachments.map((attachment, index) => (
              <View key={`${attachment.uri ?? attachment.label}-${index}`}>
                {attachment.uri ? (
                  <Pressable
                    accessibilityHint={copy.previewImageHint}
                    accessibilityLabel={`${copy.previewImageLabel} ${index + 1}`}
                    accessibilityRole="button"
                    onPress={() => setPreviewUri(attachment.uri ?? null)}
                    style={({ pressed }) => pressed && styles.thumbnailPressed}
                  >
                    <Image
                      contentFit="cover"
                      source={attachment.uri}
                      style={styles.thumbnail}
                    />
                  </Pressable>
                ) : (
                  <View style={styles.demoThumbnail}>
                    <View style={styles.demoLine} />
                    <View style={[styles.demoLine, styles.demoLineShort]} />
                  </View>
                )}
                <Pressable
                  accessibilityLabel={
                    language === "zh"
                      ? `移除第 ${index + 1} 张图片`
                      : `Remove image ${index + 1}`
                  }
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => onRemoveAttachment(index)}
                  style={styles.removeAttachment}
                >
                  <X
                    color={palette.void}
                    size={iconSize.tiny}
                    strokeWidth={2.2}
                  />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        {onAttachPress ? (
          <Pressable
            accessibilityLabel={copy.addImagesLabel}
            accessibilityRole="button"
            accessibilityState={{ expanded: photoTrayOpen }}
            onPress={onAttachPress}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View
              style={[
                styles.attachButton,
                photoTrayOpen && styles.attachButtonActive,
              ]}
            >
              {photoTrayOpen ? (
                <X
                  color={palette.ink}
                  size={iconSize.medium}
                  strokeWidth={1.9}
                />
              ) : (
                <Plus
                  color={palette.mist}
                  size={iconSize.large}
                  strokeWidth={1.8}
                />
              )}
            </View>
          </Pressable>
        ) : null}
        <View style={styles.textareaWrap}>
          <ComposerPrimitive.Input
            accessibilityLabel={copy.messageLabel}
            maxFontSizeMultiplier={1.35}
            multiline
            placeholder={copy.placeholder}
            placeholderTextColor={palette.smoke}
            scrollEnabled
            selectionColor={palette.paper}
            style={styles.input}
            submitMode="none"
          />
        </View>
        <ComposerPrimitive.Send
          accessibilityLabel={copy.sendLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          hitSlop={4}
          style={({ pressed }) =>
            pressed && canSend ? styles.sendPressed : undefined
          }
        >
          <View
            style={[
              styles.sendButton,
              { backgroundColor: accent },
              !canSend && styles.sendDisabled,
            ]}
          >
            <ArrowUp
              color={canSend ? palette.ink : palette.smoke}
              size={iconSize.medium}
              strokeWidth={2.4}
            />
          </View>
        </ComposerPrimitive.Send>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setPreviewUri(null)}
        transparent
        visible={Boolean(previewUri)}
      >
        <View style={styles.previewBackdrop}>
          <Pressable
            accessibilityLabel={copy.closePreview}
            accessibilityRole="button"
            onPress={() => setPreviewUri(null)}
            style={styles.previewClose}
          >
            <X color="#FFFFFF" size={iconSize.large} strokeWidth={2} />
          </Pressable>
          {previewUri ? (
            <Image
              accessibilityLabel={copy.previewImageLabel}
              contentFit="contain"
              source={previewUri}
              style={styles.previewImage}
            />
          ) : null}
        </View>
      </Modal>
    </ComposerPrimitive.Root>
  );
}

const composerCopy = {
  zh: {
    limitTitle: "最多添加 9 张图片",
    limitBody: "请先移除一张，再继续添加。",
    imageOnlyPrompt: "请分析这些截图，只建议证据充分的联系人或会议动作。",
    placeholder: "输入消息…",
    messageLabel: "给 ContactFlow Agent 发消息",
    addImagesLabel: "打开最近照片",
    sendLabel: "发送给 ContactFlow Agent",
    chooseModel: "选择模型",
    previewImageLabel: "查看图片",
    previewImageHint: "打开大图预览",
    closePreview: "关闭图片预览",
  },
  en: {
    limitTitle: "Up to 9 images",
    limitBody: "Remove an image before adding another.",
    imageOnlyPrompt:
      "Analyze these screenshots and propose only evidence-backed contact or meeting actions.",
    placeholder: "Message…",
    messageLabel: "Message ContactFlow Agent",
    addImagesLabel: "Open recent photos",
    sendLabel: "Send to ContactFlow Agent",
    chooseModel: "Choose model",
    previewImageLabel: "View image",
    previewImageHint: "Open a full-size preview",
    closePreview: "Close image preview",
  },
} as const;

const styles = StyleSheet.create({
  shell: { gap: spacing.sm },
  composerCluster: { position: "relative" },
  suggestionBar: {
    minHeight: 36,
  },
  suggestionScroll: { flexGrow: 0 },
  suggestions: {
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  suggestion: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    backgroundColor: palette.graphite,
  },
  modelSuggestion: { maxWidth: 180 },
  presetSuggestion: { borderColor: palette.lineSoft },
  suggestionText: {
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
    lineHeight: 16,
  },
  composer: {
    zIndex: 1,
    minHeight: 56,
    borderRadius: radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.ink,
    padding: 6,
  },
  attachmentTray: { marginBottom: spacing.sm },
  attachments: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: 2,
    paddingTop: 6,
  },
  thumbnail: { width: 62, height: 62, borderRadius: 14 },
  thumbnailPressed: { opacity: 0.78 },
  demoThumbnail: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: palette.paper,
    justifyContent: "center",
    padding: 8,
    gap: 5,
  },
  demoLine: { height: 3, borderRadius: 2, backgroundColor: palette.void },
  demoLineShort: { width: "65%", alignSelf: "flex-end" },
  removeAttachment: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paper,
    borderWidth: 2,
    borderColor: palette.graphite,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 11, 9, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.hero,
  },
  previewImage: { width: "100%", height: "86%" },
  previewClose: {
    position: "absolute",
    right: spacing.lg,
    top: spacing.hero,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: INPUT_MIN_HEIGHT,
    maxHeight: INPUT_MAX_HEIGHT,
    color: palette.paper,
    fontFamily: fonts.body,
    fontSize: typeScale.body,
    lineHeight: 23,
    paddingHorizontal: spacing.sm,
    paddingVertical: 11,
    textAlignVertical: "top",
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs },
  textareaWrap: { flex: 1, minWidth: 0 },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.graphite,
  },
  attachButtonActive: { backgroundColor: palette.accent },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paper,
    marginLeft: "auto",
  },
  sendDisabled: { backgroundColor: palette.graphite },
  galleryComposerDock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.lineSoft,
    backgroundColor: palette.void,
  },
  sendPressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  pressed: { opacity: 0.62 },
});
