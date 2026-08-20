import {
  ArrowUpRight,
  Lightbulb,
  Mail,
  PencilLine,
  Send,
  X,
} from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
} from "react-native";

import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import {
  fonts,
  iconSize,
  palette,
  radius,
  spacing,
  typeScale,
} from "@/constants/theme";
import type { Insight, SuggestedEmailAction } from "@/domain/actions";
import type { AppLanguage } from "@/domain/preferences";

const insightCopy = {
  zh: {
    suggestion: "下一步建议",
    insight: "关系洞察",
    evidence: "依据",
    edit: "编辑",
    execute: "执行",
    editEmail: "编辑邮件",
    to: "收件人",
    subject: "主题",
    bodyLabel: "正文",
    cancel: "取消",
    save: "保存",
    send: "打开邮箱发送",
    mailError: "无法打开邮箱 App",
    mailErrorBody: "请确认设备上已配置邮箱账户。",
  },
  en: {
    suggestion: "NEXT STEP",
    insight: "INSIGHT",
    evidence: "Evidence",
    edit: "Edit",
    execute: "Execute",
    editEmail: "Edit email",
    to: "To",
    subject: "Subject",
    bodyLabel: "Body",
    cancel: "Cancel",
    save: "Save",
    send: "Open mail app",
    mailError: "Cannot open the mail app",
    mailErrorBody: "Make sure a mail account is configured on this device.",
  },
} as const;

function mailtoUrl(action: SuggestedEmailAction) {
  const query = [
    `subject=${encodeURIComponent(action.subject)}`,
    `body=${encodeURIComponent(action.body)}`,
  ].join("&");
  return `mailto:${encodeURIComponent(action.to)}?${query}`;
}

export function InsightCard({
  insight,
  language,
}: {
  insight: Insight;
  language: AppLanguage;
}) {
  const isSuggestion = insight.kind === "suggestion";
  const Icon = isSuggestion ? ArrowUpRight : Lightbulb;
  const copy = insightCopy[language];
  const [draft, setDraft] = useState(insight.suggestedAction);
  const [editing, setEditing] = useState(false);

  const openMail = async (action: SuggestedEmailAction) => {
    try {
      await Linking.openURL(mailtoUrl(action));
    } catch {
      Alert.alert(copy.mailError, copy.mailErrorBody);
    }
  };

  return (
    <Card style={[styles.card, isSuggestion && styles.suggestionCard]}>
      <View style={[styles.iconWrap, isSuggestion && styles.suggestionIcon]}>
        <Icon color={palette.paper} size={iconSize.small} strokeWidth={1.7} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.kicker, isSuggestion && styles.suggestionKicker]}>
          {isSuggestion ? copy.suggestion : copy.insight}
        </Text>
        <Text style={styles.title}>{insight.title}</Text>
        <Text style={styles.body}>{insight.body}</Text>
        {draft ? (
          <View style={styles.emailPreview}>
            <Mail color={palette.accent} size={iconSize.small} strokeWidth={1.7} />
            <View style={styles.emailPreviewCopy}>
              <Text numberOfLines={1} style={styles.emailLine}>
                {draft.to || copy.to}
              </Text>
              <Text numberOfLines={1} style={styles.emailSubject}>
                {draft.subject}
              </Text>
            </View>
          </View>
        ) : null}
        {draft ? (
          <View style={styles.actionsRow}>
            <Pressable
              accessibilityLabel={copy.edit}
              accessibilityRole="button"
              onPress={() => setEditing(true)}
              style={({ pressed }) => [
                styles.actionButton,
                styles.editButton,
                pressed && styles.pressed,
              ]}
            >
              <PencilLine
                color={palette.mist}
                size={iconSize.small}
                strokeWidth={1.8}
              />
              <Text style={styles.editText}>{copy.edit}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={copy.execute}
              accessibilityRole="button"
              onPress={() => void openMail(draft)}
              style={({ pressed }) => [
                styles.actionButton,
                styles.executeButton,
                pressed && styles.pressed,
              ]}
            >
              <Send color={palette.void} size={iconSize.small} strokeWidth={2} />
              <Text style={styles.executeText}>{copy.execute}</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.evidence}>
          {copy.evidence} · {insight.evidenceIds.join(" · ")}
        </Text>
      </View>
      {draft ? (
        <EmailEditorModal
          action={draft}
          language={language}
          onClose={() => setEditing(false)}
          onSave={(next) => {
            setDraft(next);
            setEditing(false);
          }}
          onSend={(next) => {
            setDraft(next);
            setEditing(false);
            void openMail(next);
          }}
          visible={editing}
        />
      ) : null}
    </Card>
  );
}

function EmailEditorModal({
  action,
  language,
  onClose,
  onSave,
  onSend,
  visible,
}: {
  action: SuggestedEmailAction;
  language: AppLanguage;
  onClose: () => void;
  onSave: (action: SuggestedEmailAction) => void;
  onSend: (action: SuggestedEmailAction) => void;
  visible: boolean;
}) {
  const copy = insightCopy[language];
  const [to, setTo] = useState(action.to);
  const [subject, setSubject] = useState(action.subject);
  const [body, setBody] = useState(action.body);

  // Reset the draft every time the editor is opened (render-time state adjust).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setTo(action.to);
      setSubject(action.subject);
      setBody(action.body);
    }
  }

  const draft: SuggestedEmailAction = {
    type: "send_email",
    to: to.trim(),
    subject: subject.trim() || action.subject,
    body: body.trim() || action.body,
  };
  const canSend = Boolean(draft.subject && draft.body);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel={copy.cancel}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.dialogWrap}
        >
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>{copy.editEmail}</Text>
              <Pressable
                accessibilityLabel={copy.cancel}
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <X color={palette.smoke} size={iconSize.medium} strokeWidth={1.8} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>{copy.to}</Text>
            <Input style={styles.fieldInput}>
              <InputField
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setTo}
                placeholder="name@example.com"
                placeholderTextColor={palette.smoke}
                selectionColor={palette.paper}
                style={styles.fieldText}
                value={to}
              />
            </Input>

            <Text style={styles.fieldLabel}>{copy.subject}</Text>
            <Input style={styles.fieldInput}>
              <InputField
                onChangeText={setSubject}
                placeholder={copy.subject}
                placeholderTextColor={palette.smoke}
                selectionColor={palette.paper}
                style={styles.fieldText}
                value={subject}
              />
            </Input>

            <Text style={styles.fieldLabel}>{copy.bodyLabel}</Text>
            <Textarea style={styles.fieldTextarea}>
              <TextareaInput
                multiline
                onChangeText={setBody}
                placeholder={copy.bodyLabel}
                placeholderTextColor={palette.smoke}
                selectionColor={palette.paper}
                style={[styles.fieldText, styles.fieldTextMultiline]}
                value={body}
              />
            </Textarea>

            <View style={styles.dialogActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onSave(draft)}
                style={({ pressed }) => [
                  styles.dialogButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.dialogCancel}>{copy.save}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!canSend}
                onPress={() => onSend(draft)}
                style={({ pressed }) => [
                  styles.dialogButton,
                  styles.dialogSave,
                  !canSend && styles.dialogButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Send color={palette.void} size={iconSize.small} strokeWidth={2} />
                <Text style={styles.dialogSaveText}>{copy.send}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: palette.graphite,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.ink,
  },
  suggestionCard: {
    backgroundColor: palette.ink,
    borderColor: palette.accent,
  },
  suggestionIcon: { backgroundColor: palette.glow },
  content: { flex: 1, minWidth: 0 },
  kicker: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
    letterSpacing: 0.5,
  },
  suggestionKicker: { color: palette.accent },
  title: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.subheading,
    marginTop: spacing.sm,
  },
  body: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  emailPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.graphite,
  },
  emailPreviewCopy: { flex: 1, minWidth: 0 },
  emailLine: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 17,
  },
  emailSubject: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
    lineHeight: 18,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  editButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    backgroundColor: palette.graphite,
  },
  editText: {
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
  },
  executeButton: { backgroundColor: palette.accent },
  executeText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
  },
  evidence: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    marginTop: spacing.md,
  },
  overlay: { flex: 1, backgroundColor: palette.overlay },
  dialogWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  dialog: {
    width: "100%",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.ink,
    padding: spacing.lg,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  dialogTitle: {
    color: palette.paper,
    fontFamily: fonts.display,
    fontSize: typeScale.subheading,
  },
  fieldLabel: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
    letterSpacing: 0.35,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  fieldInput: {
    height: 40,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.graphite,
  },
  fieldText: {
    color: palette.paper,
    fontFamily: fonts.body,
    fontSize: typeScale.body,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  fieldTextarea: {
    minHeight: 120,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.graphite,
  },
  fieldTextMultiline: { minHeight: 112, textAlignVertical: "top" },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dialogButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  dialogCancel: {
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  dialogSave: { backgroundColor: palette.accent },
  dialogButtonDisabled: { opacity: 0.4 },
  dialogSaveText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  pressed: { opacity: 0.62 },
});
