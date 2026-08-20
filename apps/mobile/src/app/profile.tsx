import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

import {
  ProfileEditorModal,
  ProfileSummaryCard,
} from "@/components/profile-editor";
import { Screen } from "@/components/screen";
import { Text } from "@/components/ui/text";
import {
  fonts,
  palette,
  spacing,
  typeScale,
} from "@/constants/theme";
import { useContactFlow } from "@/store/use-contactflow";

export default function ProfileScreen() {
  const router = useRouter();
  const language = useContactFlow((state) => state.language);
  const [editing, setEditing] = useState(false);
  const copy = profileCopy[language];

  return (
    <Screen
      backLabel={copy.back}
      onBack={() => router.back()}
      title={copy.title}
    >
      <ProfileSummaryCard
        language={language}
        onPress={() => setEditing(true)}
      />
      <Text style={styles.note}>{copy.note}</Text>
      <ProfileEditorModal
        language={language}
        onClose={() => setEditing(false)}
        visible={editing}
      />
    </Screen>
  );
}

const profileCopy = {
  zh: {
    title: "我的",
    note: "个人信息和头像仅保存在本机。点按卡片即可编辑。",
    back: "返回对话",
  },
  en: {
    title: "Profile",
    note: "Your profile and photo stay on this device. Tap the card to edit.",
    back: "Back to chat",
  },
} as const;

const styles = StyleSheet.create({
  note: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
