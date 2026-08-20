import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { Camera, ChevronRight, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet } from "react-native";

import { ProfileAvatar } from "@/components/profile-avatar";
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
import type { AppLanguage } from "@/domain/preferences";
import { useContactFlow } from "@/store/use-contactflow";

const editorCopy = {
  zh: {
    title: "编辑我的信息",
    changeAvatar: "更换头像",
    name: "昵称",
    namePlaceholder: "你的昵称",
    bio: "个人简介",
    bioPlaceholder: "简单介绍一下自己",
    email: "邮箱",
    emailPlaceholder: "name@example.com",
    cancel: "取消",
    save: "保存",
    avatarError: "无法选择头像",
    avatarErrorBody: "请检查相册权限后重试。",
    edit: "编辑",
    noBio: "还没有填写简介",
  },
  en: {
    title: "Edit profile",
    changeAvatar: "Change photo",
    name: "Display name",
    namePlaceholder: "Your name",
    bio: "Bio",
    bioPlaceholder: "A short introduction",
    email: "Email",
    emailPlaceholder: "name@example.com",
    cancel: "Cancel",
    save: "Save",
    avatarError: "Unable to choose a photo",
    avatarErrorBody: "Check Photos permission and try again.",
    edit: "Edit",
    noBio: "No bio yet",
  },
} as const;

/** Read-only profile summary; tapping opens the editor modal. */
export function ProfileSummaryCard({
  language,
  onPress,
}: {
  language: AppLanguage;
  onPress: () => void;
}) {
  const profile = useContactFlow((state) => state.profile);
  const copy = editorCopy[language];
  const subtitle = profile.bio.trim() || profile.email.trim() || copy.noBio;

  return (
    <Pressable
      accessibilityHint={copy.edit}
      accessibilityLabel={`${copy.edit}: ${profile.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.summaryCard}>
        <ProfileAvatar
          className="h-11 w-11"
          initialStyle={styles.summaryInitial}
          name={profile.name}
          style={{ backgroundColor: palette.accent }}
          uri={profile.avatarUri}
        />
        <View style={styles.summaryCopy}>
          <Text numberOfLines={1} style={styles.summaryName}>
            {profile.name || "—"}
          </Text>
          <Text numberOfLines={1} style={styles.summaryMeta}>
            {subtitle}
          </Text>
        </View>
        <ChevronRight
          color={palette.smoke}
          size={iconSize.small}
          strokeWidth={1.8}
        />
      </Card>
    </Pressable>
  );
}

/** Modal editor: avatar picker plus name / bio / email fields. */
export function ProfileEditorModal({
  language,
  onClose,
  visible,
}: {
  language: AppLanguage;
  onClose: () => void;
  visible: boolean;
}) {
  const profile = useContactFlow((state) => state.profile);
  const updateProfile = useContactFlow((state) => state.updateProfile);
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [email, setEmail] = useState(profile.email);
  const copy = editorCopy[language];

  // Reset the draft every time the editor is opened (render-time state adjust).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(profile.name);
      setBio(profile.bio);
      setEmail(profile.email);
    }
  }

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ["images"],
        quality: 0.86,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        // ImagePicker hands us a cache URI that does not survive app updates;
        // copy it into the document directory so the avatar persists.
        const extension = asset.uri.split(".").pop() ?? "jpg";
        const target = new File(Paths.document, `avatar-${Date.now()}.${extension}`);
        new File(asset.uri).copy(target);
        updateProfile({ avatarUri: target.uri });
      }
    } catch {
      Alert.alert(copy.avatarError, copy.avatarErrorBody);
    }
  };

  const save = () => {
    updateProfile({ bio: bio.trim(), email: email.trim(), name: name.trim() });
    onClose();
  };

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
              <Text style={styles.dialogTitle}>{copy.title}</Text>
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

            <View style={styles.avatarRow}>
              <ProfileAvatar
                className="h-14 w-14"
                initialStyle={styles.editorInitial}
                name={name}
                style={{ backgroundColor: palette.accent }}
                uri={profile.avatarUri}
              />
              <Pressable
                accessibilityLabel={copy.changeAvatar}
                accessibilityRole="button"
                onPress={pickAvatar}
                style={({ pressed }) => [
                  styles.changeAvatarButton,
                  pressed && styles.pressed,
                ]}
              >
                <Camera
                  color={palette.void}
                  size={iconSize.small}
                  strokeWidth={1.8}
                />
                <Text style={styles.changeAvatarText}>{copy.changeAvatar}</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>{copy.name}</Text>
            <Input style={styles.fieldInput}>
              <InputField
                onChangeText={setName}
                placeholder={copy.namePlaceholder}
                placeholderTextColor={palette.smoke}
                selectionColor={palette.paper}
                style={styles.fieldText}
                value={name}
              />
            </Input>

            <Text style={styles.fieldLabel}>{copy.bio}</Text>
            <Textarea style={styles.fieldTextarea}>
              <TextareaInput
                multiline
                onChangeText={setBio}
                placeholder={copy.bioPlaceholder}
                placeholderTextColor={palette.smoke}
                selectionColor={palette.paper}
                style={[styles.fieldText, styles.fieldTextMultiline]}
                value={bio}
              />
            </Textarea>

            <Text style={styles.fieldLabel}>{copy.email}</Text>
            <Input style={styles.fieldInput}>
              <InputField
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder={copy.emailPlaceholder}
                placeholderTextColor={palette.smoke}
                selectionColor={palette.paper}
                style={styles.fieldText}
                value={email}
              />
            </Input>

            <View style={styles.dialogActions}>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.dialogButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.dialogCancel}>{copy.cancel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={save}
                style={({ pressed }) => [
                  styles.dialogButton,
                  styles.dialogSave,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.dialogSaveText}>{copy.save}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.ink,
  },
  summaryInitial: {
    color: palette.void,
    fontFamily: fonts.display,
    fontSize: 20,
  },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryName: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    lineHeight: 20,
  },
  summaryMeta: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 17,
    marginTop: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: palette.overlay,
  },
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
    marginBottom: spacing.md,
  },
  dialogTitle: {
    color: palette.paper,
    fontFamily: fonts.display,
    fontSize: typeScale.subheading,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  editorInitial: {
    color: palette.void,
    fontFamily: fonts.display,
    fontSize: 24,
  },
  changeAvatarButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.md,
  },
  changeAvatarText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
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
    minHeight: 72,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.graphite,
  },
  fieldTextMultiline: { minHeight: 64, textAlignVertical: "top" },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dialogButton: {
    minHeight: 38,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  dialogCancel: {
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  dialogSave: { backgroundColor: palette.accent },
  dialogSaveText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  pressed: { opacity: 0.62 },
});
