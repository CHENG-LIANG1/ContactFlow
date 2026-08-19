import { Check, ChevronRight, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, type ColorValue } from "react-native";

import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  palette,
  radius,
  spacing,
  typeScale,
} from "@/constants/theme";

export function SettingsGroup({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <View style={styles.section}>
      {label ? <Text style={styles.sectionLabel}>{label}</Text> : null}
      <Card className="gap-0 p-0" style={styles.group}>
        {children}
      </Card>
    </View>
  );
}

export function SettingsDivider({ inset = 50 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

export function SettingsRow({
  accessibilityLabel,
  destructive = false,
  detail,
  icon: Icon,
  iconColor = palette.mist,
  onPress,
  selected = false,
  showsDisclosure = true,
  title,
  value,
  valueAccessory,
}: {
  accessibilityLabel?: string;
  destructive?: boolean;
  detail?: string;
  icon?: LucideIcon;
  iconColor?: ColorValue;
  onPress?: () => void;
  selected?: boolean;
  showsDisclosure?: boolean;
  title: string;
  value?: string;
  valueAccessory?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={selected ? { selected: true } : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowContent}>
        {Icon ? (
          <View style={styles.iconWrap}>
            <Icon
              color={destructive ? palette.danger : iconColor}
              size={iconSize.small}
              strokeWidth={1.8}
            />
          </View>
        ) : null}
        <View style={styles.copy}>
          <Text style={[styles.title, destructive && styles.destructive]}>
            {title}
          </Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>
        {valueAccessory}
        {value ? (
          <Text numberOfLines={1} style={styles.value}>
            {value}
          </Text>
        ) : null}
        {selected ? (
          <Check color={iconColor} size={iconSize.medium} strokeWidth={2.1} />
        ) : onPress && showsDisclosure ? (
          <ChevronRight
            color={palette.smoke}
            size={iconSize.medium}
            strokeWidth={1.7}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  sectionLabel: {
    color: palette.smoke,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
    lineHeight: 18,
    paddingHorizontal: spacing.xs,
  },
  group: {
    overflow: "hidden",
    padding: 0,
    gap: 0,
    borderRadius: radius.md,
    backgroundColor: palette.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
  },
  row: {
    width: "100%",
  },
  rowPressed: { backgroundColor: palette.graphite },
  rowContent: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.graphite,
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    lineHeight: 19,
  },
  detail: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 17,
    marginTop: 2,
  },
  value: {
    maxWidth: "42%",
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
    textAlign: "right",
  },
  destructive: { color: palette.danger },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.lineSoft,
  },
});
