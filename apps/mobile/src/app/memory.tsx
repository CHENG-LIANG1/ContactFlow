import { useRouter } from "expo-router";
import { Database, Shield, Trash2 } from "lucide-react-native";
import { Alert, StyleSheet } from "react-native";

import { Screen, SectionHeading } from "@/components/screen";
import { Avatar, AvatarFallbackText } from "@/components/ui/avatar";
import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { fonts, palette, radius, spacing } from "@/constants/theme";
import { useContactFlow } from "@/store/use-contactflow";

export default function MemoryScreen() {
  const router = useRouter();
  const memories = useContactFlow((state) => state.memories);
  const language = useContactFlow((state) => state.language);
  const clearLocalData = useContactFlow((state) => state.clearLocalData);
  const copy = memoryCopy[language];

  const clear = () => {
    Alert.alert(
      copy.clearTitle,
      copy.clearBody,
      [
        { text: copy.cancel, style: "cancel" },
        { text: copy.clear, style: "destructive", onPress: clearLocalData },
      ],
    );
  };

  return (
    <Screen
      backLabel={copy.back}
      eyebrow="CONFIRMED MEMORY / 003"
      onBack={() => router.back()}
      subtitle={copy.subtitle}
      title={copy.title}
      trailing={
        <Pressable
          accessibilityLabel="清空本地数据"
          accessibilityRole="button"
          hitSlop={12}
          onPress={clear}
        >
          <Trash2 color={palette.smoke} size={17} strokeWidth={1.5} />
        </Pressable>
      }
    >
      <Card style={styles.promiseCard}>
        <View style={styles.promiseIcon}>
          <Shield color={palette.paper} size={19} strokeWidth={1.5} />
        </View>
        <View style={styles.promiseCopy}>
          <Text style={styles.promiseKicker}>{copy.policy}</Text>
          <Text style={styles.promiseTitle}>{copy.promiseTitle}</Text>
          <Text style={styles.promiseBody}>{copy.promiseBody}</Text>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeading count={memories.length} label={copy.section} />
        {memories.length === 0 ? (
          <View style={styles.empty}>
            <Database color={palette.line} size={30} strokeWidth={1.3} />
            <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
            <Text style={styles.emptyBody}>{copy.emptyBody}</Text>
          </View>
        ) : (
          memories.map((memory) => (
            <Card key={memory.id} style={styles.memoryCard}>
              <Avatar className="h-11 w-11 bg-[#f7f6ee]">
                <AvatarFallbackText style={styles.avatarText}>
                  {memory.contactName.slice(0, 1)}
                </AvatarFallbackText>
              </Avatar>
              <View style={styles.memoryContent}>
                <Text style={styles.contactName}>{memory.contactName}</Text>
                <View style={styles.factRow}>
                  <Text style={styles.factLabel}>{memory.label}</Text>
                  <Text style={styles.factValue}>{memory.value}</Text>
                </View>
                <Text style={styles.source}>
                  {copy.source} · {memory.source}
                </Text>
              </View>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

const memoryCopy = {
  zh: {
    title: "记得有依据，忘记有出口。",
    subtitle: "只有你确认且执行成功的事实，才会进入后续洞察。",
    clearTitle: "清空 ContactFlow 数据？",
    clearBody: "这会删除本地行动、历史和记忆，不会删除系统日历或通讯录中的对象。",
    cancel: "取消",
    clear: "清空本地数据",
    policy: "记忆规则",
    promiseTitle: "未确认，不写入。",
    promiseBody: "原始截图不进入长期记忆；失败或取消的行动不会被描述成已完成。",
    section: "记忆事实",
    emptyTitle: "记忆还是空的",
    emptyBody: "确认一个会议或联系人行动后，第一条有来源的事实会出现在这里。",
    source: "来源",
    back: "返回对话",
  },
  en: {
    title: "Memory with evidence and an exit.",
    subtitle: "Only facts you confirm and successfully execute can inform future insights.",
    clearTitle: "Clear ContactFlow data?",
    clearBody: "This removes local actions, history, and memory. Calendar and Contacts entries remain.",
    cancel: "Cancel",
    clear: "Clear local data",
    policy: "MEMORY POLICY",
    promiseTitle: "Unconfirmed means unwritten.",
    promiseBody: "Original screenshots never become long-term memory. Failed or cancelled actions are never marked complete.",
    section: "MEMORY FACTS",
    emptyTitle: "Memory is empty",
    emptyBody: "Confirm a meeting or contact action and its sourced fact will appear here.",
    source: "Source",
    back: "Back to chat",
  },
} as const;

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  promiseCard: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.graphite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
  },
  promiseIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(247,246,238,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  promiseCopy: { flex: 1 },
  promiseKicker: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: 8,
    letterSpacing: 0.9,
  },
  promiseTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    marginTop: 5,
  },
  promiseBody: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  memoryCard: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: palette.void, fontFamily: fonts.display, fontSize: 23 },
  memoryContent: { flex: 1 },
  contactName: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  factLabel: { color: palette.smoke, fontFamily: fonts.body, fontSize: 12 },
  factValue: {
    flex: 1,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    textAlign: "right",
  },
  source: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: spacing.sm,
  },
  empty: {
    minHeight: 210,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
  },
  emptyTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    marginTop: spacing.lg,
  },
  emptyBody: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
