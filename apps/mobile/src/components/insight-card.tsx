import { ArrowUpRight, Lightbulb } from "lucide-react-native";
import { StyleSheet } from "react-native";

import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  palette,
  radius,
  spacing,
  typeScale,
} from "@/constants/theme";
import type { Insight } from "@/domain/actions";
import type { AppLanguage } from "@/domain/preferences";

export function InsightCard({
  insight,
  language,
}: {
  insight: Insight;
  language: AppLanguage;
}) {
  const isSuggestion = insight.kind === "suggestion";
  const Icon = isSuggestion ? ArrowUpRight : Lightbulb;

  return (
    <Card style={[styles.card, isSuggestion && styles.suggestionCard]}>
      <View style={[styles.iconWrap, isSuggestion && styles.suggestionIcon]}>
        <Icon color={palette.paper} size={iconSize.small} strokeWidth={1.7} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.kicker, isSuggestion && styles.suggestionKicker]}>
          {isSuggestion
            ? language === "zh"
              ? "下一步建议"
              : "NEXT STEP"
            : language === "zh"
              ? "关系洞察"
              : "INSIGHT"}
        </Text>
        <Text style={styles.title}>{insight.title}</Text>
        <Text style={styles.body}>{insight.body}</Text>
        <Text style={styles.evidence}>
          {language === "zh" ? "依据" : "Evidence"} ·{" "}
          {insight.evidenceIds.join(" · ")}
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
    backgroundColor: palette.ink,
  },
  suggestionCard: {
    backgroundColor: palette.ink,
    borderColor: palette.accent,
  },
  suggestionIcon: { backgroundColor: palette.glow },
  content: { flex: 1 },
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
  evidence: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    marginTop: spacing.md,
  },
});
