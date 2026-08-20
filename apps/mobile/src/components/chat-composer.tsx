import { Image } from "expo-image";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import {
  ArrowUp,
  Bot,
  CalendarPlus,
  ChevronRight,
  ContactRound,
  Plus,
  Square,
  X,
} from "lucide-react-native";
import {
  type ComponentRef,
  createContext,
  useContext,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Image as NativeImage,
  Pressable as NativePressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import Animated, {
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";

import {
  PhotoLibraryPicker,
  type PhotoLibraryItem,
} from "@/components/photo-library-picker";
import { ImagePreviewModal } from "@/components/image-preview-modal";
import type { ComposerMenuAnchor } from "@/components/model-switcher";
import { Box as View } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  fonts,
  hues,
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
import type { AppLanguage } from "@/domain/preferences";

type ChatComposerProps = {
  language: AppLanguage;
  modelName?: string;
  onModelPress?: (anchor: ComposerMenuAnchor) => void;
  onQueue?: (note: string, attachments: ChatAttachment[]) => void;
};

const MAX_ATTACHMENTS = 9;
const INPUT_MIN_HEIGHT = 44;
const INPUT_MAX_HEIGHT = 112;

const PRESET_IMAGE_MODULES: Record<AgentPresetId, number> = {
  create_contact: require("../../assets/e2e/create-contact.jpg"),
  create_meeting: require("../../assets/e2e/create-meeting.jpg"),
  update_contact: require("../../assets/e2e/update-contact.jpg"),
};

function imageUriFromContent(
  content: readonly { type: string; image?: string }[] | undefined,
) {
  const imagePart = content?.find((part) => part.type === "image");
  return imagePart?.image;
}

/** Lets attachment thumbs open the preview modal owned by the composer box. */
const PreviewContext = createContext<(uri: string) => void>(() => undefined);

/**
 * Capture, context, and send stay inside one familiar chat composer, wired to
 * the screen's assistant-ui runtime (text, attachments, send, cancel).
 */
export function ChatComposer({
  language,
  modelName,
  onModelPress,
  onQueue,
}: ChatComposerProps) {
  const [photoTrayOpen, setPhotoTrayOpen] = useState(false);
  const [galleryExpanded, setGalleryExpanded] = useState(false);
  const modelTriggerRef = useRef<ComponentRef<typeof NativePressable>>(null);
  const composerText = useAuiState((state) => state.composer.text);
  const attachments = useAuiState((state) => state.composer.attachments);
  const running = useAuiState((state) => state.thread.isRunning);
  const aui = useAui();
  const copy = composerCopy[language];

  const closeTrays = () => {
    setPhotoTrayOpen(false);
    setGalleryExpanded(false);
  };

  const selectPreset = (preset: AgentPreset) => {
    const uri = NativeImage.resolveAssetSource(
      PRESET_IMAGE_MODULES[preset.id],
    ).uri;
    void aui.composer.clearAttachments();
    void aui.composer.addAttachment({
      id: `preset-${preset.id}`,
      type: "image",
      name: preset.imageLabel,
      contentType: "image/jpeg",
      content: [{ type: "image", image: uri }],
    });
    aui.composer.setText(preset.instruction[language]);
    closeTrays();
  };

  const togglePhoto = (photo: PhotoLibraryItem) => {
    const id = `photo-${photo.uri}`;
    const existing = attachments.find((attachment) => attachment.id === id);
    if (existing) {
    void aui.composer.attachment({ id: existing.id }).remove();
      return;
    }
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert(copy.limitTitle, copy.limitBody);
      return;
    }
    if (!composerText.trim()) aui.composer.setText(copy.imageOnlyPrompt);
    void aui.composer.addAttachment({
      id,
      type: "image",
      name: photo.label,
      contentType: "image/jpeg",
      content: [{ type: "image", image: photo.uri }],
    });
  };

  const togglePhotoTray = () => {
    setPhotoTrayOpen((current) => !current);
    if (photoTrayOpen) setGalleryExpanded(false);
  };

  const queueCurrentInput = () => {
    const note = composerText.trim();
    if (!note && attachments.length === 0) return;
    onQueue?.(
      note,
      attachments.map((attachment) => ({
        isDemo: false,
        label: attachment.name,
        uri: imageUriFromContent(attachment.content),
      })),
    );
    void aui.composer.reset();
    closeTrays();
  };

  const selectedAttachments: ChatAttachment[] = attachments.map(
    (attachment) => ({
      isDemo: false,
      label: attachment.name,
      uri: imageUriFromContent(attachment.content),
    }),
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
              key={preset.id}
              language={language}
              onSelect={selectPreset}
              preset={preset}
              running={running}
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
          language={language}
          onAttachPress={togglePhotoTray}
          onQueue={queueCurrentInput}
          photoTrayOpen={photoTrayOpen}
        />

        <PhotoLibraryPicker
          expanded={galleryExpanded}
          footer={
            <View style={styles.galleryComposerDock}>
              <ComposerBox language={language} onQueue={queueCurrentInput} />
            </View>
          }
          language={language}
          onExpandedChange={setGalleryExpanded}
          onTogglePhoto={togglePhoto}
          open={photoTrayOpen}
          selected={selectedAttachments}
        />
      </Animated.View>
    </View>
  );
}

function PresetSuggestion({
  language,
  onSelect,
  preset,
  running,
}: {
  language: AppLanguage;
  onSelect: (preset: AgentPreset) => void;
  preset: AgentPreset;
  running: boolean;
}) {
  const Icon = preset.id === "create_meeting" ? CalendarPlus : ContactRound;
  return (
    <NativePressable
      accessibilityHint={
        language === "zh"
          ? `载入真实截图：${preset.imageLabel}`
          : `Load real screenshot: ${preset.imageLabel}`
      }
      accessibilityLabel={preset.label[language]}
      accessibilityRole="button"
      disabled={running}
      hitSlop={4}
      onPress={() => onSelect(preset)}
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
  language,
  onAttachPress,
  onQueue,
  photoTrayOpen = false,
}: {
  language: AppLanguage;
  onAttachPress?: () => void;
  onQueue?: () => void;
  photoTrayOpen?: boolean;
}) {
  const copy = composerCopy[language];
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const closePreview = () => setPreviewUri(null);
  const note = useAuiState((state) => state.composer.text);
  const hasAttachments = useAuiState(
    (state) => state.composer.attachments.length > 0,
  );
  const running = useAuiState((state) => state.thread.isRunning);
  const hasInput = note.trim().length > 0 || hasAttachments;

  return (
    <PreviewContext.Provider value={setPreviewUri}>
      <ComposerPrimitive.Root style={styles.composer}>
        {hasAttachments ? (
          <View style={styles.attachmentTray}>
            <ScrollView
              contentContainerStyle={styles.attachments}
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
              <ComposerPrimitive.Attachments
                components={composerAttachmentComponents}
              />
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
        {running && !hasInput ? (
          <ComposerPrimitive.Cancel
            accessibilityLabel={copy.stopLabel}
            accessibilityRole="button"
            hitSlop={4}
            style={({ pressed }) => pressed && styles.sendPressed}
          >
            <View style={[styles.sendButton, styles.stopButton]}>
              <Square
                color={hues.rose.foreground}
                fill={hues.rose.foreground}
                size={iconSize.small}
                strokeWidth={2.2}
              />
            </View>
          </ComposerPrimitive.Cancel>
        ) : running && hasInput ? (
          <Pressable
            accessibilityLabel={copy.queueLabel}
            accessibilityRole="button"
            hitSlop={4}
            onPress={onQueue}
            style={({ pressed }) => pressed && styles.sendPressed}
          >
            <View style={[styles.sendButton, styles.accentSendButton]}>
              <ArrowUp
                color={palette.ink}
                size={iconSize.medium}
                strokeWidth={2.4}
              />
            </View>
          </Pressable>
        ) : (
          <ComposerPrimitive.Send
            accessibilityLabel={copy.sendLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasInput }}
            disabled={!hasInput}
            hitSlop={4}
            style={({ pressed }) =>
              pressed && hasInput ? styles.sendPressed : undefined
            }
          >
            <View
              style={[
                styles.sendButton,
                styles.accentSendButton,
                !hasInput && styles.sendDisabled,
              ]}
            >
              <ArrowUp
                color={hasInput ? palette.ink : palette.smoke}
                size={iconSize.medium}
                strokeWidth={2.4}
              />
            </View>
          </ComposerPrimitive.Send>
        )}
      </View>

      <ImagePreviewModal
        language={language}
        onClose={closePreview}
        uri={previewUri}
      />
        </ComposerPrimitive.Root>
    </PreviewContext.Provider>
  );
}

const composerAttachmentComponents = { Attachment: ComposerAttachmentItem };

function ComposerAttachmentItem() {
  const onPreview = useContext(PreviewContext);
  const attachment = useAuiState((state) => state.attachment);
  const uri = imageUriFromContent(attachment.content);

  return (
    <AttachmentPrimitive.Root style={styles.attachmentItem}>
      {uri ? (
        <Pressable
          accessibilityHint={composerCopy.zh.previewImageHint}
          accessibilityLabel={attachment.name}
          accessibilityRole="button"
          onPress={() => onPreview(uri)}
          style={({ pressed }) => pressed && styles.thumbnailPressed}
        >
          <Image contentFit="cover" source={uri} style={styles.thumbnail} />
        </Pressable>
      ) : (
        <View style={styles.demoThumbnail}>
          <View style={styles.demoLine} />
          <View style={[styles.demoLine, styles.demoLineShort]} />
        </View>
      )}
      <AttachmentPrimitive.Remove
        accessibilityLabel={attachment.name}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.removeAttachment}
      >
        <X color={palette.void} size={iconSize.tiny} strokeWidth={2.2} />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
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
    previewImageHint: "打开大图预览",
    stopLabel: "停止分析",
    queueLabel: "排队等待发送",
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
    previewImageHint: "Open a full-size preview",
    stopLabel: "Stop analyzing",
    queueLabel: "Queue message",
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
  attachmentItem: { width: 62, height: 62, alignSelf: "flex-start" },
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
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
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
  },
  accentSendButton: { backgroundColor: palette.accent },
  sendDisabled: { backgroundColor: palette.graphite },
  stopButton: { backgroundColor: hues.rose.background },
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
