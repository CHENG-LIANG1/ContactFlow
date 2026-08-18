import { Check, ChevronRight, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";

import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { fonts, palette, radius, spacing } from "@/constants/theme";

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
      <Card style={styles.group}>{children}</Card>
    </View>
  );
}

export function SettingsDivider({ inset = 58 }: { inset?: number }) {
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
  iconColor?: string;
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
      className="data-[active=true]:bg-[#1A1B18]"
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.rowContent}>
        {Icon ? (
          <View style={styles.iconWrap}>
            <Icon color={destructive ? palette.danger : iconColor} size={19} strokeWidth={1.7} />
          </View>
        ) : null}
        <View style={styles.copy}>
          <Text style={[styles.title, destructive && styles.destructive]}>
            {title}
          </Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>
        {valueAccessory}
        {value ? <Text numberOfLines={1} style={styles.value}>{value}</Text> : null}
        {selected ? (
          <Check color={iconColor} size={19} strokeWidth={2.1} />
        ) : onPress && showsDisclosure ? (
          <ChevronRight color={palette.smoke} size={18} strokeWidth={1.7} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionLabel: {
    color: palette.smoke,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: spacing.xs,
  },
  group: {
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: palette.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
  },
  row: {
    width: "100%",
  },
  rowContent: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
    fontSize: 15,
    lineHeight: 21,
  },
  detail: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  value: {
    maxWidth: "42%",
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
  },
  destructive: { color: palette.danger },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.lineSoft,
  },
});
