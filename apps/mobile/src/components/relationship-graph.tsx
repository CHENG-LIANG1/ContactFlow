import { UserRound } from "lucide-react-native";
import { useMemo } from "react";
import { ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { Box as View } from "@/components/ui/box";
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
import type { RelationshipContact } from "@/domain/relationship-memory";

type RelationshipGraphProps = {
  contacts: RelationshipContact[];
  language: "zh" | "en";
  onSelectRoot: () => void;
  onSelect: (id: string) => void;
  profile: { name: string };
  selectedId?: string;
};

const GRAPH_HEIGHT = 330;
const CHILD_SIZE = 76;
const ROOT_SIZE = 92;

/** A deterministic radial map stays legible as memories change between launches. */
export function RelationshipGraph({
  contacts,
  language,
  onSelectRoot,
  onSelect,
  profile,
  selectedId,
}: RelationshipGraphProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const graphWidth = Math.max(viewportWidth - spacing.xl * 2, contacts.length > 4 ? 620 : 360);
  const center = { x: graphWidth / 2, y: GRAPH_HEIGHT / 2 };
  const positions = useMemo(
    () =>
      contacts.map((contact, index) => {
        const startAngle = contacts.length === 2 ? 0 : -Math.PI / 2;
        const angle =
          startAngle + (index * Math.PI * 2) / Math.max(contacts.length, 1);
        const radiusX = Math.min(graphWidth / 2 - CHILD_SIZE / 2 - spacing.md, 232);
        const radiusY = 112;
        return {
          contact,
          x: center.x + Math.cos(angle) * radiusX,
          y: center.y + Math.sin(angle) * radiusY,
        };
      }),
    [center.x, center.y, contacts, graphWidth],
  );

  return (
    <View style={styles.frame}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View style={{ height: GRAPH_HEIGHT, width: graphWidth }}>
          <Svg
            accessibilityElementsHidden
            height={GRAPH_HEIGHT}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            width={graphWidth}
          >
            <Circle
              cx={center.x}
              cy={center.y}
              fill="none"
              opacity={0.5}
              r={70}
              stroke={palette.line}
              strokeDasharray="2 8"
              strokeWidth={1}
            />
            {positions.map(({ contact, x, y }) => {
              const controlX = center.x + (x - center.x) * 0.54;
              const controlY = center.y + (y - center.y) * 0.28;
              return (
                <Path
                  d={`M ${center.x} ${center.y} Q ${controlX} ${controlY} ${x} ${y}`}
                  fill="none"
                  key={contact.id}
                  opacity={selectedId === contact.id ? 0.9 : 0.45}
                  stroke={selectedId === contact.id ? palette.accent : palette.smoke}
                  strokeLinecap="round"
                  strokeWidth={selectedId === contact.id ? 2 : 1}
                />
              );
            })}
          </Svg>

          <View
            style={[
              styles.rootNodePosition,
              {
                left: center.x - ROOT_SIZE / 2,
                top: center.y - ROOT_SIZE / 2,
              },
            ]}
          >
            <Pressable
              accessibilityHint={
                language === "zh"
                  ? "返回关系总览"
                  : "Return to relationship overview"
              }
              accessibilityLabel={`${language === "zh" ? "我" : "Me"}: ${profile.name}`}
              accessibilityRole="button"
              onPress={onSelectRoot}
              style={styles.rootNode}
            >
              <View style={styles.rootAvatar}>
                <Text style={styles.rootInitial}>R</Text>
              </View>
              <Text numberOfLines={1} style={styles.rootLabel}>
                {profile.name}
              </Text>
            </Pressable>
          </View>

          {positions.map(({ contact, x, y }) => {
            const selected = contact.id === selectedId;
            return (
              <View
                key={contact.id}
                style={[
                  styles.contactNodePosition,
                  { left: x - CHILD_SIZE / 2, top: y - CHILD_SIZE / 2 },
                ]}
              >
                <Pressable
                  accessibilityHint={
                    language === "zh"
                      ? "查看联系人信息和最近活动"
                      : "View contact details and recent activity"
                  }
                  accessibilityLabel={contact.name}
                  accessibilityRole="button"
                  onPress={() => onSelect(contact.id)}
                  style={[
                    styles.contactNode,
                    selected && styles.contactNodeSelected,
                  ]}
                >
                  <View style={[styles.contactAvatar, selected && styles.contactAvatarSelected]}>
                    {contact.name ? (
                      <Text style={styles.contactInitial}>{contact.name.slice(0, 1)}</Text>
                    ) : (
                      <UserRound color={palette.paper} size={iconSize.medium} />
                    )}
                  </View>
                <Text numberOfLines={2} style={styles.contactLabel}>
                    {contact.name}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {contacts.length === 0 ? (
        <View pointerEvents="none" style={styles.emptyHint}>
          <Text style={styles.emptyText}>
            {language === "zh" ? "确认联系人后，关系会从这里生长。" : "Confirm a contact to grow your relationship map."}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    minHeight: GRAPH_HEIGHT,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.ink,
  },
  scrollContent: { minWidth: "100%" },
  rootNodePosition: {
    position: "absolute",
    width: ROOT_SIZE,
    height: ROOT_SIZE,
  },
  rootNode: {
    width: ROOT_SIZE,
    height: ROOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: ROOT_SIZE / 2,
    backgroundColor: palette.graphite,
    borderWidth: 1,
    borderColor: palette.accent,
    shadowColor: palette.accent,
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  rootAvatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: palette.accent,
  },
  rootInitial: { color: palette.void, fontFamily: fonts.display, fontSize: 20 },
  rootLabel: {
    maxWidth: 70,
    color: palette.paper,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
    marginTop: spacing.xs,
  },
  contactNodePosition: {
    position: "absolute",
    width: CHILD_SIZE,
    height: CHILD_SIZE,
  },
  contactNode: {
    width: CHILD_SIZE,
    height: CHILD_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CHILD_SIZE / 2,
    backgroundColor: palette.graphite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  contactNodeSelected: {
    backgroundColor: palette.glow,
    borderColor: palette.accent,
    borderWidth: 1.5,
  },
  contactAvatar: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: palette.ink,
  },
  contactAvatarSelected: { backgroundColor: palette.accent },
  contactInitial: { color: palette.paper, fontFamily: fonts.display, fontSize: 16 },
  contactLabel: {
    width: CHILD_SIZE - spacing.sm,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 13,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  emptyHint: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    textAlign: "center",
  },
});
