import type { PropsWithChildren, ReactNode } from "react";
import { ChevronLeft } from "lucide-react-native";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OrbitBackground } from "@/components/orbit-background";
import { Box as View } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  palette,
  spacing,
  typeScale,
} from "@/constants/theme";

type ScreenProps = PropsWithChildren<{
  title: string;
  activeOrbit?: boolean;
  trailing?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}>;

export function Screen({
  title,
  activeOrbit,
  trailing,
  onBack,
  backLabel = "返回对话",
  children,
}: ScreenProps) {
  return (
    <View style={styles.root}>
      <OrbitBackground active={activeOrbit} />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.utilityRow}>
            <View style={styles.utilityStart}>
              {onBack ? (
                <Pressable
                  accessibilityLabel={backLabel}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={onBack}
                  style={({ pressed }) => [
                    styles.backButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ChevronLeft
                    color={palette.paper}
                    size={iconSize.medium}
                    strokeWidth={1.7}
                  />
                </Pressable>
              ) : null}
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
            </View>
            {trailing}
          </View>
          <View style={styles.body}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function SectionHeading({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {typeof count === "number" ? (
        <Text style={styles.sectionCount}>
          {String(count).padStart(2, "0")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.void },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  utilityStart: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -10,
  },
  utilityRow: {
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.heading,
    lineHeight: 28,
    letterSpacing: 0,
  },
  body: { marginTop: spacing.xl, gap: spacing.xl },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    color: palette.mist,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
    letterSpacing: 1.1,
  },
  sectionCount: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
  },
  pressed: { opacity: 0.55 },
});
