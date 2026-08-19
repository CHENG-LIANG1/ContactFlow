import { useRouter } from "expo-router";
import { CalendarCheck, ContactRound, RefreshCcw } from "lucide-react-native";
import { StyleSheet } from "react-native";

import { Screen, SectionHeading } from "@/components/screen";
import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  palette,
  radius,
  spacing,
} from "@/constants/theme";
import type { ActionType } from "@/domain/actions";
import { useContactFlow } from "@/store/use-contactflow";

function iconFor(type: ActionType) {
  if (type === "create_meeting") return CalendarCheck;
  if (type === "create_contact") return ContactRound;
  return RefreshCcw;
}

export default function HistoryScreen() {
  const router = useRouter();
  const history = useContactFlow((state) => state.history);
  const language = useContactFlow((state) => state.language);
  const copy = historyCopy[language];

  return (
    <Screen
      backLabel={copy.back}
      onBack={() => router.back()}
      title={copy.title}
    >
      <View style={styles.section}>
        <SectionHeading count={history.length} label={copy.section} />
        {history.length === 0 ? (
          <EmptyHistory language={language} />
        ) : (
          history.map((record) => {
            const Icon = iconFor(record.type);
            return (
              <Card key={record.id} style={styles.card}>
                <View style={styles.iconWrap}>
                  <Icon
                    color={palette.paper}
                    size={iconSize.small}
                    strokeWidth={1.7}
                  />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{record.title}</Text>
                  <Text style={styles.cardMeta}>
                    {record.contactName} ·{" "}
                    {new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(record.executedAt))}
                  </Text>
                  <Text numberOfLines={1} style={styles.receipt}>
                    SYSTEM RECEIPT · {record.nativeObjectId}
                  </Text>
                </View>
              </Card>
            );
          })
        )}
      </View>
    </Screen>
  );
}

function EmptyHistory({ language }: { language: "zh" | "en" }) {
  const copy = historyCopy[language];
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyNumber}>00</Text>
      <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
      <Text style={styles.emptyBody}>{copy.emptyBody}</Text>
    </View>
  );
}

const historyCopy = {
  zh: {
    title: "每一步，都有回声。",
    subtitle: "这里记录真正执行成功的行动，而不是模型曾经提出过什么。",
    section: "已确认行动",
    emptyTitle: "还没有已执行行动",
    emptyBody: "在对话中确认行动后，系统回执会出现在这里。",
    back: "返回对话",
  },
  en: {
    title: "Every action leaves a trace.",
    subtitle: "Only successfully executed actions appear here—not everything the model proposed.",
    section: "CONFIRMED ACTIONS",
    emptyTitle: "No executed actions yet",
    emptyBody: "Confirm an action in chat and its system receipt will appear here.",
    back: "Back to chat",
  },
} as const;

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.graphite,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { flex: 1 },
  cardTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  cardMeta: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 5,
  },
  receipt: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  empty: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
  },
  emptyNumber: {
    color: palette.line,
    fontFamily: fonts.display,
    fontSize: 74,
    lineHeight: 80,
  },
  emptyTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
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
