import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { ArrowUp, ImagePlus, X } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
} from "react-native";

import { Box as View } from "@/components/ui/box";
import { Image } from "@/components/ui/image";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { fonts, palette, radius, spacing } from "@/constants/theme";
import type { ChatAttachment } from "@/domain/chat";
import type { AppLanguage } from "@/domain/preferences";
import { SAMPLE_CONTEXT, UPDATE_CONTEXT } from "@/domain/demo-agent";

type ChatComposerProps = {
  analyzing: boolean;
  accent: string;
  language: AppLanguage;
  onSend: (note: string, attachments: ChatAttachment[]) => void;
};

const MAX_ATTACHMENTS = 9;

/** Capture, context, and send stay inside one familiar chat composer. */
export function ChatComposer({
  accent,
  analyzing,
  language,
  onSend,
}: ChatComposerProps) {
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const copy = composerCopy[language];

  const pickImage = async () => {
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining === 0) {
      Alert.alert(copy.limitTitle, copy.limitBody);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (result.canceled) return;

      const selected = result.assets.slice(0, remaining);
      const compressed = await Promise.all(
        selected.map(async (asset, index) => {
          const context = ImageManipulator.manipulate(asset.uri);
          if (asset.width > 2048) context.resize({ width: 2048 });
          const rendered = await context.renderAsync();
          const saved = await rendered.saveAsync({
            compress: 0.82,
            format: SaveFormat.JPEG,
          });
          return {
            uri: saved.uri,
            label: asset.fileName ?? `聊天截图 ${attachments.length + index + 1}`,
            isDemo: false,
          };
        }),
      );
      setAttachments((current) =>
        [...current, ...compressed].slice(0, MAX_ATTACHMENTS),
      );
    } catch {
      Alert.alert(copy.imageError, copy.imageErrorBody);
    }
  };

  const applySample = (sample: string) => {
    setNote(sample);
    setAttachments([{ label: "聊天截图 · 示例", isDemo: true }]);
  };

  const send = () => {
    onSend(note.trim(), attachments);
    setNote("");
    setAttachments([]);
  };

  const canSend =
    !analyzing && (note.trim().length > 0 || attachments.length > 0);

  return (
    <View style={styles.shell}>
      <View style={styles.suggestions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.meetingContact}
          onPress={() => applySample(SAMPLE_CONTEXT)}
          style={({ pressed }) => [
            styles.suggestion,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.suggestionText}>{copy.meetingContact}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.updateContact}
          onPress={() => applySample(UPDATE_CONTEXT)}
          style={({ pressed }) => [
            styles.suggestion,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.suggestionText}>{copy.updateContact}</Text>
        </Pressable>
      </View>

      {attachments.length > 0 ? (
        <View style={styles.attachmentTray}>
          <View style={styles.trayHeader}>
            <Text style={styles.trayLabel}>{copy.selectedImages}</Text>
            <Text style={styles.trayCount}>
              {attachments.length} / {MAX_ATTACHMENTS}
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.attachments}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {attachments.map((attachment, index) => (
              <View key={`${attachment.uri ?? attachment.label}-${index}`}>
                {attachment.uri ? (
                  <Image
                    source={{ uri: attachment.uri }}
                    style={styles.thumbnail}
                  />
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
                  onPress={() =>
                    setAttachments((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  style={styles.removeAttachment}
                >
                  <X color={palette.void} size={12} strokeWidth={2.2} />
                </Pressable>
              </View>
            ))}
            {attachments.length < MAX_ATTACHMENTS ? (
              <Pressable
                accessibilityLabel={copy.continueAdding}
                accessibilityRole="button"
                onPress={pickImage}
                style={({ pressed }) => [
                  styles.addMore,
                  pressed && styles.pressed,
                ]}
              >
                <ImagePlus color={palette.mist} size={21} strokeWidth={1.5} />
                <Text style={styles.addMoreText}>{copy.add}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.composer}>
        <Textarea className="h-auto min-h-[54px] border-0 bg-transparent">
          <TextareaInput
            accessibilityLabel={copy.messageLabel}
            multiline
            onChangeText={setNote}
            placeholder={copy.placeholder}
            placeholderTextColor={palette.smoke}
            selectionColor={palette.paper}
            style={styles.input}
            value={note}
          />
        </Textarea>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.addImagesLabel}
            onPress={pickImage}
            style={({ pressed }) => [
              styles.attachButton,
              pressed && styles.pressed,
            ]}
          >
            <ImagePlus color={palette.mist} size={21} strokeWidth={1.6} />
          </Pressable>
          <Text style={styles.privacy}>
            {attachments.length > 0
                  ? `${attachments.length} / ${MAX_ATTACHMENTS} · ${copy.localProcessing}`
                  : copy.localAgent}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.sendLabel}
            disabled={!canSend}
            onPress={send}
            style={({ pressed }) => [
              styles.sendButton,
              { backgroundColor: accent },
              !canSend && styles.sendDisabled,
              pressed && canSend && styles.sendPressed,
            ]}
          >
            <ArrowUp color={palette.void} size={19} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const composerCopy = {
  zh: {
    limitTitle: "最多添加 9 张图片",
    limitBody: "请先移除一张，再继续添加。",
    imageError: "无法读取图片",
    imageErrorBody: "请检查相册权限后重试。",
    meetingContact: "会议 + 联系人",
    updateContact: "更新联系人",
    selectedImages: "已选图片",
    add: "添加",
    placeholder: "输入消息，或添加最多 9 张图片…",
    localProcessing: "本地处理",
    localAgent: "本地 Demo Agent",
    continueAdding: "继续添加图片",
    messageLabel: "给 ContactFlow Agent 发消息",
    addImagesLabel: "添加图片，最多 9 张",
    sendLabel: "发送给 ContactFlow Agent",
  },
  en: {
    limitTitle: "Up to 9 images",
    limitBody: "Remove an image before adding another.",
    imageError: "Unable to open images",
    imageErrorBody: "Check Photos permission and try again.",
    meetingContact: "Meeting + contact",
    updateContact: "Update contact",
    selectedImages: "Selected images",
    add: "Add",
    placeholder: "Message, or add up to 9 images…",
    localProcessing: "on-device",
    localAgent: "Local demo agent",
    continueAdding: "Add more images",
    messageLabel: "Message ContactFlow Agent",
    addImagesLabel: "Add up to 9 images",
    sendLabel: "Send to ContactFlow Agent",
  },
} as const;

const styles = StyleSheet.create({
  shell: { gap: spacing.sm },
  suggestions: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    backgroundColor: "rgba(17,18,16,0.94)",
  },
  suggestionText: {
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  composer: {
    minHeight: 108,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(247,246,238,0.18)",
    backgroundColor: "#191A18",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  attachmentTray: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  trayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
  },
  trayLabel: {
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  trayCount: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: 9,
  },
  attachments: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingTop: 5,
  },
  thumbnail: { width: 62, height: 62, borderRadius: 14 },
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
  addMore: {
    width: 62,
    height: 62,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: palette.ink,
  },
  addMoreText: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 9,
  },
  input: {
    minHeight: 38,
    maxHeight: 110,
    color: palette.paper,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 2,
    paddingVertical: 4,
    textAlignVertical: "top",
  },
  actions: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
  },
  attachButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  privacy: {
    flex: 1,
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paper,
  },
  sendDisabled: { opacity: 0.28 },
  sendPressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  pressed: { opacity: 0.62 },
});
