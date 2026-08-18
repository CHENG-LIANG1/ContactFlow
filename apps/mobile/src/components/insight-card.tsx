import { Sparkles } from "lucide-react-native";
import { StyleSheet } from "react-native";

import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { fonts, palette, radius, spacing } from "@/constants/theme";
import type { Insight } from "@/domain/actions";
import type { AppLanguage } from "@/domain/preferences";

export function InsightCard({
  insight,
  language,
}: {
  insight: Insight;
  language: AppLanguage;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.iconWrap}>
        <Sparkles color={palette.paper} size={16} strokeWidth={1.5} />
      </View>
      <View style={styles.content}>
        <Text style={styles.kicker}>
          {language === "zh" ? "关系提醒" : "RELATIONSHIP SIGNAL"}
        </Text>
        <Text style={styles.title}>{insight.title}</Text>
        <Text style={styles.body}>{insight.body}</Text>
        <Text style={styles.evidence}>
          {language === "zh" ? "依据" : "Evidence"} · {insight.evidence}
        </Text>
      </View>
    </Card>
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
    backgroundColor: "rgba(247,246,238,0.08)",
  },
  content: { flex: 1 },
  kicker: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: 9,
    letterSpacing: 1,
  },
  title: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    marginTop: spacing.sm,
  },
  body: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  evidence: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: spacing.md,
  },
});
